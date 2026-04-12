// Supabase Client
class SupabaseClient {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_ANON_KEY;
        this.headers = {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`
        };
    }

    // Checks if a JWT token is still valid (not expired)
    _isTokenValid(token) {
        if (!token || typeof token !== 'string') return false;
        if (!token.startsWith('eyJ')) return false; // not a JWT
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp && (payload.exp * 1000) > Date.now();
        } catch(e) { return false; }
    }

    getAuthHeaders() {
        try {
            const session = JSON.parse(localStorage.getItem('ob_session') || '{}');
            const token = session.access_token;
            if (this._isTokenValid(token)) {
                return {
                    'Content-Type': 'application/json',
                    'apikey': this.key,
                    'Authorization': `Bearer ${token}`
                };
            } else if (token) {
                // Expired session - clear it
                localStorage.removeItem('ob_session');
            }
        } catch(e) {}
        // Fall back to anon key
        return { ...this.headers };
    }

    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = { headers: { ...this.headers }, ...options };
        try {
            const response = await fetch(url, config);
            if (response.status === 204) return null;
            const text = await response.text();
            const data = text ? JSON.parse(text) : null;
            if (!response.ok) {
                const msg = (data && (data.message || data.error)) || `HTTP ${response.status}`;
                throw new Error(msg);
            }
            return data;
        } catch (error) {
            console.error('Supabase Error:', error);
            throw error;
        }
    }

    // Helper: REST request with custom headers (bypasses cached this.headers)
    async _fetch(endpoint, method, body, extraHeaders = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const headers = { ...this.headers, ...extraHeaders };
        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);
        const response = await fetch(url, config);
        if (response.status === 204) return null;
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (!response.ok) throw new Error((data && (data.message || data.error)) || `HTTP ${response.status}`);
        return data;
    }

    // Public ads - only show active/featured (admin-approved)
    async getAds({ category = '', neighborhood = '', search = '', page = 1, limit = APP_CONFIG.adsPerPage, status = '' } = {}) {
        let filters = [];
        if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
        if (neighborhood) filters.push(`neighborhood=eq.${encodeURIComponent(neighborhood)}`);
        if (search) filters.push(`or=(title.ilike.%25${encodeURIComponent(search)}%25,description.ilike.%25${encodeURIComponent(search)}%25)`);
        if (status) {
            filters.push(`status=eq.${status}`);
        } else {
            filters.push(`status=in.(active,featured)`);
        }
        const today = new Date().toISOString().split('T')[0];
        filters.push(`expires_at=gte.${today}`);
        const from = (page - 1) * limit;
        const filterStr = filters.join('&');
        return this.request(`ads?select=*&${filterStr}&order=status.desc,created_at.desc&offset=${from}&limit=${limit}`);
    }

    async getFeaturedAds() {
        const today = new Date().toISOString().split('T')[0];
        return this.request(`ads?select=*&status=eq.featured&expires_at=gte.${today}&order=created_at.desc&limit=6`);
    }

    async getAdById(id) {
        const result = await this.request(`ads?id=eq.${id}&select=*`);
        return result && result.length > 0 ? result[0] : null;
    }

    async createAd(adData) {
        // New ads start as 'pending' until admin approves
        const data = {
            ...adData,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            views: 0,
            status: 'pending'
        };
        // Use anon key (no session needed for public ad submission)
        return this._fetch('ads', 'POST', data, { 'Prefer': 'return=representation' });
    }

    async updateAd(id, updates) {
        const authHeaders = this.getAuthHeaders();
        authHeaders['Prefer'] = 'return=representation';
        return this._fetch(`ads?id=eq.${id}`, 'PATCH', updates, authHeaders);
    }

    async deleteAd(id) {
        return this._fetch(`ads?id=eq.${id}`, 'DELETE', null, this.getAuthHeaders());
    }

    async incrementViews(id, currentViews) {
        return this._fetch(`ads?id=eq.${id}`, 'PATCH', { views: currentViews + 1 }, {});
    }

    async renewAd(id) {
        const newExpiresAt = new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this._fetch(`ads?id=eq.${id}`, 'PATCH', { expires_at: newExpiresAt, renewed_at: new Date().toISOString() }, {});
    }

    async getUserAds(userId) {
        return this.request(`ads?user_id=eq.${userId}&select=*&order=created_at.desc`);
    }

    // ============== Featured Ad Requests ==============
    async createFeaturedRequest(requestData) {
        const data = { ...requestData, status: 'pending', created_at: new Date().toISOString() };
        return this._fetch('featured_requests', 'POST', data, { 'Prefer': 'return=representation' });
    }

    async getFeaturedRequests(status = '') {
        let query = 'featured_requests?select=*,ads(title,category,price,whatsapp)&order=created_at.desc';
        if (status) query += `&status=eq.${status}`;
        return this.request(query);
    }

    async getUserFeaturedRequests(userId) {
        return this.request(`featured_requests?select=*,ads(title,category,price)&user_id=eq.${userId}&order=created_at.desc`);
    }

    async approveFeaturedRequest(requestId, adId) {
        const featuredUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await this._fetch(`featured_requests?id=eq.${requestId}`, 'PATCH', { status: 'approved', reviewed_at: new Date().toISOString() }, {});
        await this._fetch(`ads?id=eq.${adId}`, 'PATCH', { status: 'featured', featured_until: featuredUntil }, {});
    }

    async rejectFeaturedRequest(requestId, reason = '') {
        await this._fetch(`featured_requests?id=eq.${requestId}`, 'PATCH',
            { status: 'rejected', rejection_reason: reason || 'لم يتم التحقق من التحويل', reviewed_at: new Date().toISOString() }, {});
    }

    async uploadImage(file, adId) {
        try {
            const authHeaders = this.getAuthHeaders();
            const token = authHeaders.Authorization.replace('Bearer ', '');
            const filePath = `ads/${adId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const response = await fetch(`${this.url}/storage/v1/object/ad-images/${filePath}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'x-upsert': 'true', 'Content-Type': file.type },
                body: file
            });
            if (!response.ok) throw new Error('فشل رفع الصورة');
            return `${this.url}/storage/v1/object/public/ad-images/${filePath}`;
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
    }

    async getCategoryCounts() {
        const today = new Date().toISOString().split('T')[0];
        const counts = {};
        for (const cat of CATEGORIES) {
            try {
                const result = await this.request(`ads?category=eq.${cat.id}&expires_at=gte.${today}&select=id&status=in.(active,featured)`);
                counts[cat.id] = result ? result.length : 0;
            } catch (e) { counts[cat.id] = 0; }
        }
        return counts;
    }

    // ============== Notifications ==============
    async createNotification(notifData) {
        try {
            return this._fetch('notifications', 'POST',
                { ...notifData, is_read: false, created_at: new Date().toISOString() },
                { 'Prefer': 'return=representation' }
            );
        } catch(e) { console.warn('Notification creation failed (table may not exist):', e.message); }
    }

    async getUserNotifications(userId) {
        try {
            return await this.request(`notifications?user_id=eq.${userId}&select=*&order=created_at.desc&limit=20`);
        } catch(e) { return []; }
    }

    async markNotificationRead(notifId) {
        try {
            return this._fetch(`notifications?id=eq.${notifId}`, 'PATCH', { is_read: true }, {});
        } catch(e) {}
    }
}

// Initialize Supabase client
const supabaseDB = new SupabaseClient();
window.supabaseDB = supabaseDB;
window.App = window.App || {};
window.App.supabase = supabaseDB;

console.log('Supabase client loaded - createAd uses anon key (no session required)');

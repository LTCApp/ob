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

    getAuthHeaders() {
        const session = JSON.parse(localStorage.getItem('ob_session') || '{}');
        const token = session.access_token || this.key;
        return {
            'Content-Type': 'application/json',
            'apikey': this.key,
            'Authorization': `Bearer ${token}`
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = { headers: this.headers, ...options };
        try {
            const response = await fetch(url, config);
            if (response.status === 204) return null;
            const text = await response.text();
            const data = text ? JSON.parse(text) : null;
            if (!response.ok) throw new Error((data && data.message) || 'حدث خطأ في الطلب');
            return data;
        } catch (error) {
            console.error('Supabase Error:', error);
            throw error;
        }
    }

    // Public ads - only active/featured (approved by admin)
    async getAds({ category = '', neighborhood = '', search = '', page = 1, limit = APP_CONFIG.adsPerPage, status = '' } = {}) {
        let filters = [];
        if (category) filters.push(`category=eq.${category}`);
        if (neighborhood) filters.push(`neighborhood=eq.${encodeURIComponent(neighborhood)}`);
        if (search) filters.push(`or=(title.ilike.%25${search}%25,description.ilike.%25${search}%25)`);
        if (status) {
            filters.push(`status=eq.${status}`);
        } else {
            filters.push(`status=in.(active,featured)`);
        }
        const today = new Date().toISOString().split('T')[0];
        filters.push(`expires_at=gte.${today}`);
        const from = (page - 1) * limit;
        const filterStr = filters.length > 0 ? filters.join('&') + '&' : '';
        const query = `ads?select=*&${filterStr}order=status.desc,created_at.desc&offset=${from}&limit=${limit}`;
        return this.request(query);
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
        // New ads start as 'pending' - admin must approve before appearing publicly
        const data = {
            ...adData,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            views: 0,
            status: 'pending'
        };
        const headers = this.getAuthHeaders();
        headers['Prefer'] = 'return=representation';
        return this.request('ads', { method: 'POST', headers: headers, body: JSON.stringify(data) });
    }

    async updateAd(id, updates) {
        const headers = this.getAuthHeaders();
        headers['Prefer'] = 'return=representation';
        return this.request(`ads?id=eq.${id}`, { method: 'PATCH', headers: headers, body: JSON.stringify(updates) });
    }

    async deleteAd(id) {
        return this.request(`ads?id=eq.${id}`, { method: 'DELETE', headers: this.getAuthHeaders() });
    }

    async incrementViews(id, currentViews) {
        return this.request(`ads?id=eq.${id}`, {
            method: 'PATCH',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ views: currentViews + 1 })
        });
    }

    async renewAd(id) {
        const newExpiresAt = new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this.request(`ads?id=eq.${id}`, {
            method: 'PATCH',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ expires_at: newExpiresAt, renewed_at: new Date().toISOString() })
        });
    }

    async getUserAds(userId) {
        return this.request(`ads?user_id=eq.${userId}&select=*&order=created_at.desc`);
    }

    // ============== Featured Ad Requests ==============
    async createFeaturedRequest(requestData) {
        const headers = this.getAuthHeaders();
        headers['Prefer'] = 'return=representation';
        return this.request('featured_requests', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ ...requestData, status: 'pending', created_at: new Date().toISOString() })
        });
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
        const headers = this.getAuthHeaders();
        await fetch(`${this.url}/rest/v1/featured_requests?id=eq.${requestId}`, {
            method: 'PATCH', headers: headers,
            body: JSON.stringify({ status: 'approved', reviewed_at: new Date().toISOString() })
        });
        const featuredUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await fetch(`${this.url}/rest/v1/ads?id=eq.${adId}`, {
            method: 'PATCH', headers: headers,
            body: JSON.stringify({ status: 'featured', featured_until: featuredUntil })
        });
    }

    async rejectFeaturedRequest(requestId, reason = '') {
        const headers = this.getAuthHeaders();
        await fetch(`${this.url}/rest/v1/featured_requests?id=eq.${requestId}`, {
            method: 'PATCH', headers: headers,
            body: JSON.stringify({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
        });
    }

    async uploadImage(file, adId) {
        try {
            const session = JSON.parse(localStorage.getItem('ob_session') || '{}');
            const token = session.access_token || this.key;
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
        const headers = this.getAuthHeaders();
        headers['Prefer'] = 'return=representation';
        try {
            return this.request('notifications', {
                method: 'POST', headers: headers,
                body: JSON.stringify({ ...notifData, is_read: false, created_at: new Date().toISOString() })
            });
        } catch(e) { console.warn('Notification creation failed:', e); }
    }

    async getUserNotifications(userId) {
        try {
            return await this.request(`notifications?user_id=eq.${userId}&select=*&order=created_at.desc&limit=20`);
        } catch(e) { return []; }
    }

    async markNotificationRead(notifId) {
        try {
            return this.request(`notifications?id=eq.${notifId}`, {
                method: 'PATCH', headers: this.getAuthHeaders(), body: JSON.stringify({ is_read: true })
            });
        } catch(e) {}
    }
}

// Initialize Supabase client
const supabaseDB = new SupabaseClient();
window.supabaseDB = supabaseDB;
window.App = window.App || {};
window.App.supabase = supabaseDB;

console.log('Supabase client loaded - createAd in pending approval mode');

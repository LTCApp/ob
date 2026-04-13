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
        this._sdk = null;
    }

    get sdk() {
        if (!this._sdk && window.supabase && window.supabase.createClient) {
            this._sdk = window.supabase.createClient(this.url, this.key);
        }
        return this._sdk;
    }

    _isTokenValid(token) {
        if (!token || !token.startsWith('eyJ')) return false;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp && (payload.exp * 1000) > Date.now();
        } catch(e) { return false; }
    }

    getAuthHeaders() {
        try {
            const session = JSON.parse(localStorage.getItem('ob_session') || '{}');
            if (this._isTokenValid(session.access_token)) {
                return { 'Content-Type': 'application/json', 'apikey': this.key, 'Authorization': `Bearer ${session.access_token}` };
            } else if (session.access_token) {
                localStorage.removeItem('ob_session');
            }
        } catch(e) {}
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
            if (!response.ok) throw new Error((data && (data.message || data.error)) || `HTTP ${response.status}`);
            return data;
        } catch (error) {
            console.error('Supabase Error:', error);
            throw error;
        }
    }

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

    // Public: only active/featured ads
    async getAds({ category = '', neighborhood = '', search = '', page = 1, limit = APP_CONFIG.adsPerPage, status = '' } = {}) {
        let filters = [];
        if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
        if (neighborhood) filters.push(`neighborhood=eq.${encodeURIComponent(neighborhood)}`);
        if (search) filters.push(`or=(title.ilike.%25${encodeURIComponent(search)}%25,description.ilike.%25${encodeURIComponent(search)}%25)`);
        filters.push(status ? `status=eq.${status}` : `status=in.(active,featured)`);
        const today = new Date().toISOString().split('T')[0];
        filters.push(`expires_at=gte.${today}`);
        const from = (page - 1) * limit;
        return this.request(`ads?select=*&${filters.join('&')}&order=status.desc,created_at.desc&offset=${from}&limit=${limit}`);
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
        const data = {
            ...adData,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            views: 0,
            status: 'pending'   // Always pending until admin approves
        };
        if (!data.user_id) delete data.user_id;

        // Use SDK (handles anon role correctly)
        if (this.sdk) {
            const { data: result, error } = await this.sdk.from('ads').insert(data).select();
            if (error) throw new Error(error.message || 'فشل في إنشاء الإعلان');
            return result;
        }
        return this._fetch('ads', 'POST', data, { 'Prefer': 'return=representation' });
    }

    async updateAd(id, updates) {
        if (this.sdk) {
            const { data, error } = await this.sdk.from('ads').update(updates).eq('id', id).select();
            if (error) throw new Error(error.message);
            return data;
        }
        return this._fetch(`ads?id=eq.${id}`, 'PATCH', updates, { 'Prefer': 'return=representation' });
    }

    async deleteAd(id) {
        if (this.sdk) {
            const { error } = await this.sdk.from('ads').delete().eq('id', id);
            if (error) throw new Error(error.message);
            return null;
        }
        return this._fetch(`ads?id=eq.${id}`, 'DELETE', null, {});
    }

    async incrementViews(id, currentViews) {
        return this._fetch(`ads?id=eq.${id}`, 'PATCH', { views: currentViews + 1 }, {});
    }

    async renewAd(id) {
        const newExpires = new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this._fetch(`ads?id=eq.${id}`, 'PATCH', { expires_at: newExpires, renewed_at: new Date().toISOString() }, {});
    }

    async getUserAds(userId) {
        // Return ALL statuses for the user's own dashboard
        return this.request(`ads?user_id=eq.${userId}&select=*&order=created_at.desc`);
    }

    // Featured Requests
    async createFeaturedRequest(requestData) {
        const data = { ...requestData, status: 'pending', created_at: new Date().toISOString() };
        if (!data.user_id) delete data.user_id;
        if (this.sdk) {
            const { data: result, error } = await this.sdk.from('featured_requests').insert(data).select();
            if (error) throw new Error(error.message);
            return result;
        }
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

    async getCategoryCounts() {
        const today = new Date().toISOString().split('T')[0];
        const counts = {};
        for (const cat of CATEGORIES) {
            try {
                const r = await this.request(`ads?category=eq.${cat.id}&expires_at=gte.${today}&select=id&status=in.(active,featured)`);
                counts[cat.id] = r ? r.length : 0;
            } catch (e) { counts[cat.id] = 0; }
        }
        return counts;
    }

    async getUserNotifications(userId) {
        try {
            return await this.request(`notifications?user_id=eq.${userId}&select=*&order=created_at.desc&limit=20`);
        } catch(e) { return []; }
    }
}

const supabaseDB = new SupabaseClient();
window.supabaseDB = supabaseDB;
window.App = window.App || {};
window.App.supabase = supabaseDB;

console.log('Supabase client loaded ✓ (SDK mode, pending approval flow)');

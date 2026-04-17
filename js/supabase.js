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
        const config = { ...options, headers: { ...this.getAuthHeaders(), ...(options.headers || {}) } };
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

    // Public: get ads with featured first in same category
    async getAds({ category = '', neighborhood = '', search = '', page = 1, limit = APP_CONFIG.adsPerPage, status = '' } = {}) {
        let filters = [];
        if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
        if (neighborhood) filters.push(`neighborhood=eq.${encodeURIComponent(neighborhood)}`);
        if (search) filters.push(`or=(title.ilike.%25${encodeURIComponent(search)}%25,description.ilike.%25${encodeURIComponent(search)}%25)`);
        filters.push(status ? `status=eq.${status}` : `status=in.(active,featured)`);
        const today = new Date().toISOString().split('T')[0];
        filters.push(`expires_at=gte.${today}`);
        const from = (page - 1) * limit;
        
        const ads = await this.request(`ads?select=*&${filters.join('&')}&order=status.desc,created_at.desc&offset=${from}&limit=${limit}`);
        return (ads || []).sort((a, b) => {
            const featuredDiff = (b.status === 'featured' ? 1 : 0) - (a.status === 'featured' ? 1 : 0);
            if (featuredDiff !== 0) return featuredDiff;
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
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
        // Wait for categories to be loaded
        const cats = CATEGORIES.length > 0 ? CATEGORIES : (await this.getCategories());
        for (const cat of cats) {
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

    async createNotification(userId, notification) {
        if (!userId) return null;
        const data = {
            user_id: userId,
            type: notification.type || 'general',
            title: notification.title || '',
            message: notification.message || '',
            ad_id: notification.ad_id || null,
            is_read: false,
            created_at: new Date().toISOString()
        };
        if (this.sdk) {
            const { data: result, error } = await this.sdk.from('notifications').insert(data).select();
            if (error) throw new Error(error.message);
            return result;
        }
        return this._fetch('notifications', 'POST', data, { 'Prefer': 'return=representation' });
    }

    async markUserNotificationsRead(userId) {
        if (!userId) return null;
        if (this.sdk) {
            const { data, error } = await this.sdk.from('notifications').update({ is_read: true }).eq('user_id', userId).select();
            if (error) throw new Error(error.message);
            return data;
        }
        return this._fetch(`notifications?user_id=eq.${userId}`, 'PATCH', { is_read: true }, { 'Prefer': 'return=representation' });
    }

    // ===== New methods for dynamic data =====
    
    // Categories CRUD
    async getCategories() {
        try {
            const result = await this.request('categories?select=*&order=order_index.asc');
            return result || [];
        } catch(e) {
            console.error('Error fetching categories:', e);
            return [];
        }
    }

    async createCategory(categoryData) {
        const data = {
            id: categoryData.id,
            name_ar: categoryData.name_ar,
            name: categoryData.name || categoryData.name_ar,
            icon: categoryData.icon || null,
            logo: categoryData.logo || categoryData.image_url || categoryData.image || null,
            order_index: categoryData.order_index || 0,
            created_at: new Date().toISOString()
        };
        if (this.sdk) {
            const { data: result, error } = await this.sdk.from('categories').insert(data).select();
            if (error) throw new Error(error.message);
            return result;
        }
        return this._fetch('categories', 'POST', data, { 'Prefer': 'return=representation' });
    }

    async updateCategory(id, updates) {
        if (this.sdk) {
            const { data, error } = await this.sdk.from('categories').update(updates).eq('id', id).select();
            if (error) throw new Error(error.message);
            return data;
        }
        return this._fetch(`categories?id=eq.${id}`, 'PATCH', updates, { 'Prefer': 'return=representation' });
    }

    async deleteCategory(id) {
        if (this.sdk) {
            const { error } = await this.sdk.from('categories').delete().eq('id', id);
            if (error) throw new Error(error.message);
            return null;
        }
        return this._fetch(`categories?id=eq.${id}`, 'DELETE', null, {});
    }

    // Neighborhoods CRUD
    async getNeighborhoods() {
        try {
            const result = await this.request('neighborhoods?select=*&order=name_ar.asc');
            return result || [];
        } catch(e) {
            console.error('Error fetching neighborhoods:', e);
            return [];
        }
    }

    async createNeighborhood(nameAr) {
        const data = {
            name_ar: nameAr,
            created_at: new Date().toISOString()
        };
        if (this.sdk) {
            const { data: result, error } = await this.sdk.from('neighborhoods').insert(data).select();
            if (error) throw new Error(error.message);
            return result;
        }
        return this._fetch('neighborhoods', 'POST', data, { 'Prefer': 'return=representation' });
    }

    async deleteNeighborhood(id) {
        if (this.sdk) {
            const { error } = await this.sdk.from('neighborhoods').delete().eq('id', id);
            if (error) throw new Error(error.message);
            return null;
        }
        return this._fetch(`neighborhoods?id=eq.${id}`, 'DELETE', null, {});
    }

    // Site Settings
    async getSiteSettings() {
        try {
            const result = await this.request('site_settings?select=*&limit=1');
            return result && result.length > 0 ? result[0] : null;
        } catch(e) {
            console.error('Error fetching site settings:', e);
            return null;
        }
    }

    async updateSiteSettings(settings) {
        // First check if settings exist
        const existing = await this.getSiteSettings();
        
        if (existing) {
            // Update existing
            if (this.sdk) {
                const { data, error } = await this.sdk.from('site_settings').update(settings).eq('id', existing.id).select();
                if (error) throw new Error(error.message);
                return data;
            }
            return this._fetch(`site_settings?id=eq.${existing.id}`, 'PATCH', settings, { 'Prefer': 'return=representation' });
        } else {
            // Create new
            if (this.sdk) {
                const { data, error } = await this.sdk.from('site_settings').insert(settings).select();
                if (error) throw new Error(error.message);
                return data;
            }
            return this._fetch('site_settings', 'POST', settings, { 'Prefer': 'return=representation' });
        }
    }
}

const supabaseDB = new SupabaseClient();
window.supabaseDB = supabaseDB;
window.App = window.App || {};
window.App.supabase = supabaseDB;

// [log removed for production]
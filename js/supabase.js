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

    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = {
            headers: this.headers,
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'حدث خطأ في الطلب');
            }

            return data;
        } catch (error) {
            console.error('Supabase Error:', error);
            throw error;
        }
    }

    // Ads CRUD Operations
    async getAds({ category = '', neighborhood = '', search = '', page = 1, limit = APP_CONFIG.adsPerPage } = {}) {
        let query = 'ads?select=*&order=created_at.desc&';

        // Build filters
        const filters = [];
        if (category) filters.push(`category=eq.${category}`);
        if (neighborhood) filters.push(`neighborhood=eq.${neighborhood}`);
        if (search) filters.push(`or=(title.ilike.%25${search}%25,description.ilike.%25${search}%25)`);

        // Add filters to query
        if (filters.length > 0) {
            query = `ads?select=*&${filters.join('&')}&order=created_at.desc&`;
        }

        // Pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query += `offset=${from}&limit=${limit}`;

        // Check for expired ads and filter them out
        const today = new Date().toISOString().split('T')[0];
        query += `&expires_at=gte.${today}`;

        return this.request(query);
    }

    async getAdById(id) {
        return this.request(`ads?id=eq.${id}&select=*`);
    }

    async createAd(adData) {
        const data = {
            ...adData,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            views: 0,
            status: 'active'
        };

        return this.request('ads', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateAd(id, updates) {
        return this.request(`ads?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
    }

    async deleteAd(id) {
        return this.request(`ads?id=eq.${id}`, {
            method: 'DELETE'
        });
    }

    async incrementViews(id, currentViews) {
        return this.request(`ads?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ views: currentViews + 1 })
        });
    }

    async renewAd(id) {
        const newExpiresAt = new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this.request(`ads?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                expires_at: newExpiresAt,
                renewed_at: new Date().toISOString()
            })
        });
    }

    // Get expiring ads (for notifications)
    async getExpiringAds() {
        const today = new Date();
        const alertDate = new Date(today.getTime() + APP_CONFIG.expiringAlertDays * 24 * 60 * 60 * 1000);

        return this.request(
            `ads?select=*&expires_at=gte.${today.toISOString().split('T')[0]}&expires_at=lte.${alertDate.toISOString().split('T')[0]}&order=expires_at.asc`
        );
    }

    // Get ad counts by category
    async getCategoryCounts() {
        const today = new Date().toISOString().split('T')[0];
        const counts = {};

        for (const cat of CATEGORIES) {
            const result = await this.request(
                `ads?category=eq.${cat.id}&expires_at=gte.${today}&select=id`
            );
            counts[cat.id] = result.length;
        }

        return counts;
    }

    // Upload image to storage
    async uploadImage(file, adId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_path', `ads/${adId}/${file.name}`);

        try {
            const response = await fetch(
                `${this.url}/storage/v1/object/${formData.get('upload_path')}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.key}`,
                        'x-upsert': 'true'
                    },
                    body: file
                }
            );

            if (!response.ok) throw new Error('فشل رفع الصورة');

            // Return public URL
            return `${this.url}/storage/v1/object/public/${formData.get('upload_path')}`;
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
    }
}

// Initialize Supabase client
const supabase = new SupabaseClient();

// Export for use in other pages
window.supabase = supabase;

console.log('Supabase client loaded');

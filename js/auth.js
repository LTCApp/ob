/**
 * Authentication Module for OB - لأهل العبور
 * Uses Supabase JS SDK for Google OAuth
 */

// Initialize Supabase Auth Client
const supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class AuthManager {
    constructor() {
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_ANON_KEY;
        this.client = supabaseAuth;
    }

    // Get current user from localStorage
    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('ob_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            console.error('Error getting user:', e);
            return null;
        }
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    }

    // Store user data
    setUser(user) {
        try {
            localStorage.setItem('ob_user', JSON.stringify(user));
        } catch (e) {
            console.error('Error saving user:', e);
        }
    }

    // Clear user data (logout)
    clearUser() {
        localStorage.removeItem('ob_user');
        localStorage.removeItem('ob_session');
    }

    // Get redirect URL
    getRedirectUrl() {
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        return window.location.origin + basePath + 'auth-callback.html';
    }

    // Google OAuth Login/Register
    async signInWithGoogle() {
        // [log removed for production]
        const { data, error } = await this.client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: this.getRedirectUrl()
            }
        });
        if (error) {
            console.error('Google sign in error:', error);
            throw error;
        }
        return data;
    }

    // Extract and store user data from Supabase session
    storeUserFromSession(session) {
        const user = session.user;
        const provider = user.app_metadata?.provider || 'oauth';

        const userData = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'مستخدم',
            picture: user.user_metadata?.avatar_url || user.user_metadata?.picture,
            provider: provider,
            created_at: user.created_at
        };

        localStorage.setItem('ob_user', JSON.stringify(userData));
        localStorage.setItem('ob_session', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at ? session.expires_at * 1000 : Date.now() + 3600000
        }));

        return userData;
    }

    // Save user to database
    async saveUserToDatabase(user, accessToken) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${accessToken || this.supabaseKey}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    provider: user.provider,
                    avatar_url: user.picture,
                    created_at: user.created_at || new Date().toISOString()
                })
            });
            if (!response.ok) {
                console.log('User may already exist');
            }
            return true;
        } catch (error) {
            console.error('Error saving user to database:', error);
            return false;
        }
    }

    // Sign out
    async signOut() {
        try {
            await this.client.auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            this.clearUser();
            window.location.href = 'index.html';
        }
    }

    // Get user ads from database
    async getUserAds(userId) {
        try {
            const session = JSON.parse(localStorage.getItem('ob_session') || '{}');
            const token = session.access_token || this.supabaseKey;
            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/ads?user_id=eq.${userId}&select=*&order=created_at.desc`,
                {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            if (!response.ok) throw new Error('فشل في تحميل الإعلانات');
            return await response.json();
        } catch (error) {
            console.error('Error fetching user ads:', error);
            return [];
        }
    }

    // Get user stats
    async getUserStats(userId) {
        try {
            const ads = await this.getUserAds(userId);
            const today = new Date();
            return {
                totalAds: ads.length,
                activeAds: ads.filter(ad => new Date(ad.expires_at) >= today && ['active', 'featured'].includes(ad.status)).length,
                featuredAds: ads.filter(ad => ad.status === 'featured').length,
                totalViews: ads.reduce((sum, ad) => sum + (ad.views || 0), 0),
                expiringSoon: ads.filter(ad => {
                    const daysLeft = Math.ceil((new Date(ad.expires_at) - today) / (1000 * 60 * 60 * 24));
                    return daysLeft > 0 && daysLeft <= APP_CONFIG.expiringAlertDays;
                }).length,
                expired: ads.filter(ad => new Date(ad.expires_at) < today || ad.status === 'expired').length
            };
        } catch (error) {
            console.error('Error calculating stats:', error);
            return { totalAds: 0, activeAds: 0, featuredAds: 0, totalViews: 0, expiringSoon: 0, expired: 0 };
        }
    }

    // Renew ad
    async renewAd(adId) {
        try {
            const session = JSON.parse(localStorage.getItem('ob_session') || '{}');
            const token = session.access_token || this.supabaseKey;
            const newExpiresAt = new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const response = await fetch(`${this.supabaseUrl}/rest/v1/ads?id=eq.${adId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ expires_at: newExpiresAt, status: 'active', renewed_at: new Date().toISOString() })
            });
            if (!response.ok) throw new Error('فشل في تجديد الإعلان');
            return true;
        } catch (error) {
            console.error('Error renewing ad:', error);
            throw error;
        }
    }

    // Delete ad
    async deleteAd(adId) {
        try {
            const session = JSON.parse(localStorage.getItem('ob_session') || '{}');
            const token = session.access_token || this.supabaseKey;
            const response = await fetch(`${this.supabaseUrl}/rest/v1/ads?id=eq.${adId}`, {
                method: 'DELETE',
                headers: { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('فشل في حذف الإعلان');
            return true;
        } catch (error) {
            console.error('Error deleting ad:', error);
            throw error;
        }
    }

    logout() { this.signOut(); }
}

// Initialize Auth manager
const Auth = new AuthManager();
window.Auth = Auth;

// [log removed for production]

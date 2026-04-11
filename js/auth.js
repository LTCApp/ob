/**
 * Authentication Module for OB - لأهل العبور
 * Handles Google and Facebook OAuth login/registration using Supabase Auth
 */

class AuthManager {
    constructor() {
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_ANON_KEY;
        this.provider = null;
        this.accessToken = null;
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

    // Store session token
    setSession(accessToken, refreshToken, expiresIn) {
        try {
            localStorage.setItem('ob_session', JSON.stringify({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: Date.now() + (expiresIn * 1000)
            }));
            this.accessToken = accessToken;
        } catch (e) {
            console.error('Error saving session:', e);
        }
    }

    // Get session token
    getSession() {
        try {
            const sessionStr = localStorage.getItem('ob_session');
            if (!sessionStr) return null;

            const session = JSON.parse(sessionStr);
            if (Date.now() > session.expires_at) {
                // Session expired
                this.clearUser();
                return null;
            }
            return session;
        } catch (e) {
            return null;
        }
    }

    // Clear user data (logout)
    clearUser() {
        localStorage.removeItem('ob_user');
        localStorage.removeItem('ob_session');
        this.accessToken = null;
    }

    // Google OAuth Login/Register - FIXED
    async signInWithGoogle(redirectUrl) {
        console.log('Google sign in initiated');

        // Use full URL path to handle GitHub Pages subdirectory correctly
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const redirectTo = `${window.location.origin}${basePath}auth-callback.html`;
        const state = btoa(JSON.stringify({ redirect: redirectUrl || 'dashboard.html' }));

        // Use GET redirect method for Supabase OAuth
        const authUrl = `${this.supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}&scopes=email%20profile`;

        // Redirect to Google OAuth
        window.location.href = authUrl;
    }

    // Facebook OAuth Login/Register - FIXED
    async signInWithFacebook(redirectUrl) {
        console.log('Facebook sign in initiated');

        // Use full URL path to handle GitHub Pages subdirectory correctly
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const redirectTo = `${window.location.origin}${basePath}auth-callback.html`;
        const state = btoa(JSON.stringify({ redirect: redirectUrl || 'dashboard.html' }));

        // Use GET redirect method for Supabase OAuth
        const authUrl = `${this.supabaseUrl}/auth/v1/authorize?provider=facebook&redirect_to=${encodeURIComponent(redirectTo)}&scopes=email%20public_profile`;

        // Redirect to Facebook OAuth
        window.location.href = authUrl;
    }

    // Save user to Supabase database
    async saveUserToDatabase(user, accessToken) {
        try {
            const userData = {
                id: user.id || user.sub,
                email: user.email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || user.name || 'مستخدم',
                provider: user.app_metadata?.provider || user.provider || 'google',
                avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || user.picture,
                created_at: new Date().toISOString()
            };

            const response = await fetch(`${this.supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${accessToken || this.supabaseKey}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(userData)
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
            // Call Supabase sign out endpoint
            const session = this.getSession();
            if (session) {
                await fetch(`${this.supabaseUrl}/auth/v1/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': this.supabaseKey
                    }
                });
            }
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
            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/ads?user_id=eq.${userId}&select=*&order=created_at.desc`,
                {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
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

            const stats = {
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

            return stats;
        } catch (error) {
            console.error('Error calculating stats:', error);
            return {
                totalAds: 0,
                activeAds: 0,
                featuredAds: 0,
                totalViews: 0,
                expiringSoon: 0,
                expired: 0
            };
        }
    }

    // Renew ad
    async renewAd(adId) {
        try {
            const newExpiresAt = new Date(Date.now() + APP_CONFIG.adDurationDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/ads?id=eq.${adId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    },
                    body: JSON.stringify({
                        expires_at: newExpiresAt,
                        status: 'active',
                        renewed_at: new Date().toISOString()
                    })
                }
            );

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
            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/ads?id=eq.${adId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`
                    }
                }
            );

            if (!response.ok) throw new Error('فشل في حذف الإعلان');

            return true;
        } catch (error) {
            console.error('Error deleting ad:', error);
            throw error;
        }
    }

    // Logout (alias for signOut)
    logout() {
        this.signOut();
    }
}

// Initialize Auth manager
const Auth = new AuthManager();

// Export for use in other pages
window.Auth = Auth;

console.log('Auth module loaded - Supabase Auth Ready');

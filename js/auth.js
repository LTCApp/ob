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

        // Listen for OAuth callback
        this.handleOAuthCallback();
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
    setSession(accessToken, refreshToken) {
        try {
            localStorage.setItem('ob_session', JSON.stringify({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: Date.now() + 3600000 // 1 hour
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

    // Handle OAuth callback from URL
    handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const code = urlParams.get('code');
        const type = urlParams.get('type'); // google, facebook
        const state = urlParams.get('state');

        if (error) {
            console.error('OAuth Error:', error);
            // Clean URL and show error
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (code && type) {
            // This is an OAuth callback
            console.log('OAuth callback received:', type);
            this.exchangeCodeForSession(code, type, state);
        }
    }

    // Exchange authorization code for session
    async exchangeCodeForSession(code, provider, state) {
        try {
            // Store the code temporarily
            sessionStorage.setItem('oauth_code', code);
            sessionStorage.setItem('oauth_provider', provider);
            sessionStorage.setItem('oauth_state', state);

            // For Supabase with external OAuth, we need to use the callback page
            // The code will be exchanged automatically by Supabase

            // Redirect to the callback handler
            window.location.href = `auth-callback.html?code=${code}&provider=${provider}&state=${state}`;
        } catch (error) {
            console.error('Error exchanging code:', error);
        }
    }

    // Google OAuth Login/Register
    async signInWithGoogle(redirectUrl) {
        console.log('Google sign in initiated');

        try {
            // Use Supabase Auth API for Google OAuth
            const redirectTo = `${window.location.origin}/auth-callback.html`;
            const state = btoa(JSON.stringify({ redirect: redirectUrl || 'dashboard.html' }));

            // Call Supabase Auth API
            const response = await fetch(`${this.supabaseUrl}/auth/v1/authorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                },
                body: JSON.stringify({
                    provider: 'google',
                    options: {
                        redirectTo: redirectTo,
                        scopes: 'email profile'
                    }
                })
            });

            if (!response.ok) {
                throw new Error('فشل في بدء تسجيل الدخول');
            }

            const data = await response.json();

            if (data.url) {
                // Redirect to Google OAuth
                window.location.href = data.url;
            } else {
                // Fallback: Open OAuth in popup or use alternative method
                this.openOAuthPopup('google', redirectUrl);
            }
        } catch (error) {
            console.error('Google OAuth Error:', error);
            // Fallback to popup method
            this.openOAuthPopup('google', redirectUrl);
        }
    }

    // Facebook OAuth Login/Register
    async signInWithFacebook(redirectUrl) {
        console.log('Facebook sign in initiated');

        try {
            // Use Supabase Auth API for Facebook OAuth
            const redirectTo = `${window.location.origin}/auth-callback.html`;
            const state = btoa(JSON.stringify({ redirect: redirectUrl || 'dashboard.html' }));

            const response = await fetch(`${this.supabaseUrl}/auth/v1/authorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                },
                body: JSON.stringify({
                    provider: 'facebook',
                    options: {
                        redirectTo: redirectTo,
                        scopes: 'email public_profile'
                    }
                })
            });

            if (!response.ok) {
                throw new Error('فشل في بدء تسجيل الدخول');
            }

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                this.openOAuthPopup('facebook', redirectUrl);
            }
        } catch (error) {
            console.error('Facebook OAuth Error:', error);
            this.openOAuthPopup('facebook', redirectUrl);
        }
    }

    // Open OAuth in popup window
    openOAuthPopup(provider, redirectUrl) {
        const width = 500;
        const height = 600;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);

        const state = btoa(JSON.stringify({ redirect: redirectUrl || 'dashboard.html' }));

        // Construct OAuth URL for popup
        const redirectTo = `${window.location.origin}/auth-callback.html`;
        const oauthUrl = `${this.supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}&state=${state}`;

        const popup = window.open(
            oauthUrl,
            `${provider}Auth`,
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        );

        // Listen for message from popup
        const messageHandler = (event) => {
            if (event.data && event.data.type === 'oauth_success') {
                // Get user data from event
                const userData = event.data.user;
                const sessionData = event.data.session;

                // Save to localStorage
                this.setUser({
                    id: userData.id,
                    email: userData.email,
                    name: userData.user_metadata?.full_name || userData.user_metadata?.name || 'مستخدم',
                    picture: userData.user_metadata?.avatar_url || userData.user_metadata?.picture,
                    provider: provider,
                    created_at: userData.created_at
                });

                if (sessionData) {
                    this.setSession(sessionData.access_token, sessionData.refresh_token);
                }

                // Save to database
                this.saveUserToDatabase(userData);

                // Close popup
                popup.close();

                // Remove listener
                window.removeEventListener('message', messageHandler);

                // Redirect
                const redirect = redirectUrl || 'dashboard.html';
                window.location.href = redirect;
            } else if (event.data && event.data.type === 'oauth_error') {
                console.error('OAuth Error:', event.data.error);
                popup.close();
                window.removeEventListener('message', messageHandler);
                throw new Error(event.data.error);
            }
        };

        window.addEventListener('message', messageHandler);

        // Check if popup was closed without completing
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', messageHandler);
            }
        }, 1000);
    }

    // Save user to Supabase database
    async saveUserToDatabase(user) {
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
                    'Authorization': `Bearer ${this.supabaseKey}`,
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

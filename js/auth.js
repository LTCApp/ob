/**
 * Authentication Module for OB - لأهل العبور
 * Handles Google and Facebook OAuth login/registration using Supabase Auth
 */

class AuthManager {
    constructor() {
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_ANON_KEY;
        this.accessToken = null;
    }

    // Get current user
    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('ob_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            console.error('Error getting user:', e);
            return null;
        }
    }

    // Check login
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    }

    // Save user
    setUser(user) {
        localStorage.setItem('ob_user', JSON.stringify(user));
    }

    // Save session
    setSession(session) {
        if (!session) return;

        localStorage.setItem('ob_session', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: Date.now() + (session.expires_in * 1000)
        }));

        this.accessToken = session.access_token;
    }

    // Get session
    getSession() {
        const sessionStr = localStorage.getItem('ob_session');
        if (!sessionStr) return null;

        const session = JSON.parse(sessionStr);
        if (Date.now() > session.expires_at) {
            this.clearUser();
            return null;
        }

        return session;
    }

    // Logout
    clearUser() {
        localStorage.removeItem('ob_user');
        localStorage.removeItem('ob_session');
        this.accessToken = null;
    }

    // ✅ Google Login (FIXED)
    async signInWithGoogle(redirectUrl) {
        console.log('Google login via Supabase');

        const redirectTo = `${window.location.origin}/auth-callback.html`;

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
                    ? `${redirectTo}?redirect=${encodeURIComponent(redirectUrl)}`
                    : redirectTo
            }
        });

        if (error) throw error;
    }

    // ✅ Facebook Login (FIXED)
    async signInWithFacebook(redirectUrl) {
        console.log('Facebook login via Supabase');

        const redirectTo = `${window.location.origin}/auth-callback.html`;

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: redirectUrl
                    ? `${redirectTo}?redirect=${encodeURIComponent(redirectUrl)}`
                    : redirectTo
            }
        });

        if (error) throw error;
    }

    // Save user in DB
    async saveUserToDatabase(user, accessToken) {
        try {
            const userData = {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || user.user_metadata?.name || 'مستخدم',
                provider: user.app_metadata?.provider || 'google',
                avatar_url: user.user_metadata?.avatar_url,
                created_at: new Date().toISOString()
            };

            await fetch(`${this.supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${accessToken}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(userData)
            });

            return true;
        } catch (error) {
            console.error('DB save error:', error);
            return false;
        }
    }

    // Logout
    async signOut() {
        try {
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
            console.error(error);
        }

        this.clearUser();
        window.location.href = 'index.html';
    }

    logout() {
        this.signOut();
    }
}

const Auth = new AuthManager();
window.Auth = Auth;

console.log('✅ Auth fixed & ready');

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/**
 * Authentication Module for OB - لأهل العبور
 * Handles Google and Facebook OAuth login/registration using Supabase Auth SDK
 */
class AuthManager {
    constructor() {
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_ANON_KEY;
        this.provider = null;
        this.accessToken = null;
        this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }

    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('ob_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            console.error('Error getting user:', e);
            return null;
        }
    }

    isLoggedIn() {
        return this.getCurrentUser() !== null;
    }

    setUser(user) {
        try {
            localStorage.setItem('ob_user', JSON.stringify(user));
        } catch (e) {
            console.error('Error saving user:', e);
        }
    }

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

    getSession() {
        try {
            const sessionStr = localStorage.getItem('ob_session');
            if (!sessionStr) return null;

            const session = JSON.parse(sessionStr);
            if (Date.now() > session.expires_at) {
                this.clearUser();
                return null;
            }
            return session;
        } catch (e) {
            return null;
        }
    }

    clearUser() {
        localStorage.removeItem('ob_user');
        localStorage.removeItem('ob_session');
        this.accessToken = null;
    }

    async signInWithGoogle(redirectUrl) {
        try {
            if (redirectUrl) {
                sessionStorage.setItem('ob_redirect_after_login', redirectUrl);
            }

            const basePath = window.location.pathname.substring(
                0,
                window.location.pathname.lastIndexOf('/') + 1
            );

            const redirectTo = `${window.location.origin}${basePath}auth-callback.html`;

            const { error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo
                }
            });

            if (error) throw error;
        } catch (error) {
            console.error('Google login failed:', error);
            throw error;
        }
    }

    async signInWithFacebook(redirectUrl) {
        try {
            if (redirectUrl) {
                sessionStorage.setItem('ob_redirect_after_login', redirectUrl);
            }

            const basePath = window.location.pathname.substring(
                0,
                window.location.pathname.lastIndexOf('/') + 1
            );

            const redirectTo = `${window.location.origin}${basePath}auth-callback.html`;

            const { error } = await this.supabase.auth.signInWithOAuth({
                provider: 'facebook',
                options: {
                    redirectTo
                }
            });

            if (error) throw error;
        } catch (error) {
            console.error('Facebook login failed:', error);
            throw error;
        }
    }

    async saveUserToDatabase(user, accessToken) {
        try {
            const userData = {
                id: user.id,
                email: user.email,
                name:
                    user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    user.email?.split('@')[0] ||
                    'مستخدم',
                provider: user.app_metadata?.provider || 'oauth',
                avatar_url:
                    user.user_metadata?.avatar_url ||
                    user.user_metadata?.picture ||
                    null,
                created_at: user.created_at || new Date().toISOString()
            };

            const response = await fetch(`${this.supabaseUrl}/rest/v1/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: this.supabaseKey,
                    Authorization: `Bearer ${accessToken}`,
                    Prefer: 'resolution=merge-duplicates'
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

    async signOut() {
        try {
            await this.supabase.auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            this.clearUser();
            window.location.href = 'index.html';
        }
    }

    logout() {
        this.signOut();
    }
}

const Auth = new AuthManager();
window.Auth = Auth;
console.log('Auth module loaded - Supabase Auth Ready');

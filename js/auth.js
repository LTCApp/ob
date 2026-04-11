/**
 * Authentication Module for OB - لأهل العبور
 * Fixed Supabase OAuth Implementation (Google + Facebook)
 */

class AuthManager {
    constructor() {
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_ANON_KEY;

        // Create Supabase client
        this.supabase = window.supabase.createClient(
            this.supabaseUrl,
            this.supabaseKey
        );

        this.handleSession();
    }

    // ======================
    // USER STATE
    // ======================

    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('ob_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            return null;
        }
    }

    isLoggedIn() {
        return this.getCurrentUser() !== null;
    }

    setUser(user) {
        localStorage.setItem('ob_user', JSON.stringify(user));
    }

    clearUser() {
        localStorage.removeItem('ob_user');
        localStorage.removeItem('ob_session');
    }

    // ======================
    // SESSION HANDLING
    // ======================

    async handleSession() {
        const { data } = await this.supabase.auth.getSession();

        if (data?.session) {
            const user = data.session.user;

            this.setUser({
                id: user.id,
                email: user.email,
                name:
                    user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    "مستخدم",
                picture:
                    user.user_metadata?.avatar_url ||
                    user.user_metadata?.picture,
                provider: user.app_metadata?.provider,
                created_at: user.created_at
            });
        }
    }

    // ======================
    // LOGIN WITH GOOGLE
    // ======================

    async signInWithGoogle(redirectUrl = 'dashboard.html') {
        const redirectTo = `${window.location.origin}/ob/auth-callback.html`;

        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo
            }
        });

        if (error) {
            console.error(error);
            alert("فشل تسجيل الدخول بـ Google");
        }
    }

    // ======================
    // LOGIN WITH FACEBOOK
    // ======================

    async signInWithFacebook(redirectUrl = 'dashboard.html') {
        const redirectTo = `${window.location.origin}/ob/auth-callback.html`;

        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo
            }
        });

        if (error) {
            console.error(error);
            alert("فشل تسجيل الدخول بـ Facebook");
        }
    }

    // ======================
    // CALLBACK PAGE HANDLING
    // ======================

    async handleOAuthCallback() {
        const { data, error } = await this.supabase.auth.getSession();

        if (error) {
            console.error("OAuth Error:", error);
            return;
        }

        if (data?.session) {
            const user = data.session.user;

            this.setUser({
                id: user.id,
                email: user.email,
                name:
                    user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    "مستخدم",
                picture:
                    user.user_metadata?.avatar_url ||
                    user.user_metadata?.picture,
                provider: user.app_metadata?.provider,
                created_at: user.created_at
            });

            window.location.href = "dashboard.html";
        }
    }

    // ======================
    // LOGOUT
    // ======================

    async signOut() {
        await this.supabase.auth.signOut();
        this.clearUser();
        window.location.href = "index.html";
    }

    logout() {
        this.signOut();
    }

    // ======================
    // USER ADS
    // ======================

    async getUserAds(userId) {
        const { data, error } = await this.supabase
            .from('ads')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            return [];
        }

        return data;
    }

    async getUserStats(userId) {
        const ads = await this.getUserAds(userId);
        const today = new Date();

        return {
            totalAds: ads.length,
            activeAds: ads.filter(ad =>
                new Date(ad.expires_at) >= today &&
                ['active', 'featured'].includes(ad.status)
            ).length,
            featuredAds: ads.filter(ad => ad.status === 'featured').length,
            totalViews: ads.reduce((sum, ad) => sum + (ad.views || 0), 0),
            expired: ads.filter(ad => new Date(ad.expires_at) < today).length
        };
    }

    // ======================
    // AD ACTIONS
    // ======================

    async renewAd(adId) {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + 30);

        const { error } = await this.supabase
            .from('ads')
            .update({
                expires_at: newDate.toISOString(),
                status: 'active'
            })
            .eq('id', adId);

        if (error) throw error;
        return true;
    }

    async deleteAd(adId) {
        const { error } = await this.supabase
            .from('ads')
            .delete()
            .eq('id', adId);

        if (error) throw error;
        return true;
    }
}

// ======================
// INIT
// ======================

const Auth = new AuthManager();
window.Auth = Auth;

console.log('Auth module loaded - Supabase OAuth FIXED');

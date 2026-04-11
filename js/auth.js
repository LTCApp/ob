/**
 * Authentication Module for OB - لأهل العبور
 * FIXED Supabase Auth (OAuth + Session + Ads Protection)
 */

class AuthManager {
    constructor() {
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_ANON_KEY;

        // Supabase client
        this.supabase = window.supabase.createClient(
            this.supabaseUrl,
            this.supabaseKey
        );

        this.currentUser = null;

        this.init();
    }

    // ======================
    // INIT SESSION
    // ======================

    async init() {
        const { data } = await this.supabase.auth.getSession();

        if (data?.session) {
            this.setUser(data.session.user);
        }
    }

    // ======================
    // USER HANDLING
    // ======================

    setUser(user) {
        this.currentUser = {
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
        };

        localStorage.setItem('ob_user', JSON.stringify(this.currentUser));
    }

    getCurrentUser() {
        return this.currentUser || JSON.parse(localStorage.getItem('ob_user'));
    }

    hasUser() {
        return !!this.getCurrentUser();
    }

    clearUser() {
        this.currentUser = null;
        localStorage.removeItem('ob_user');
    }

    // ======================
    // LOGIN GOOGLE
    // ======================

    async signInWithGoogle() {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/ob/auth-callback.html`
            }
        });

        if (error) {
            console.error(error);
            alert("فشل تسجيل الدخول بـ Google");
        }
    }

    // ======================
    // LOGIN FACEBOOK
    // ======================

    async signInWithFacebook() {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: `${window.location.origin}/ob/auth-callback.html`
            }
        });

        if (error) {
            console.error(error);
            alert("فشل تسجيل الدخول بـ Facebook");
        }
    }

    // ======================
    // CALLBACK HANDLER
    // ======================

    async handleOAuthCallback() {
        const { data, error } = await this.supabase.auth.getSession();

        if (error) {
            console.error(error);
            return;
        }

        if (data?.session) {
            this.setUser(data.session.user);
            window.location.href = "dashboard.html";
        } else {
            window.location.href = "login.html";
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
    // ADS FUNCTIONS
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

console.log('Auth module FIXED & READY');

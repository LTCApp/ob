// Supabase Configuration
const SUPABASE_URL = 'https://zcjqkexfaecozubfptod.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wMIbC1w3GjZnjv1vz8dEwg_2HsG0I17';

// App Configuration - will be loaded from Supabase
let APP_CONFIG = {
    siteName: 'OB',
    siteFullName: 'OB - لأهل العبور',
    location: 'العبور',
    whatsappNumber: '20',
    adDurationDays: 15,
    expiringAlertDays: 2,
    adsPerPage: 12,
    featuredAdPrice: 25,
    featuredDurationDays: 15,
    paymentInstapay: 'instapay@ob',
    paymentVodafone: '010xxxxxxxx',
    requireAdminApproval: true,
    logo: null,
    seo: {
        title: 'OB - منصة بيع وشراء محلية في العبور',
        description: 'منصة محلية لبيع وشراء السلع والخدمات بين سكان مدينة العبور، تتيتح للمستخدمين نشر الإعلانات بسهولة والتواصل المباشر عبر واتساب، مع تصفح منظم حسب الأقسام والمناطق لسرعة الوصول لأفضل العروض.',
        keywords: 'بيع, شراء, العبور, موبايلات, سيارات, عقارات, خدمات, إعلانات',
        author: 'OB Team',
        ogImage: '/images/og-image.jpg'
    }
};

// Categories - will be loaded from Supabase
let CATEGORIES = [];

// Neighborhoods - will be loaded from Supabase
let NEIGHBORHOODS = [];

// Ad Status
const AD_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    FEATURED: 'featured',
    EXPIRED: 'expired',
    REJECTED: 'rejected'
};

// Function to load settings from Supabase
async function loadSiteSettings() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=*&limit=1`, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                const settings = data[0];
                APP_CONFIG = {
                    ...APP_CONFIG,
                    siteName: settings.site_name || APP_CONFIG.siteName,
                    siteFullName: settings.site_full_name || APP_CONFIG.siteFullName,
                    logo: settings.logo || null,
                    adDurationDays: settings.ad_duration_days || 15,
                    expiringAlertDays: settings.expiring_alert_days || 2,
                    featuredAdPrice: settings.featured_ad_price || 25,
                    featuredDurationDays: settings.featured_duration_days || 15,
                    paymentInstapay: settings.payment_instapay || '',
                    paymentVodafone: settings.payment_vodafone || '',
                    seo: {
                        ...APP_CONFIG.seo,
                        title: settings.seo_title || APP_CONFIG.seo.title,
                        description: settings.seo_description || APP_CONFIG.seo.description,
                        keywords: settings.seo_keywords || APP_CONFIG.seo.keywords
                    }
                };
                
                // Save to localStorage for quick access
                localStorage.setItem('ob_settings', JSON.stringify(APP_CONFIG));
                
                // Update page title and logo if elements exist
                updateSiteBranding();
            }
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
        // Try to load from localStorage
        const saved = localStorage.getItem('ob_settings');
        if (saved) {
            try {
                APP_CONFIG = { ...APP_CONFIG, ...JSON.parse(saved) };
            } catch(e) {}
        }
    }
}

// Function to load categories from Supabase
async function loadCategories() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=*&order=order_index.asc`, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                CATEGORIES = data.map(cat => ({
                    id: cat.id,
                    name: cat.name_ar,
                    icon: cat.icon || '📌',
                    logo: cat.logo || null,
                    count: 0
                }));
                localStorage.setItem('ob_categories', JSON.stringify(CATEGORIES));
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Try to load from localStorage
        const saved = localStorage.getItem('ob_categories');
        if (saved) {
            try {
                CATEGORIES = JSON.parse(saved);
            } catch(e) {}
        }
    }
}

// Function to load neighborhoods from Supabase
async function loadNeighborhoods() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/neighborhoods?select=*&order=name_ar.asc`, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                NEIGHBORHOODS = data.map(n => n.name_ar);
                localStorage.setItem('ob_neighborhoods', JSON.stringify(NEIGHBORHOODS));
            }
        }
    } catch (error) {
        console.error('Error loading neighborhoods:', error);
        // Try to load from localStorage
        const saved = localStorage.getItem('ob_neighborhoods');
        if (saved) {
            try {
                NEIGHBORHOODS = JSON.parse(saved);
            } catch(e) {}
        }
    }
}

// Update site branding on all pages
function updateSiteBranding() {
    // Update page title
    if (APP_CONFIG.siteFullName) {
        document.title = document.title.replace('OB', APP_CONFIG.siteName);
    }
    
    // Update logo in header
    const logoSpans = document.querySelectorAll('.logo span');
    logoSpans.forEach(span => {
        span.textContent = APP_CONFIG.siteName || 'OB';
    });
    
    // Update logo images if custom logo exists
    if (APP_CONFIG.logo) {
        const logoImgs = document.querySelectorAll('.logo img');
        logoImgs.forEach(img => {
            img.src = APP_CONFIG.logo;
        });
    }
    
    // Update hero title if exists
    const heroTitle = document.querySelector('.hero-content h1');
    if (heroTitle) {
        heroTitle.textContent = APP_CONFIG.siteFullName || 'OB - لأهل العبور';
    }
}

// Initialize data on page load
async function initializeAppData() {
    await Promise.all([
        loadSiteSettings(),
        loadCategories(),
        loadNeighborhoods()
    ]);
    
    // Dispatch event when data is loaded
    window.dispatchEvent(new CustomEvent('appDataLoaded'));
}

// Start loading immediately
initializeAppData();

console.log('Config loaded - Data will be fetched from Supabase');
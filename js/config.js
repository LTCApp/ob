// Supabase Configuration
const SUPABASE_URL = 'https://zcjqkexfaecozubfptod.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wMIbC1w3GjZnjv1vz8dEwg_2HsG0I17';

// App Configuration - will be loaded from Supabase
let APP_CONFIG = {
    siteName: 'OB - لأهل العبور',
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
        description: 'منصة محلية لبيع وشراء السلع والخدمات بين سكان مدينة العبور، تتيح للمستخدمين نشر الإعلانات بسهولة والتواصل المباشر عبر واتساب، مع تصفح منظم حسب الأقسام والمناطق لسرعة الوصول لأفضل العروض.',
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
                    siteFullName: settings.site_full_name || settings.site_name || APP_CONFIG.siteFullName,
                    logo: settings.logo || null,
                    favicon: settings.favicon || null,
                    adDurationDays: settings.ad_duration_days || 15,
                    expiringAlertDays: settings.expiring_alert_days || 2,
                    featuredAdPrice: settings.featured_ad_price || 25,
                    featuredDurationDays: settings.featured_duration_days || 15,
                    paymentInstapay: settings.payment_instapay || '',
                    paymentVodafone: settings.payment_vodafone || '',
                    seo: {
                        ...APP_CONFIG.seo,
                        title: settings.site_full_name || settings.site_name || APP_CONFIG.seo.title,
                        description: settings.description || settings.seo_description || APP_CONFIG.seo.description,
                        keywords: settings.keywords || settings.seo_keywords || APP_CONFIG.seo.keywords,
                        author: settings.seo_author || APP_CONFIG.seo.author,
                        ogImage: settings.og_image || APP_CONFIG.seo.ogImage
                    }
                };
                
                // Update page title and logo if elements exist
                updateSiteBranding();
            }
        }
    } catch (error) {
        console.error('Error loading site settings:', error);
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
                    name: cat.name_ar || cat.name || String(cat.id || '').replace(/[_-]?\d{8,}$/, ''),
                    icon: cat.icon || '',
                    logo: cat.logo || cat.image_url || cat.image || null,
                    count: 0
                }));
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
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
            }
        }
    } catch (error) {
        console.error('Error loading neighborhoods:', error);
    }
}

// Update site branding on all pages
function updateSiteBranding(settings = null) {
    const config = settings || APP_CONFIG;
    
    // Update page title
    if (config.siteFullName) {
        const titleEl = document.querySelector('title');
        if (titleEl) {
            titleEl.textContent = config.siteFullName + ' | منصة بيع وشراء محلية';
        }
    }
    
    // Update logo text in header
    const logoSpans = document.querySelectorAll('.logo span');
    logoSpans.forEach(span => {
        span.textContent = config.siteName || 'OB';
    });
    
    // Update logo images if custom logo exists
    if (config.logo) {
        const logoImgs = document.querySelectorAll('.logo img');
        logoImgs.forEach(img => {
            img.src = config.logo;
        });
    }
    
    // Update hero title if exists
    const heroTitle = document.querySelector('.hero-content h1');
    if (heroTitle) {
        heroTitle.textContent = config.siteFullName || 'OB - لأهل العبور';
    }
    
    // Update hero description if exists
    const heroDesc = document.querySelector('.hero-content p');
    if (heroDesc && config.seo && config.seo.description) {
            heroDesc.textContent = config.seo.description;
    }
    
    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
    }
    if (config.seo && config.seo.description) {
        metaDesc.setAttribute('content', config.seo.description);
    }
    
    // Update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.name = 'keywords';
        document.head.appendChild(metaKeywords);
    }
    if (config.seo && config.seo.keywords) {
        metaKeywords.setAttribute('content', config.seo.keywords);
    }
    
    // Update favicon dynamically
    if (config.favicon) {
        let faviconLink = document.querySelector('link[rel="icon"]');
        if (!faviconLink) {
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            document.head.appendChild(faviconLink);
        }
        faviconLink.href = config.favicon;
    }
    
    // Update OG meta tags for social sharing
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', config.siteFullName || config.siteName || 'OB');
    
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
    }
    if (config.seo && config.seo.description) {
        ogDesc.setAttribute('content', config.seo.description);
    }
    
    // Update footer brand text
    const footerBrandP = document.querySelector('.footer-brand p');
    if (footerBrandP) {
        footerBrandP.textContent = 'منصة شراء وبيع محلية لأهلي مدينة العبور';
    }
    
    // Update footer copyright
    const footerCopyright = document.querySelector('.footer-bottom p');
    if (footerCopyright) {
        const year = new Date().getFullYear();
        footerCopyright.textContent = `© ${year} ${config.siteName || 'OB'} - لأهل العبور. جميع الحقوق محفوظة.`;
    }
    
    // Update admin sidebar logo text
    const adminLogoSpan = document.querySelector('.admin-sidebar-logo span');
    if (adminLogoSpan) {
        adminLogoSpan.textContent = (config.siteName || 'OB') + ' Admin';
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

// [log removed for production]
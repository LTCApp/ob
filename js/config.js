// Supabase Configuration
const SUPABASE_URL = 'https://zcjqkexfaecozubfptod.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wMIbC1w3GjZnjv1vz8dEwg_2HsG0I17';

// Load saved settings from admin panel
const _savedSettings = JSON.parse(localStorage.getItem('ob_settings') || '{}');

// App Configuration
const APP_CONFIG = {
    siteName: 'OB',
    siteFullName: 'OB - لأهل العبور',
    location: 'العبور',
    whatsappNumber: '20',
    adDurationDays: _savedSettings.adDurationDays || 15,
    expiringAlertDays: _savedSettings.expiringAlertDays || 2,
    adsPerPage: 12,
    featuredAdPrice: _savedSettings.featuredAdPrice || 25,
    featuredDurationDays: _savedSettings.featuredDurationDays || 15,
    paymentInstapay: _savedSettings.paymentInstapay || 'instapay@ob',
    paymentVodafone: _savedSettings.paymentVodafone || '010xxxxxxxx',
    adminEmails: ['admin@ob.com'],
    requireAdminApproval: true,
    seo: {
        title: 'OB - منصة بيع وشراء محلية في العبور',
        description: 'منصة محلية لبيع وشراء السلع والخدمات بين سكان مدينة العبور، تتيح للمستخدمين نشر الإعلانات بسهولة والتواصل المباشر عبر واتساب، مع تصفح منظم حسب الأقسام والمناطق لسرعة الوصول لأفضل العروض.',
        keywords: 'بيع, شراء, العبور, موبايلات, سيارات, عقارات, خدمات, إعلانات',
        author: 'OB Team',
        ogImage: '/images/og-image.jpg'
    }
};

// Categories
const CATEGORIES = [
    { id: 'mobiles', name: 'موبايلات', icon: 'phone', count: 0 },
    { id: 'cars', name: 'سيارات', icon: 'car', count: 0 },
    { id: 'real-estate', name: 'عقارات', icon: 'home', count: 0 },
    { id: 'electronics', name: 'أجهزة', icon: 'laptop', count: 0 },
    { id: 'services', name: 'خدمات', icon: 'tool', count: 0 }
];

// Neighborhoods - loaded from localStorage (set by admin) or defaults
function getNeighborhoods() {
    const saved = localStorage.getItem('ob_neighborhoods');
    if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
    }
    return [
        'الحي الأول', 'الحي الثاني', 'الحي الثالث', 'الحي الرابع', 'الحي الخامس',
        'الحي السادس', 'الحي السابع', 'الحي الثامن', 'الحي التاسع', 'الحي العاشر',
        'المنطقة الصناعية', 'المراكز التجارية'
    ];
}
const NEIGHBORHOODS = getNeighborhoods();

// Ad Status
const AD_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    FEATURED: 'featured',
    EXPIRED: 'expired',
    REJECTED: 'rejected'
};

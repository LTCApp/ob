// Main Application Logic

// Utility Functions
function formatPrice(price) {
    return new Intl.NumberFormat('ar-EG').format(price) + ' ج.م';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getDaysUntilExpiry(expiresAt) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiresAt);
    expiry.setHours(0, 0, 0, 0);
    const diff = expiry - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isExpiringSoon(expiresAt) {
    return getDaysUntilExpiry(expiresAt) <= APP_CONFIG.expiringAlertDays;
}

function getWhatsAppLink(number, message = '') {
    const cleanNumber = number.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(title, content, actions = []) {
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close" onclick="closeModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
                ${actions.map(a => `<button class="btn ${a.class || ''}" onclick="${a.onClick}">${a.text}</button>`).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    return modal;
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

// Create Ad Card HTML
function createAdCard(ad) {
    const daysLeft = getDaysUntilExpiry(ad.expires_at);
    const isExpiring = isExpiringSoon(ad.expires_at);
    const placeholder = ad.images && ad.images.length > 0
        ? `<img src="${ad.images[0]}" alt="${ad.title}">`
        : `<div class="placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
           </div>`;

    return `
        <article class="ad-card" data-id="${ad.id}">
            <a href="ad-detail.html?id=${ad.id}" class="ad-card-link">
                <div class="ad-card-image">
                    ${placeholder}
                    ${isExpiring ? `<span class="ad-card-badge expiring">ينتهي خلال ${daysLeft} يوم</span>` : ''}
                </div>
                <div class="ad-card-content">
                    <h3 class="ad-card-title">${ad.title}</h3>
                    <p class="ad-card-price">${formatPrice(ad.price)}</p>
                    <div class="ad-card-location">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>${ad.neighborhood || APP_CONFIG.location}</span>
                    </div>
                </div>
            </a>
            <div class="ad-card-actions">
                <a href="ad-detail.html?id=${ad.id}" class="btn btn-secondary btn-sm">التفاصيل</a>
                <a href="${getWhatsAppLink(ad.whatsapp, `مرحباً، أريد الاستفسار عن: ${ad.title}`)}"
                   target="_blank"
                   class="btn btn-whatsapp btn-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                </a>
            </div>
        </article>
    `;
}

// Render empty state
function renderEmptyState(container, message = 'لا توجد إعلانات حالياً') {
    container.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <h3>لا توجد نتائج</h3>
            <p>${message}</p>
        </div>
    `;
}

// Page Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize mobile menu
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.getElementById('nav');

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('show');
            menuToggle.setAttribute('aria-expanded', nav.classList.contains('show'));
        });
    }

    // Initialize search form on homepage
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput.value.trim()) {
                window.location.href = `ads.html?search=${encodeURIComponent(searchInput.value.trim())}`;
            }
        });
    }

    // Load recent ads on homepage
    const recentAdsContainer = document.getElementById('recentAds');
    if (recentAdsContainer) {
        try {
            const ads = await supabase.getAds({ limit: 8 });

            if (ads.length > 0) {
                recentAdsContainer.innerHTML = ads.map(ad => createAdCard(ad)).join('');
            } else {
                renderEmptyState(recentAdsContainer, 'لا توجد إعلانات حالياً. كن أول من يضيف إعلان!');
            }
        } catch (error) {
            console.error('Error loading ads:', error);
            recentAdsContainer.innerHTML = `
                <div class="empty-state">
                    <p>حدث خطأ في تحميل الإعلانات</p>
                    <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
                </div>
            `;
        }
    }
});

// Export for use in other pages
window.App = {
    formatPrice,
    formatDate,
    getDaysUntilExpiry,
    isExpiringSoon,
    getWhatsAppLink,
    showToast,
    showModal,
    closeModal,
    createAdCard,
    renderEmptyState,
    supabase,
    CATEGORIES,
    NEIGHBORHOODS,
    APP_CONFIG
};

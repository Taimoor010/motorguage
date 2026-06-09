/* ======================================================
   MotorGuage — Analytics Event Layer
   ====================================================== */

(function () {
    'use strict';

    const SITE_BRAND = 'MotorGuage';
    const MAX_STRING_LENGTH = 96;
    const MAX_PARAMS = 24;

    function pageType() {
        if (document.body?.dataset?.pageType) return document.body.dataset.pageType;
        if (window.location.pathname.includes('market-insights')) return 'market_insights';
        return 'price_estimator';
    }

    function cleanEventName(name) {
        return String(name || 'custom_event')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40) || 'custom_event';
    }

    function cleanParamName(name) {
        return String(name || 'param')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40) || 'param';
    }

    function cleanParamValue(value) {
        if (value === undefined || value === null || value === '') return undefined;
        if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        return String(value).slice(0, MAX_STRING_LENGTH);
    }

    function cleanParams(params) {
        const base = {
            page_type: pageType(),
            page_path: window.location.pathname,
            site_brand: SITE_BRAND,
        };
        const output = {};
        const merged = Object.assign({}, base, params || {});

        Object.entries(merged).slice(0, MAX_PARAMS).forEach(([key, value]) => {
            const cleanedValue = cleanParamValue(value);
            if (cleanedValue !== undefined) {
                output[cleanParamName(key)] = cleanedValue;
            }
        });

        return output;
    }

    function track(eventName, params = {}) {
        const cleanedName = cleanEventName(eventName);
        const payload = cleanParams(params);

        if (typeof window.gtag === 'function') {
            window.gtag('event', cleanedName, payload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(['event', cleanedName, payload]);
    }

    function mileageBucket(value) {
        const mileage = Number(value);
        if (!Number.isFinite(mileage)) return undefined;
        if (mileage < 10000) return '0_10k';
        if (mileage < 30000) return '10k_30k';
        if (mileage < 60000) return '30k_60k';
        if (mileage < 100000) return '60k_100k';
        if (mileage < 150000) return '100k_150k';
        if (mileage < 250000) return '150k_250k';
        return '250k_plus';
    }

    function priceBucket(value) {
        const price = Number(value);
        if (!Number.isFinite(price)) return undefined;
        if (price < 1000000) return 'under_10_lakh';
        if (price < 2500000) return '10_25_lakh';
        if (price < 5000000) return '25_50_lakh';
        if (price < 10000000) return '50_lakh_1_crore';
        if (price < 20000000) return '1_2_crore';
        return '2_crore_plus';
    }

    function readableText(element) {
        const text = element?.textContent?.trim().replace(/\s+/g, ' ');
        return text || element?.getAttribute?.('aria-label') || element?.id || element?.className || 'unknown';
    }

    function handleDocumentClick(event) {
        const link = event.target.closest('a');
        if (link) {
            track('site_link_clicked', {
                link_text: readableText(link),
                link_url: link.href,
                link_target: link.getAttribute('href'),
            });
            return;
        }

        const button = event.target.closest('button');
        if (button && !button.classList.contains('color-option') && !button.classList.contains('tab-btn')) {
            track('site_button_clicked', {
                button_text: readableText(button),
                button_id: button.id,
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        track('site_page_viewed');
        document.addEventListener('click', handleDocumentClick, true);
    });

    window.MotorGuageAnalytics = {
        event: track,
        mileageBucket,
        priceBucket,
    };
})();

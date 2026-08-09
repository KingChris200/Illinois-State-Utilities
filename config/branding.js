const DEFAULT_ASSET_BASE_URL =
    'https://raw.githubusercontent.com/KingChris200/Illinois-State-Utilities/main/assets';
const assetBaseUrl = String(
    process.env.ISRP_ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL
).replace(/\/+$/, '');

function assetUrl(relativePath) {
    return `${assetBaseUrl}/${String(relativePath).replace(/^\/+/, '')}`;
}

const assets = {
    logo: assetUrl('branding/isrp-logo-clean.jpg'),
    logoDark: assetUrl('branding/isrp-logo-dark.jpg'),
    logoSilver: assetUrl('branding/isrp-logo-silver.jpg'),
    wordmark: assetUrl('branding/isrp-wordmark.jpg'),
    robloxAvatar: assetUrl(
        'branding/isrp-roblox-avatar.jpg'
    ),
    sessionBanner: assetUrl(
        'thumbnails/session-started.png'
    ),
    welcomeBanner: assetUrl(
        'thumbnails/welcome-banner.png'
    ),
    staffGuideBanner: assetUrl(
        'thumbnails/staff-guide-banner-v2.png'
    ),
};

module.exports = {
    utilities: {
        name: 'Illinois State Utilities',
        shortName: 'IS Utilities',
        color: '#0A4D8C',
        logo: assets.logo,
        wordmark: assets.wordmark,
        footer:
            'Illinois State Utilities • Supporting Illinois State Roleplay',
    },

    isp: {
        name: 'Illinois State Police',
        shortName: 'ISP',
        color: '#002D5B',

        // Keep department branding neutral until an official ISP badge
        // asset is supplied; using the ISRP community logo here would
        // incorrectly present it as the police department badge.
        logo: process.env.ISP_BRAND_LOGO_URL || null,

        footer:
            'Illinois State Police • Integrity • Service • Pride',
    },

    isrp: {
        name: 'Illinois State Roleplay',
        shortName: 'ISRP',
        color: '#1E90FF',
        logo: assets.logo,
        wordmark: assets.wordmark,
        footer:
            'Illinois State Utilities • Supporting Illinois State Roleplay',
    },

    assets,
    assetBaseUrl,
    assetUrl,
    DEFAULT_ASSET_BASE_URL,
};

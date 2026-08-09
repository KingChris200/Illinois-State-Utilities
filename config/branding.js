const DEFAULT_ASSET_BASE_URL =
    'https://raw.githubusercontent.com/KingChris200/Illinois-State-Utilities/main/assets';
const assetBaseUrl = String(
    process.env.ISRP_ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL
).replace(/\/+$/, '');

function assetUrl(relativePath) {
    return `${assetBaseUrl}/${String(relativePath).replace(/^\/+/, '')}`;
}

const assets = {
    logo: assetUrl('branding/v2/isrp-bot-icon-v2.png'),
    logoDark: assetUrl('branding/v2/isrp-logo-dark-v2.png'),
    logoLight: assetUrl('branding/v2/isrp-logo-light-v2.png'),
    logoSilver: assetUrl('branding/v2/isrp-mark-white-v2.png'),
    logoPrimary: assetUrl(
        'branding/v2/isrp-logo-primary-v2.png'
    ),
    circularBadge: assetUrl(
        'branding/v2/isrp-circular-badge-v2.png'
    ),
    markWhite: assetUrl(
        'branding/v2/isrp-mark-white-v2.png'
    ),
    markNavy: assetUrl(
        'branding/v2/isrp-mark-navy-v2.png'
    ),
    wordmark: assetUrl(
        'branding/v2/isrp-wordmark-white-v2.png'
    ),
    wordmarkNavy: assetUrl(
        'branding/v2/isrp-wordmark-navy-v2.png'
    ),
    watermark: assetUrl(
        'branding/v2/isrp-watermark-white-v2.png'
    ),
    robloxAvatar: assetUrl(
        'branding/isrp-roblox-avatar.jpg'
    ),
    sessionBanner: assetUrl(
        'thumbnails/sessions-banner-v2.png'
    ),
    welcomeBanner: assetUrl(
        'thumbnails/welcome-banner-v2.png'
    ),
    staffGuideBanner: assetUrl(
        'thumbnails/staff-guide-banner-v3.png'
    ),
    assistanceBanner: assetUrl(
        'thumbnails/assistance-banner-v2.png'
    ),
    announcementBanner: assetUrl(
        'thumbnails/announcements-banner-v1.png'
    ),
    aboutBanner: assetUrl('thumbnails/about-banner-v1.png'),
    dashboardBanner: assetUrl(
        'thumbnails/dashboard-banner-v1.png'
    ),
};

const palette = {
    white: '#FFFFFF',
    ice: '#F4F9FF',
    lightBlue: '#8FC7FF',
    skyBlue: '#6FAFEF',
    softNavy: '#284B7A',
    slate: '#667085',
};

module.exports = {
    utilities: {
        name: 'Illinois State Utilities',
        shortName: 'IS Utilities',
        color: palette.lightBlue,
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
        color: palette.lightBlue,
        logo: assets.logo,
        wordmark: assets.wordmark,
        footer:
            'Illinois State Utilities • Supporting Illinois State Roleplay',
    },

    assets,
    palette,
    assetBaseUrl,
    assetUrl,
    DEFAULT_ASSET_BASE_URL,
};

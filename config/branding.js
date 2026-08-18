const DEFAULT_ASSET_BASE_URL =
    'https://raw.githubusercontent.com/KingChris200/Illinois-State-Utilities/main/assets';
const assetBaseUrl = String(
    process.env.ISRP_ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL
).replace(/\/+$/, '');

function assetUrl(relativePath) {
    return `${assetBaseUrl}/${String(relativePath).replace(/^\/+/, '')}`;
}

const assets = {
    logo: assetUrl('branding/v3/isrp-emblem-silver-v3.jpg'),
    logoDark: assetUrl('branding/v3/isrp-emblem-muted-v3.jpg'),
    logoLight: assetUrl('branding/v3/isrp-wordmark-light-v3.jpg'),
    logoSilver: assetUrl('branding/v3/isrp-emblem-modern-v3.jpg'),
    logoPrimary: assetUrl(
        'branding/v3/isrp-emblem-silver-v3.jpg'
    ),
    circularBadge: assetUrl(
        'branding/v3/isrp-emblem-modern-v3.jpg'
    ),
    markWhite: assetUrl(
        'branding/v3/isrp-emblem-modern-v3.jpg'
    ),
    markNavy: assetUrl(
        'branding/v3/isrp-wordmark-light-v3.jpg'
    ),
    wordmark: assetUrl(
        'branding/v3/isrp-wordmark-dark-v3.jpg'
    ),
    wordmarkNavy: assetUrl(
        'branding/v3/isrp-wordmark-light-v3.jpg'
    ),
    watermark: assetUrl(
        'branding/v3/isrp-emblem-muted-v3.jpg'
    ),
    panelSignature: assetUrl(
        'branding/v3/isrp-wordmark-dark-v3.jpg'
    ),
    panelSignatureLight: assetUrl(
        'branding/v3/isrp-wordmark-light-v3.jpg'
    ),
    robloxAvatar: assetUrl(
        'branding/isrp-roblox-avatar.jpg'
    ),
    sessionBanner: assetUrl(
        'thumbnails/sessions-banner-v3.png'
    ),
    welcomeBanner: assetUrl(
        'thumbnails/welcome-banner-v3.png'
    ),
    staffGuideBanner: assetUrl(
        'thumbnails/staff-guide-banner-v4.png'
    ),
    assistanceBanner: assetUrl(
        'thumbnails/assistance-banner-v3.png'
    ),
    announcementBanner: assetUrl(
        'thumbnails/announcements-banner-v2.png'
    ),
    aboutBanner: assetUrl('thumbnails/about-banner-v2.png'),
    informationBanner: assetUrl(
        'thumbnails/information-banner-v2.png'
    ),
    regulationsBanner: assetUrl(
        'thumbnails/regulations-banner-v2.png'
    ),
    dashboardBanner: assetUrl(
        'thumbnails/dashboard-banner-v2.png'
    ),
    avatar01: assetUrl('avatars/isrp-avatar-01.jpg'),
    avatar02: assetUrl('avatars/isrp-avatar-02.jpg'),
    avatar03: assetUrl('avatars/isrp-avatar-03.jpg'),
    avatar04: assetUrl('avatars/isrp-avatar-04.jpg'),
    avatar05: assetUrl('avatars/isrp-avatar-05.jpg'),
    avatar06: assetUrl('avatars/isrp-avatar-06.jpg'),
    avatar07: assetUrl('avatars/isrp-avatar-07.jpg'),
};

const palette = {
    white: '#FFFFFF',
    paper: '#FCFEFF',
    ice: '#F7FBFF',
    mist: '#EAF4FF',
    lightBlue: '#B9DCFF',
    skyBlue: '#86BEF2',
    softNavy: '#173E71',
    slate: '#617085',
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

const brands = require('../config/branding');

const EMBED_TONES = Object.freeze({
    info: null,
    success: '#2ECC71',
    warning: '#F1C40F',
    danger: '#E74C3C',
    moderation: '#C0392B',
    neutral: '#D7E6F5',
});

function safeImageUrl(factory) {
    try {
        const value = factory?.();
        return typeof value === 'string' && value.length > 0
            ? value
            : null;
    } catch {
        return null;
    }
}

function getGuildIcon(guild) {
    return safeImageUrl(() =>
        guild?.iconURL?.({
            extension: 'png',
            size: 256,
        })
    );
}

function getDisplayAvatar(subject) {
    return safeImageUrl(() => {
        if (typeof subject?.displayAvatarURL === 'function') {
            return subject.displayAvatarURL({ size: 256 });
        }

        return subject?.user?.displayAvatarURL?.({ size: 256 });
    });
}

function getClientAvatar(client) {
    return getDisplayAvatar(client?.user);
}

function applyEmbedTheme(
    embed,
    {
        brandName = 'utilities',
        guild = null,
        client = null,
        subject = null,
        tone = 'info',
        authorName = null,
        footerText = null,
        thumbnail = 'auto',
        bannerUrl = null,
    } = {}
) {
    const brand = brands[brandName] || brands.utilities;
    const subjectAvatar = getDisplayAvatar(subject);
    const toneColor = EMBED_TONES[tone];

    embed.setColor(toneColor || brand.color);

    const resolvedAuthorName =
        authorName || guild?.name || brand.name;
    if (resolvedAuthorName) {
        embed.setAuthor({
            name: resolvedAuthorName,
        });
    }

    let thumbnailUrl = null;

    if (thumbnail === 'auto') {
        thumbnailUrl = subjectAvatar;
    } else if (thumbnail === 'subject') {
        thumbnailUrl = subjectAvatar;
    } else if (thumbnail === 'server') {
        thumbnailUrl = getGuildIcon(guild);
    } else if (thumbnail === 'brand') {
        thumbnailUrl = brand.logo;
    } else if (typeof thumbnail === 'string') {
        thumbnailUrl = thumbnail;
    }

    if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
    }

    const resolvedFooterText = footerText || brand.footer;

    if (resolvedFooterText) {
        embed.setFooter({
            text: resolvedFooterText,
        });
    }

    if (bannerUrl) {
        embed.setImage(bannerUrl);
    }

    return embed;
}

module.exports = {
    EMBED_TONES,
    applyEmbedTheme,
    getClientAvatar,
    getDisplayAvatar,
    getGuildIcon,
};

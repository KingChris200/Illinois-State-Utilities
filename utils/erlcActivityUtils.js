const DEFAULT_ACTIVITY_COUNT = 5;
const MAX_ACTIVITY_COUNT = 10;

function parseActivityCount(value) {
    if (value === undefined) {
        return DEFAULT_ACTIVITY_COUNT;
    }

    if (!/^\d+$/.test(value)) {
        return null;
    }

    const count = Number(value);
    return count >= 1 && count <= MAX_ACTIVITY_COUNT
        ? count
        : null;
}

function parsePlayerIdentity(value) {
    const text = String(value || 'Unknown');
    const separatorIndex = text.lastIndexOf(':');

    if (separatorIndex === -1) {
        return {
            username: cleanMarkdownText(text, 40),
            userId: null,
        };
    }

    return {
        username: cleanMarkdownText(
            text.slice(0, separatorIndex),
            40
        ),
        userId: cleanMarkdownText(
            text.slice(separatorIndex + 1),
            24
        ),
    };
}

function formatPlayerIdentity(player) {
    return player.userId
        ? `**${player.username}** · \`${player.userId}\``
        : `**${player.username}**`;
}

function formatRelativeTime(value) {
    const timestamp = Number(value);
    return Number.isInteger(timestamp) && timestamp > 0
        ? `<t:${timestamp}:R>`
        : 'Unknown time';
}

function sortNewest(records) {
    return [...records].sort(
        (first, second) =>
            Number(second?.Timestamp || 0) -
            Number(first?.Timestamp || 0)
    );
}

function cleanMarkdownText(value, maximumLength) {
    return String(value || 'Unknown')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[*_~`|>\\]/g, '\\$&')
        .slice(0, maximumLength);
}

function cleanInlineCode(value, maximumLength) {
    return String(value || 'Unknown')
        .replace(/[\r\n]+/g, ' ')
        .replace(/`/g, "'")
        .slice(0, maximumLength);
}

module.exports = {
    cleanInlineCode,
    cleanMarkdownText,
    formatPlayerIdentity,
    formatRelativeTime,
    parseActivityCount,
    parsePlayerIdentity,
    sortNewest,
};

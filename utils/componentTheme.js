const {
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} = require('discord.js');

const brands = require('../config/branding');

function colorToDecimal(color = brands.palette.lightBlue) {
    if (Number.isInteger(color)) {
        return color;
    }

    const normalized = String(color || '')
        .trim()
        .replace(/^#/, '');

    return /^[0-9a-f]{6}$/i.test(normalized)
        ? Number.parseInt(normalized, 16)
        : 0xb9dcff;
}

function createPanelSeparator(
    spacing = SeparatorSpacingSize.Large
) {
    return new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(spacing);
}

function createPanelHeader({
    eyebrow = 'ILLINOIS STATE ROLEPLAY',
    title,
    description,
    note = null,
}) {
    const lines = [
        `-# **${eyebrow}**`,
        `# ${title}`,
        description ? `**${description}**` : null,
        note ? `-# ${note}` : null,
    ].filter(Boolean);

    return new TextDisplayBuilder().setContent(lines.join('\n\n'));
}

module.exports = {
    colorToDecimal,
    createPanelHeader,
    createPanelSeparator,
};

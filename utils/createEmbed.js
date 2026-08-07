const { EmbedBuilder } = require('discord.js');
const {
    applyEmbedTheme,
} = require('./embedTheme');

function createEmbed(
    title,
    brandName = 'utilities',
    context = {}
) {
    if (
        brandName &&
        typeof brandName === 'object'
    ) {
        context = brandName;
        brandName = 'utilities';
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setTimestamp();

    return applyEmbedTheme(embed, {
        ...context,
        brandName,
    });
}

module.exports = createEmbed;

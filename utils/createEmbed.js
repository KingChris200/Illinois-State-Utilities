const { EmbedBuilder } = require('discord.js');
const brands = require('../config/branding');

function createEmbed(title, brandName = 'utilities') {
    const brand = brands[brandName] || brands.utilities;

    const embed = new EmbedBuilder()
        .setColor(brand.color)
        .setTitle(title)
        .setTimestamp();

    if (brand.logo) {
        embed.setThumbnail(brand.logo);

        embed.setFooter({
            text: brand.footer,
            iconURL: brand.logo,
        });
    } else {
        embed.setFooter({
            text: brand.footer,
        });
    }

    return embed;
}

module.exports = createEmbed;
const path = require('path');
const {
    AttachmentBuilder,
    SlashCommandBuilder,
} = require('discord.js');
const createEmbed = require('../../utils/createEmbed');

const ABOUT_BANNER_NAME = 'about-banner-v2.png';
const ABOUT_BANNER_PATH = path.join(
    __dirname,
    '../../assets/thumbnails/about-banner-v2.png'
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('About Illinois State Utilities.'),

    async execute(interaction) {
        const embed = createEmbed(
            'Illinois State Utilities',
            'utilities',
            { guild: interaction.guild }
        )
            .setDescription(
                [
                    'The bot that powers Illinois State Roleplay.',
                    'Sessions, staff tools, departments, tickets, and ER:LC utilities.',
                ].join('\n')
            )
            .addFields(
                {
                    name: '🏛️ Community',
                    value: 'Illinois State Roleplay',
                    inline: true,
                },
                {
                    name: '🟢 System Status',
                    value: 'Online',
                    inline: true,
                },
                {
                    name: '📦 Version',
                    value: '1.0.0',
                    inline: true,
                },
                {
                    name: '🌐 Connected Servers',
                    value: `${interaction.client.guilds.cache.size}`,
                    inline: true,
                },
                {
                    name: '⌨️ Loaded Commands',
                    value: `${interaction.client.commands.size}`,
                    inline: true,
                }
            )
            .setImage(`attachment://${ABOUT_BANNER_NAME}`);

        await interaction.reply({
            embeds: [embed],
            files: [
                new AttachmentBuilder(ABOUT_BANNER_PATH, {
                    name: ABOUT_BANNER_NAME,
                }),
            ],
            allowedMentions: { parse: [] },
        });
    },
};

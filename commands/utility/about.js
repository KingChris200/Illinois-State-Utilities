const { SlashCommandBuilder } = require('discord.js');
const createEmbed = require('../../utils/createEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Displays information about Illinois State Utilities.'),

    async execute(interaction) {
        const embed = createEmbed('Illinois State Utilities')
            .setDescription(
                [
                    'The official utility and management platform for Illinois State Roleplay.',
                    '',
                    'Illinois State Utilities supports server operations, department management, staff tools, automation, personnel systems, and community utilities.',
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
                    name: '⚙️ Framework',
                    value: 'discord.js v14',
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
                },
                {
                    name: '🛠️ Platform Purpose',
                    value:
                        'Supporting Illinois State Roleplay through management tools, department systems, and server-wide utilities.',
                    inline: false,
                }
            );

        await interaction.reply({
            embeds: [embed],
        });
    },
};
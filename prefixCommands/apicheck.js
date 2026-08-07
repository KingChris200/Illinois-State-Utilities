const createEmbed = require('../utils/createEmbed');
const erlcService = require('../services/erlcService');

module.exports = {
    name: 'apicheck',
    aliases: ['api'],
    description: 'Runs a safe read-only ER:LC API check.',
    usage: '?apicheck',
    cooldownSeconds: 15,

    async execute({ message, config }) {
        const embed = createEmbed(
            'ER:LC API Connection Check',
            'isrp',
            {
                guild: message.guild,
                client: message.client,
            }
        );

        try {
            const result = await erlcService.checkConnection();
            const isMock = result.mode === 'mock';

            embed
                .setColor(isMock ? '#D68910' : '#27AE60')
                .setDescription(
                    isMock
                        ? '🧪 Mock mode is active. No live API request was made.'
                        : '✅ The read-only ER:LC API check succeeded.'
                )
                .addFields(
                    {
                        name: 'Mode',
                        value: isMock ? 'Mock' : 'Live',
                        inline: true,
                    },
                    {
                        name: 'Key Present',
                        value: erlcService.isConfigured()
                            ? 'Yes'
                            : 'No',
                        inline: true,
                    },
                    {
                        name: 'Server',
                        value: String(
                            result.server?.Name || 'Unknown'
                        ),
                    }
                );
        } catch (error) {
            embed
                .setColor('#C0392B')
                .setDescription(
                    `❌ ${erlcService.getPublicErrorMessage(error)}`
                )
                .addFields(
                    {
                        name: 'HTTP Status',
                        value: error.status
                            ? String(error.status)
                            : 'Unavailable',
                        inline: true,
                    },
                    {
                        name: 'PRC Error Code',
                        value: error.prcCode
                            ? String(error.prcCode)
                            : 'Unavailable',
                        inline: true,
                    },
                    {
                        name: 'Safety',
                        value:
                            'No remote command was executed. This check only reads server information.',
                    }
                );
        }

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

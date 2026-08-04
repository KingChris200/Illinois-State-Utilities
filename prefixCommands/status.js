const createEmbed = require('../utils/createEmbed');
const erlcService = require('../services/erlcService');

module.exports = {
    name: 'status',
    description: 'Shows bot and ER:LC connection readiness.',
    usage: '?status',
    staffOnly: false,
    cooldownSeconds: 2,

    async execute({ message, config }) {
        const mode = config.mockMode
            ? '🧪 Mock Mode'
            : config.dryRun
              ? '🛡️ Dry-Run Mode'
              : '🟢 Live Mode';
        const apiConfigured = erlcService.isConfigured();
        const erlcStatus = config.mockMode
            ? 'Sample data enabled'
            : apiConfigured
              ? 'Ready for live requests'
              : 'API key not configured';
        let playerCount = 'Unavailable';

        if (config.mockMode) {
            const players = await erlcService.getPlayers();
            playerCount = String(players.length);
        }

        const embed = createEmbed(
            'Illinois State Utilities Status'
        )
            .setDescription(
                'Current readiness for Discord and ER:LC remote operations.'
            )
            .addFields(
                {
                    name: 'Discord Bot',
                    value: `🟢 Online as ${message.client.user.tag}`,
                },
                {
                    name: 'Operating Mode',
                    value: mode,
                    inline: true,
                },
                {
                    name: 'ER:LC API Key',
                    value: apiConfigured
                        ? '✅ Configured'
                        : '⚠️ Not configured',
                    inline: true,
                },
                {
                    name: 'ER:LC Readiness',
                    value: erlcStatus,
                    inline: true,
                },
                {
                    name: 'Visible Players',
                    value: playerCount,
                    inline: true,
                },
                {
                    name: 'Latency',
                    value: `${Math.max(0, Math.round(message.client.ws.ping))} ms`,
                    inline: true,
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

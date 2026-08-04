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
        const health = erlcService.getApiHealth();
        const healthLabel = getHealthLabel(
            health,
            config.mockMode
        );
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
                    name: 'Remembered API Health',
                    value: healthLabel,
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
                },
                {
                    name: 'Read-Only Connection Test',
                    value: 'Run `?apicheck` when you intentionally want to test the API.',
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

function getHealthLabel(health, mockMode) {
    if (mockMode) {
        return '🧪 Mock data enabled';
    }

    if (health.state === 'healthy') {
        return `🟢 Healthy ${formatTimestamp(health.lastSuccessAt)}`;
    }

    if (health.state === 'unhealthy') {
        const code = health.lastPrcCode
            ? ` · PRC ${health.lastPrcCode}`
            : '';
        return `🔴 Unhealthy${code} ${formatTimestamp(health.lastFailureAt)}`;
    }

    return '⚪ Not checked since startup';
}

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return '';
    }

    return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

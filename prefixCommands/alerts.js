const { getSmartAlertConfig } = require('../config/smartAlerts');
const erlcService = require('../services/erlcService');
const {
    createMockAlertEvents,
    createSmartAlertEmbeds,
    getSmartAlertStatus,
} = require('../services/erlcSmartAlertMonitor');
const createEmbed = require('../utils/createEmbed');

module.exports = {
    name: 'alerts',
    description:
        'Shows smart-alert status or creates a safe preview.',
    usage: '?alerts [status|test]',
    permissionLevel: 'senior',
    cooldownSeconds: 5,

    async execute({ message, args, config }) {
        const action = (args[0] || 'status').toLowerCase();

        if (action === 'test') {
            await sendAlertPreview(message);
            return;
        }

        if (action !== 'status') {
            await message.reply(
                'Usage: `?alerts [status|test]`'
            );
            return;
        }

        const alertConfig = getSmartAlertConfig();
        const status = getSmartAlertStatus();
        const rateLimit = erlcService.getApiRateLimit();
        const embed = createEmbed(
            'ER:LC Smart Alerts — Status',
            'isrp'
        )
            .setDescription(
                'Automatic monitoring for queue surges and unusual kill activity. Moderator-call alerts are disabled.'
            )
            .addFields(
                {
                    name: 'Monitor State',
                    value: formatMonitorState(status.state),
                    inline: true,
                },
                {
                    name: 'Operating Mode',
                    value: config.mockMode
                        ? '🧪 Mock Mode'
                        : '🟢 Live Mode',
                    inline: true,
                },
                {
                    name: 'Alert Channel',
                    value: alertConfig.channelId
                        ? `<#${alertConfig.channelId}>`
                        : '⚠️ Not configured',
                    inline: true,
                },
                {
                    name: 'Staff Ping',
                    value: alertConfig.roleId
                        ? `<@&${alertConfig.roleId}>`
                        : 'No role ping configured',
                    inline: true,
                },
                {
                    name: 'Polling Interval',
                    value: `${Math.round(alertConfig.intervalMs / 1000)} seconds`,
                    inline: true,
                },
                {
                    name: 'Alerts Sent',
                    value: String(status.alertsSent || 0),
                    inline: true,
                },
                {
                    name: 'Detection Thresholds',
                    value: [
                        `Queue surge: **${alertConfig.queueThreshold}+ players**`,
                        `Kill spike: **${alertConfig.killThreshold}+ kills** within **${alertConfig.killWindowSeconds}s**`,
                        `Repeat cooldown: **${alertConfig.cooldownSeconds}s**`,
                    ].join('\n'),
                },
                {
                    name: 'Last Successful Check',
                    value: status.lastSuccessAt
                        ? `<t:${Math.floor(status.lastSuccessAt / 1000)}:R>`
                        : 'Not checked since startup',
                    inline: true,
                },
                {
                    name: 'Remembered API Budget',
                    value:
                        rateLimit.remaining === null
                            ? 'Not reported yet'
                            : `${rateLimit.remaining} / ${rateLimit.limit ?? '?'} remaining`,
                    inline: true,
                },
                {
                    name: 'Safe Preview',
                    value:
                        'Run `?alerts test` to preview the queue and kill alerts without pinging a role or contacting ER:LC.',
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

async function sendAlertPreview(message) {
    const alertConfig = getSmartAlertConfig();
    const embeds = createSmartAlertEmbeds(
        createMockAlertEvents(alertConfig)
    );

    await message.reply({
        content:
            '🧪 **Smart-alert preview only** — no role was pinged and no ER:LC request was made.',
        embeds,
        allowedMentions: { parse: [] },
    });
}

function formatMonitorState(state) {
    const states = {
        running: '🟢 Running',
        disabled: '⚪ Disabled',
        missing_channel: '⚠️ Alert channel missing',
        missing_api_key: '⚠️ API key missing',
        degraded: '🟠 Temporary API issue',
        halted: '🔴 Halted for credential safety',
        stopped: '⚪ Stopped',
        not_started: '⚪ Waiting for bot startup',
    };

    return states[state] || `⚪ ${state}`;
}

module.exports.formatMonitorState = formatMonitorState;

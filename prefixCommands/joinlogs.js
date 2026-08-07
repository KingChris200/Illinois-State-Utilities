const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');
const {
    formatPlayerIdentity,
    formatRelativeTime,
    parseActivityCount,
    parsePlayerIdentity,
    sortNewest,
} = require('../utils/erlcActivityUtils');

module.exports = {
    name: 'joinlogs',
    description: 'Shows recent ER:LC joins and departures.',
    usage: '?joinlogs [1-10]',
    cooldownSeconds: 8,

    async execute({ message, args }) {
        const count = parseActivityCount(args[0]);

        if (count === null) {
            await message.reply('Usage: `?joinlogs [1-10]`');
            return;
        }

        const logs = await erlcService.getJoinLogs();
        const recentLogs = sortNewest(logs).slice(0, count);
        const embed = createEmbed(
            `Recent Join Activity — ${recentLogs.length}`,
            'isrp'
        ).setDescription(
            recentLogs.length
                ? recentLogs.map(formatJoinLog).join('\n')
                : '*No recent join activity was returned.*'
        );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

function formatJoinLog(log, index) {
    const player = parsePlayerIdentity(log?.Player);
    const joined = log?.Join === true;
    const status = joined ? '🟢 Joined' : '🔴 Left';

    return `${status} · ${formatPlayerIdentity(player)} · ${formatRelativeTime(log?.Timestamp)}`;
}

module.exports.formatJoinLog = formatJoinLog;

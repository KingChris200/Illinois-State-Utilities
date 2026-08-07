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
    name: 'kl',
    description: 'Shows recent ER:LC kill logs.',
    usage: '?kl [1-10]',
    cooldownSeconds: 8,

    async execute({ message, args }) {
        const count = parseActivityCount(args[0]);

        if (count === null) {
            await message.reply('Usage: `?kl [1-10]`');
            return;
        }

        const logs = await erlcService.getKillLogs();
        const recentLogs = sortNewest(logs).slice(0, count);
        const embed = createEmbed(
            `Recent Kill Logs — ${recentLogs.length}`,
            'isrp',
            {
                guild: message.guild,
                client: message.client,
                tone: 'moderation',
            }
        ).setDescription(
            recentLogs.length
                ? recentLogs.map(formatKillLog).join('\n\n')
                : '*No recent kill logs were returned.*'
        );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

function formatKillLog(log, index) {
    const killer = parsePlayerIdentity(log?.Killer);
    const victim = parsePlayerIdentity(log?.Killed);

    return [
        `**${index + 1}. Elimination** · ${formatRelativeTime(log?.Timestamp)}`,
        `${formatPlayerIdentity(killer)} → ${formatPlayerIdentity(victim)}`,
    ].join('\n');
}

module.exports.formatKillLog = formatKillLog;

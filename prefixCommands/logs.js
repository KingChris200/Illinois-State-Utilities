const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');
const {
    cleanInlineCode,
    formatRelativeTime,
    parseActivityCount,
    parsePlayerIdentity,
    sortNewest,
} = require('../utils/erlcActivityUtils');

module.exports = {
    name: 'logs',
    description: 'Shows recent in-game ER:LC command logs.',
    usage: '?logs [1-10]',
    permissionLevel: 'senior',
    cooldownSeconds: 8,

    async execute({ message, args }) {
        const count = parseActivityCount(args[0]);

        if (count === null) {
            await message.reply('Usage: `?logs [1-10]`');
            return;
        }

        const logs = await erlcService.getCommandLogs();
        const recentLogs = sortNewest(logs).slice(0, count);
        const embed = createEmbed(
            'Recent ER:LC Command Logs',
            'isrp'
        ).setDescription(
            recentLogs.length
                ? recentLogs.map(formatCommandLog).join('\n\n')
                : '*No recent command logs were returned.*'
        );

        embed.addFields({
            name: 'Privacy & Access',
            value:
                'Visible only to configured senior staff. Mentions are disabled.',
        });

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

function formatCommandLog(log, index) {
    const player = parsePlayerIdentity(log?.Player);
    const when = formatRelativeTime(log?.Timestamp);
    const command = cleanInlineCode(log?.Command, 240);

    return [
        `**${index + 1}. ${player.username}** · ${when}`,
        player.userId ? `User ID: \`${player.userId}\`` : null,
        `Command: \`${command}\``,
    ]
        .filter(Boolean)
        .join('\n');
}

module.exports.formatCommandLog = formatCommandLog;
module.exports.parseLogCount = parseActivityCount;

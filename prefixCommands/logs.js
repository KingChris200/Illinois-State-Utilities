const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');

const DEFAULT_LOG_COUNT = 5;
const MAX_LOG_COUNT = 10;

module.exports = {
    name: 'logs',
    description: 'Shows recent in-game ER:LC command logs.',
    usage: '?logs [1-10]',
    permissionLevel: 'senior',
    cooldownSeconds: 8,

    async execute({ message, args }) {
        const count = parseLogCount(args[0]);

        if (count === null) {
            await message.reply('Usage: `?logs [1-10]`');
            return;
        }

        const logs = await erlcService.getCommandLogs();
        const recentLogs = [...logs]
            .sort(
                (first, second) =>
                    Number(second.Timestamp || 0) -
                    Number(first.Timestamp || 0)
            )
            .slice(0, count);
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

function parseLogCount(value) {
    if (value === undefined) {
        return DEFAULT_LOG_COUNT;
    }

    if (!/^\d+$/.test(value)) {
        return null;
    }

    const count = Number(value);
    return count >= 1 && count <= MAX_LOG_COUNT
        ? count
        : null;
}

function formatCommandLog(log, index) {
    const player = parsePlayer(log?.Player);
    const timestamp = Number(log?.Timestamp);
    const when = Number.isInteger(timestamp) && timestamp > 0
        ? `<t:${timestamp}:R>`
        : 'Unknown time';
    const command = cleanInlineCode(log?.Command, 240);

    return [
        `**${index + 1}. ${player.username}** · ${when}`,
        player.userId ? `User ID: \`${player.userId}\`` : null,
        `Command: \`${command}\``,
    ]
        .filter(Boolean)
        .join('\n');
}

function parsePlayer(value) {
    const text = String(value || 'Unknown');
    const separatorIndex = text.lastIndexOf(':');

    if (separatorIndex === -1) {
        return { username: cleanText(text, 40), userId: null };
    }

    return {
        username: cleanText(text.slice(0, separatorIndex), 40),
        userId: cleanText(text.slice(separatorIndex + 1), 24),
    };
}

function cleanText(value, maximumLength) {
    return String(value || 'Unknown')
        .replace(/[*_~`|>\\]/g, '\\$&')
        .slice(0, maximumLength);
}

function cleanInlineCode(value, maximumLength) {
    return String(value || 'Unknown command')
        .replace(/[\r\n]+/g, ' ')
        .replace(/`/g, "'")
        .slice(0, maximumLength);
}

module.exports.formatCommandLog = formatCommandLog;
module.exports.parseLogCount = parseLogCount;

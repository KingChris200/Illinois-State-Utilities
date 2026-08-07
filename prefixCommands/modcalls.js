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
    name: 'modcalls',
    description: 'Shows recent ER:LC moderator calls.',
    usage: '?modcalls [1-10]',
    cooldownSeconds: 8,

    async execute({ message, args }) {
        const count = parseActivityCount(args[0]);

        if (count === null) {
            await message.reply('Usage: `?modcalls [1-10]`');
            return;
        }

        const calls = await erlcService.getModCalls();
        const recentCalls = sortNewest(calls).slice(0, count);
        const unanswered = recentCalls.filter(
            (call) => !hasModerator(call?.Moderator)
        ).length;
        const embed = createEmbed(
            `Moderator Calls — ${recentCalls.length}`,
            'isrp'
        )
            .setDescription(
                recentCalls.length
                    ? recentCalls.map(formatModCall).join('\n\n')
                    : '*No recent moderator calls were returned.*'
            )
            .addFields(
                {
                    name: 'Answered',
                    value: String(recentCalls.length - unanswered),
                    inline: true,
                },
                {
                    name: 'Unanswered',
                    value: String(unanswered),
                    inline: true,
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

function formatModCall(call, index) {
    const caller = parsePlayerIdentity(call?.Caller);
    const moderator = hasModerator(call?.Moderator)
        ? parsePlayerIdentity(call.Moderator)
        : null;

    return [
        `**${index + 1}. Moderator Call** · ${formatRelativeTime(call?.Timestamp)}`,
        `Caller: ${formatPlayerIdentity(caller)}`,
        moderator
            ? `Status: ✅ Answered by ${formatPlayerIdentity(moderator)}`
            : 'Status: ⚠️ No responding moderator recorded',
    ].join('\n');
}

function hasModerator(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return Boolean(
        normalized &&
        normalized !== 'none' &&
        normalized !== 'n/a' &&
        normalized !== 'unknown'
    );
}

module.exports.formatModCall = formatModCall;
module.exports.hasModerator = hasModerator;

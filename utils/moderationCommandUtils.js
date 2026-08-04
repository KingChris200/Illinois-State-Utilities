const createEmbed = require('./createEmbed');
const erlcService = require('../services/erlcService');
const {
    PlayerResolverError,
    resolvePlayer,
} = require('./playerResolver');

async function resolveOnlinePlayer(query) {
    const players = await erlcService.getPlayers();
    return resolvePlayer(players, query);
}

async function replyWithResolverError(message, error) {
    if (!(error instanceof PlayerResolverError)) {
        throw error;
    }

    const embed = createEmbed('Player Not Resolved', 'isrp')
        .setColor('#C0392B')
        .setDescription(error.message)
        .addFields({
            name: 'Safety Check',
            value:
                'No ER:LC moderation command was executed.',
        });

    await message.reply({
        embeds: [embed],
        allowedMentions: { parse: [] },
    });
}

function createModerationPreview({
    action,
    player,
    executor,
    reason = null,
    command,
    mockMode,
    expiresInSeconds,
}) {
    const embed = createEmbed(`${action} Confirmation`, 'isrp')
        .setColor('#D68910')
        .setDescription(
            mockMode
                ? '🧪 **Mock confirmation** — confirming will not contact ER:LC.'
                : '⚠️ Review the target carefully before confirming this live action.'
        )
        .addFields(
            {
                name: 'Target',
                value: player.userId
                    ? `**${player.username}** · \`${player.userId}\``
                    : `**${player.username}**`,
            },
            {
                name: 'Player Permission',
                value: player.permission,
                inline: true,
            },
            {
                name: 'Requested By',
                value: `${executor}`,
                inline: true,
            },
            {
                name: 'In-Game Command',
                value: `\`${command}\``,
            },
            {
                name: 'Confirmation Window',
                value: `${expiresInSeconds} seconds`,
                inline: true,
            }
        );

    if (reason) {
        embed.addFields({
            name: 'Reason',
            value: reason,
        });
    }

    return embed;
}

module.exports = {
    createModerationPreview,
    replyWithResolverError,
    resolveOnlinePlayer,
};

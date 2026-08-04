const createEmbed = require('./createEmbed');
const config = require('../config/prefixCommands');

const EVENT_DETAILS = {
    requested: {
        label: 'Requested',
        color: '#D68910',
    },
    confirmed: {
        label: 'Confirmed',
        color: '#2980B9',
    },
    cancelled: {
        label: 'Cancelled',
        color: '#7F8C8D',
    },
    expired: {
        label: 'Expired',
        color: '#7F8C8D',
    },
    mock_complete: {
        label: 'Mock Completed',
        color: '#27AE60',
    },
    complete: {
        label: 'Completed',
        color: '#27AE60',
    },
    failed: {
        label: 'Failed',
        color: '#C0392B',
    },
};

const ACTION_NAMES = {
    kick: 'Kick',
    respawn: 'Respawn',
    ban: 'Ban',
    unban: 'Unban',
    heal: 'Heal',
    wanted: 'Wanted',
    unwanted: 'Unwanted',
};

function buildAuditEmbed(pending, eventName, error = null) {
    const event = EVENT_DETAILS[eventName] || {
        label: 'Updated',
        color: '#7F8C8D',
    };
    const actionName =
        ACTION_NAMES[pending.action] || 'Moderation Action';
    const mode = pending.mockMode
        ? 'Mock'
        : pending.dryRun
          ? 'Dry Run'
          : 'Live';
    const target = pending.player.userId
        ? `**${pending.player.username}** · \`${pending.player.userId}\``
        : `**${pending.player.username}**`;
    const embed = createEmbed(
        `${actionName} Audit — ${event.label}`,
        'isrp'
    )
        .setColor(event.color)
        .addFields(
            {
                name: 'Action',
                value: actionName,
                inline: true,
            },
            {
                name: 'Outcome',
                value: event.label,
                inline: true,
            },
            {
                name: 'Mode',
                value: mode,
                inline: true,
            },
            {
                name: 'Target',
                value: target,
            },
            {
                name: 'Executor',
                value:
                    `${pending.executorMention} · \`${pending.executorId}\``,
            },
            {
                name: 'Command',
                value: `\`${pending.command}\``,
            },
            {
                name: 'Request ID',
                value: `\`${pending.id}\``,
                inline: true,
            }
        );

    if (pending.channelId) {
        embed.addFields({
            name: 'Source Channel',
            value: `<#${pending.channelId}>`,
            inline: true,
        });
    }

    if (pending.reason) {
        embed.addFields({
            name: 'Reason',
            value: pending.reason,
        });
    }

    if (error) {
        embed.addFields({
            name: 'Failure Details',
            value: formatSafeError(error),
        });
    }

    return embed;
}

async function logModerationAudit(
    pending,
    eventName,
    error = null
) {
    const actionName =
        ACTION_NAMES[pending.action] || pending.action;
    const safeError = error ? formatSafeError(error) : null;

    console.log(
        [
            '[ER:LC AUDIT]',
            `request=${pending.id}`,
            `action=${actionName}`,
            `target=${pending.player.username}`,
            `targetId=${pending.player.userId || 'unknown'}`,
            `executor=${pending.executorId}`,
            `event=${eventName}`,
            safeError ? `error=${safeError}` : null,
        ]
            .filter(Boolean)
            .join(' ')
    );

    if (
        !config.moderationLogChannelId ||
        !pending.client?.channels
    ) {
        return false;
    }

    const channel = await pending.client.channels
        .fetch(config.moderationLogChannelId)
        .catch(() => null);

    if (!channel?.isTextBased()) {
        return false;
    }

    return channel
        .send({
            embeds: [
                buildAuditEmbed(
                    pending,
                    eventName,
                    error
                ),
            ],
            allowedMentions: { parse: [] },
        })
        .then(() => true)
        .catch((sendError) => {
            console.error(
                'Could not send ER:LC moderation audit embed:',
                sendError
            );
            return false;
        });
}

function formatSafeError(error) {
    if (error?.code === 'PLAYER_NOT_FOUND') {
        return 'Target is no longer online.';
    }

    if (error?.code === 'API_KEY_NOT_CONFIGURED') {
        return 'ER:LC API key is not configured.';
    }

    if (error?.code === 'API_REQUEST_FAILED') {
        return error.status
            ? `ER:LC request failed with HTTP ${error.status}.`
            : 'ER:LC request failed.';
    }

    return 'Internal moderation safety check failed.';
}

module.exports = {
    buildAuditEmbed,
    formatSafeError,
    logModerationAudit,
};

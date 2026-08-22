const erlcService = require('./erlcService');
const config = require('../config/sessionAutomation');

const EVENT_BUILDERS = {
    vote_started: ({ hostUsername, voteGoal, roleplayZone }) =>
        `:h A session vote has started${hostUsername ? ` by ${hostUsername}` : ''}${voteGoal ? ` with a goal of ${voteGoal} attendees` : ''}${roleplayZone ? ` for ${roleplayZone}` : ''}.`,

    session_started: ({ hostUsername, attendeeCount, roleplayZone }) =>
        `:m The server is now up! Code: ILLINOISrp.${hostUsername ? ` Host: ${hostUsername}.` : ''}${roleplayZone ? ` Area: ${roleplayZone}.` : ''}${Number.isInteger(attendeeCount) ? ` ${attendeeCount} members voted to join.` : ''}`,

    session_shutdown: ({ duration }) =>
        `:m The session has ended${duration ? ` after ${duration}` : ''}. Thanks for joining!`,

    session_low: ({ playerCount }) =>
        `:h Session low! More players are needed to keep roleplay active.${Number.isInteger(playerCount) ? ` Current player count: ${playerCount}.` : ''}`,

    session_full: ({ playerCount }) =>
        `:h The session has enough players now. Thanks for joining!${Number.isInteger(playerCount) ? ` Current players: ${playerCount}.` : ''}`,
};

async function announceSessionEvent(eventName, context = {}) {
    if (!EVENT_BUILDERS[eventName]) {
        return {
            status: 'skipped',
            reason: 'unknown_event',
        };
    }

    if (
        !context.sourceChannelId ||
        String(context.sourceChannelId) !== config.channelId
    ) {
        return {
            status: 'skipped',
            reason: 'wrong_channel',
        };
    }

    if (!config.enabled) {
        return {
            status: 'skipped',
            reason: 'disabled',
        };
    }

    const command = EVENT_BUILDERS[eventName](context);

    try {
        const result = await erlcService.executeCommand(command, {
            dryRun: config.dryRun || config.mockMode,
        });
        const status = result.dryRun
            ? 'mock_complete'
            : 'complete';

        console.log(
            `[ER:LC SESSION] event=${eventName} channel=${context.sourceChannelId} outcome=${status} command=${command}`
        );

        return {
            status,
            command,
        };
    } catch (error) {
        console.error(
            `[ER:LC SESSION] event=${eventName} outcome=failed`,
            error
        );

        return {
            status: 'failed',
            command,
            errorCode: error.code || 'UNKNOWN_ERROR',
        };
    }
}

module.exports = {
    EVENT_BUILDERS,
    announceSessionEvent,
};

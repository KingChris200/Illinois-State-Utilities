const erlcService = require('./erlcService');
const config = require('../config/sessionAutomation');

const EVENT_BUILDERS = {
    vote_started: ({ hostUsername, voteGoal, roleplayZone }) =>
        `:h A session vote has started${hostUsername ? ` by ${hostUsername}` : ''}${voteGoal ? ` with a goal of ${voteGoal} attendees` : ''}${roleplayZone ? ` for ${roleplayZone}` : ''}.`,

    session_started: ({ hostUsername, attendeeCount }) =>
        `:m Illinois State Roleplay is now in session! Join code: ILLINOISrp.${hostUsername ? ` Hosted by ${hostUsername}.` : ''}${Number.isInteger(attendeeCount) ? ` Confirmed attendees: ${attendeeCount}.` : ''}`,

    session_shutdown: ({ duration }) =>
        `:m The Illinois State Roleplay session has concluded${duration ? ` after ${duration}` : ''}. Thank you for participating!`,

    session_low: ({ playerCount }) =>
        `:h Session low! More players are needed to keep roleplay active.${Number.isInteger(playerCount) ? ` Current player count: ${playerCount}.` : ''}`,

    session_full: ({ playerCount }) =>
        `:h The session has reached a healthy player count.${Number.isInteger(playerCount) ? ` Current player count: ${playerCount}.` : ''} Please continue professional roleplay.`,
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

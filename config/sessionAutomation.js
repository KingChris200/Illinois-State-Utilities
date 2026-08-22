const prefixConfig = require('./prefixCommands');

function readBoundedInteger(name, fallback, minimum, maximum) {
    const value = Number(process.env[name]);

    if (!Number.isInteger(value)) {
        return fallback;
    }

    return Math.min(maximum, Math.max(minimum, value));
}

module.exports = {
    channelId:
        process.env.ERLC_SESSION_CHANNEL_ID ||
        '1490731232311378010',
    pingRoleId:
        process.env.ERLC_SESSION_PING_ROLE_ID ||
        '1377126063926411334',
    voteGoal: readBoundedInteger(
        'ERLC_SESSION_VOTE_GOAL',
        10,
        1,
        100
    ),
    voteDurationMinutes: readBoundedInteger(
        'ERLC_SESSION_VOTE_DURATION_MINUTES',
        5,
        1,
        60
    ),
    enabled:
        prefixConfig.mockMode ||
        String(
            process.env.ERLC_SESSION_AUTOMATION_ENABLED || ''
        ).toLowerCase() === 'true',
    dryRun: prefixConfig.dryRun,
    mockMode: prefixConfig.mockMode,
};

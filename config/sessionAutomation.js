const prefixConfig = require('./prefixCommands');

module.exports = {
    channelId:
        process.env.ERLC_SESSION_CHANNEL_ID ||
        '1490731232311378010',
    enabled:
        prefixConfig.mockMode ||
        String(
            process.env.ERLC_SESSION_AUTOMATION_ENABLED || ''
        ).toLowerCase() === 'true',
    dryRun: prefixConfig.dryRun,
    mockMode: prefixConfig.mockMode,
};

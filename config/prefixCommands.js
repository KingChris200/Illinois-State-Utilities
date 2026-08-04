const splitIds = (value) =>
    String(value || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

module.exports = {
    prefix: '?',
    dryRun:
        String(process.env.ERLC_DRY_RUN || '').toLowerCase() ===
        'true',
    mockMode:
        String(process.env.ERLC_MOCK_MODE || '').toLowerCase() ===
        'true',
    allowedRoleIds: splitIds(
        process.env.ERLC_COMMAND_ROLE_IDS
    ),
    seniorRoleIds: splitIds(
        process.env.ERLC_SENIOR_MOD_ROLE_IDS
    ),
    allowedChannelIds: splitIds(
        process.env.ERLC_COMMAND_CHANNEL_IDS
    ),
    logChannelId:
        process.env.ERLC_COMMAND_LOG_CHANNEL_ID || null,
    moderationLogChannelId:
        process.env.ERLC_MODERATION_LOG_CHANNEL_ID || null,
    defaultCooldownSeconds: 3,
};

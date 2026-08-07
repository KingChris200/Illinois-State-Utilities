const DEFAULT_WELCOME_CHANNEL_ID =
    '1490733409037975654';

function getWelcomeConfig(environment = process.env) {
    return {
        channelId:
            cleanId(environment.WELCOME_CHANNEL_ID) ||
            DEFAULT_WELCOME_CHANNEL_ID,
    };
}

function cleanId(value) {
    const id = String(value || '').trim();
    return /^\d{16,22}$/.test(id) ? id : null;
}

module.exports = {
    DEFAULT_WELCOME_CHANNEL_ID,
    getWelcomeConfig,
};

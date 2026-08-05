const { Events } = require('discord.js');

const {
    recoverSessionState,
} = require('../services/sessionRecoveryService');

module.exports = {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        try {
            const result =
                await recoverSessionState(client);

            console.log(
                `[SESSION RECOVERY] ${result.status}`
            );
        } catch (error) {
            console.error(
                '[SESSION RECOVERY] Startup recovery failed:',
                error
            );
        }
    },
};

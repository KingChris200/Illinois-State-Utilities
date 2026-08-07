const { Events } = require('discord.js');

const {
    recoverSessionState,
} = require('../services/sessionRecoveryService');
const {
    startSmartAlertMonitor,
} = require('../services/erlcSmartAlertMonitor');

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

        try {
            const alerts =
                await startSmartAlertMonitor(client);

            console.log(
                `[ER:LC SMART ALERTS] ${alerts.state}`
            );
        } catch (error) {
            console.error(
                '[ER:LC SMART ALERTS] Startup failed:',
                error
            );
        }
    },
};

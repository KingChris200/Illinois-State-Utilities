const { Events } = require('discord.js');

const {
    recoverSessionState,
} = require('../services/sessionRecoveryService');
const {
    startSmartAlertMonitor,
} = require('../services/erlcSmartAlertMonitor');
const {
    startWatchlistAlertMonitor,
} = require('../services/watchlistAlertMonitor');

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

        try {
            const watchlistAlerts =
                await startWatchlistAlertMonitor(client);

            console.log(
                `[WATCHLIST ALERTS] ${watchlistAlerts.state}`
            );
        } catch (error) {
            console.error(
                '[WATCHLIST ALERTS] Startup failed:',
                error
            );
        }
    },
};

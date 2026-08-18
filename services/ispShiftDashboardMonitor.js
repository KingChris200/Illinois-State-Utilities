const shiftConfig = require('../config/ispShift');
const {
    refreshIspShiftDashboard,
} = require('../utils/ispShiftDashboardManager');

const REFRESH_INTERVAL_MS = 60 * 1000;
let refreshTimer = null;

async function runRefresh(client) {
    try {
        return await refreshIspShiftDashboard(client, shiftConfig.guildId);
    } catch (error) {
        console.error('[ISP SHIFT DASHBOARD] Refresh failed:', error);
        return { status: 'refresh_failed' };
    }
}

async function startIspShiftDashboardMonitor(client) {
    if (refreshTimer) {
        return { state: 'already_running' };
    }

    const initial = await runRefresh(client);
    refreshTimer = setInterval(() => {
        void runRefresh(client);
    }, REFRESH_INTERVAL_MS);
    refreshTimer.unref?.();

    return {
        state: 'running',
        initialStatus: initial.status,
        intervalMs: REFRESH_INTERVAL_MS,
    };
}

function stopIspShiftDashboardMonitor() {
    if (!refreshTimer) return false;
    clearInterval(refreshTimer);
    refreshTimer = null;
    return true;
}

module.exports = {
    REFRESH_INTERVAL_MS,
    startIspShiftDashboardMonitor,
    stopIspShiftDashboardMonitor,
};

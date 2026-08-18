const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const originalDirectory = process.cwd();
const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'isp-shift-dashboard-')
);
process.chdir(temporaryDirectory);

const {
    getStoredIspShiftDashboard,
    removeStoredIspShiftDashboard,
    saveIspShiftDashboard,
} = require('../utils/ispShiftDashboardManager');

test.after(() => {
    process.chdir(originalDirectory);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('ISP dashboard message location survives restarts and can be removed', async () => {
    const guildId = '1527511728169025658';
    const panel = {
        channelId: '1527524104209567824',
        messageId: '1539999999999999999',
        postedBy: '123456789012345678',
    };

    await saveIspShiftDashboard(guildId, panel);
    assert.deepEqual(await getStoredIspShiftDashboard(guildId), {
        guildId,
        ...panel,
    });

    assert.deepEqual(await removeStoredIspShiftDashboard(guildId), {
        guildId,
        ...panel,
    });
    assert.equal(await getStoredIspShiftDashboard(guildId), null);
});

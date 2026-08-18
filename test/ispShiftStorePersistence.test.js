const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const originalDirectory = process.cwd();
const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'isp-shift-test-')
);
process.chdir(temporaryDirectory);

const {
    getShiftSnapshot,
    startShift,
    stopShift,
    toggleBreak,
} = require('../utils/ispShiftStore');

test.after(() => {
    process.chdir(originalDirectory);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('ISP shifts persist start, break, resume, and stop state', async () => {
    const guildId = '1527511728169025658';
    const user = {
        id: '123456789012345678',
        username: 'TrooperExample',
        displayName: 'Trooper Example',
    };
    const start = new Date('2026-08-17T12:00:00.000Z').getTime();

    assert.equal((await startShift(guildId, user, start)).status, 'started');
    assert.equal(
        (await toggleBreak(guildId, user, start + 30 * 60 * 1000)).status,
        'break_started'
    );
    assert.equal(
        (await toggleBreak(guildId, user, start + 40 * 60 * 1000)).status,
        'resumed'
    );

    const active = await getShiftSnapshot(
        guildId,
        user.id,
        start + 70 * 60 * 1000
    );
    assert.equal(active.activeDurationMs, 60 * 60 * 1000);

    const result = await stopShift(guildId, user, {
        now: start + 70 * 60 * 1000,
    });
    assert.equal(result.status, 'stopped');
    assert.equal(result.session.durationMs, 60 * 60 * 1000);

    const stopped = await getShiftSnapshot(
        guildId,
        user.id,
        start + 70 * 60 * 1000
    );
    assert.equal(stopped.active, null);
    assert.equal(stopped.weeklyDurationMs, 60 * 60 * 1000);
    assert.equal(stopped.sessionCount, 1);
});

test('duplicate shift starts and stops are rejected safely', async () => {
    const guildId = '1527511728169025658';
    const user = {
        id: '987654321098765432',
        username: 'SecondTrooper',
    };
    const now = new Date('2026-08-17T15:00:00.000Z').getTime();

    assert.equal((await startShift(guildId, user, now)).status, 'started');
    assert.equal((await startShift(guildId, user, now)).status, 'already_active');
    assert.equal(
        (await stopShift(guildId, user, { now: now + 10 * 60 * 1000 })).status,
        'stopped'
    );
    assert.equal(
        (await stopShift(guildId, user, { now: now + 20 * 60 * 1000 })).status,
        'not_active'
    );
});

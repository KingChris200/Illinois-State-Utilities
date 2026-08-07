const test = require('node:test');
const assert = require('node:assert/strict');

const {
    formatStaffGroup,
} = require('../prefixCommands/staff');
const {
    formatCommandLog,
    parseLogCount,
} = require('../prefixCommands/logs');

test('formats official ER:LC staff maps without Discord mentions', () => {
    const lines = formatStaffGroup({
        123456789: 'Staff_Test',
    });

    assert.deepEqual(lines, [
        '• **Staff\\_Test** · `123456789`',
    ]);
});

test('validates the optional command log count', () => {
    assert.equal(parseLogCount(undefined), 5);
    assert.equal(parseLogCount('1'), 1);
    assert.equal(parseLogCount('10'), 10);
    assert.equal(parseLogCount('0'), null);
    assert.equal(parseLogCount('11'), null);
    assert.equal(parseLogCount('five'), null);
});

test('formats command logs safely and includes relative time', () => {
    const text = formatCommandLog(
        {
            Player: 'MockPlayer:123456789',
            Timestamp: 2_000_000_000,
            Command: ':m @everyone `unsafe`\nnext line',
        },
        0
    );

    assert.match(text, /MockPlayer/);
    assert.match(text, /123456789/);
    assert.match(text, /<t:2000000000:R>/);
    assert.match(text, /'unsafe' next line/);
    assert.doesNotMatch(text, /`unsafe`/);
});

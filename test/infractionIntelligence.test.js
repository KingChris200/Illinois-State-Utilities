const test = require('node:test');
const assert = require('node:assert/strict');

const {
    findRecentDuplicate,
    analyzeInfractionHistory,
} = require('../utils/infractionIntelligence');

const NOW = Date.parse('2026-08-04T12:00:00.000Z');

test('detects an accidental duplicate infraction', () => {
    const duplicate = findRecentDuplicate({
        records: [
            {
                id: 'warning-1',
                staffMemberId: 'member',
                type: 'warning',
                reason: 'Failed to follow staff policy.',
                status: 'active',
                createdAt: new Date(NOW - 60_000).toISOString(),
            },
        ],
        staffMemberId: 'member',
        infractionType: 'warning',
        reason: 'failed to follow STAFF policy',
        now: NOW,
    });

    assert.equal(duplicate.id, 'warning-1');
});

test('does not treat an old record as an accidental duplicate', () => {
    const duplicate = findRecentDuplicate({
        records: [
            {
                staffMemberId: 'member',
                type: 'warning',
                reason: 'Same reason',
                status: 'active',
                createdAt: new Date(NOW - 11 * 60_000).toISOString(),
            },
        ],
        staffMemberId: 'member',
        infractionType: 'warning',
        reason: 'Same reason',
        now: NOW,
    });

    assert.equal(duplicate, null);
});

test('raises its recommendation for repeat conduct', () => {
    const analysis = analyzeInfractionHistory({
        records: [
            {
                staffMemberId: 'member',
                type: 'warning',
                status: 'active',
                createdAt: new Date(NOW - 86_400_000).toISOString(),
            },
        ],
        staffMemberId: 'member',
        infractionType: 'warning',
        now: NOW,
    });

    assert.equal(analysis.level, 'High');
    assert.equal(analysis.activeWarnings, 1);
    assert.match(analysis.recommendation, /Repeat conduct/);
});

test('treats disciplinary demotions as high-severity management actions', () => {
    const analysis = analyzeInfractionHistory({
        records: [],
        staffMemberId: 'member',
        infractionType: 'demotion',
        now: NOW,
    });

    assert.equal(analysis.level, 'High');
    assert.match(
        analysis.recommendation,
        /replacement rank/i
    );
});

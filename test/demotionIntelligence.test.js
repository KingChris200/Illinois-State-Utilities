const test = require('node:test');
const assert = require('node:assert/strict');

const {
    findRecentDemotionDuplicate,
    analyzeDemotionContext,
} = require('../utils/demotionIntelligence');

const NOW = Date.parse('2026-08-04T12:00:00.000Z');

test('detects an accidental duplicate demotion', () => {
    const duplicate = findRecentDemotionDuplicate({
        records: [
            {
                id: 'demotion-1',
                staffMemberId: 'member',
                previousRank: 'Manager',
                newRank: 'Junior Manager',
                status: 'active',
                createdAt: new Date(NOW - 60_000).toISOString(),
            },
        ],
        staffMemberId: 'member',
        previousRank: 'Manager',
        newRank: 'Junior Manager',
        now: NOW,
    });

    assert.equal(duplicate.id, 'demotion-1');
});

test('classifies a major multi-rank demotion as critical', () => {
    const analysis = analyzeDemotionContext({
        demotions: [],
        infractions: [],
        staffMemberId: 'member',
        previousRankIndex: 6,
        newRankIndex: 2,
        now: NOW,
    });

    assert.equal(analysis.level, 'Critical');
    assert.equal(analysis.ranksDropped, 4);
    assert.match(analysis.recommendation, /leadership/i);
});

test('raises review context when active infractions exist', () => {
    const analysis = analyzeDemotionContext({
        demotions: [],
        infractions: [
            {
                staffMemberId: 'member',
                status: 'active',
            },
        ],
        staffMemberId: 'member',
        previousRankIndex: 3,
        newRankIndex: 2,
        now: NOW,
    });

    assert.equal(analysis.level, 'Elevated');
    assert.equal(analysis.activeInfractionCount, 1);
});

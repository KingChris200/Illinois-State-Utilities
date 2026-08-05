const test = require('node:test');
const assert = require('node:assert/strict');

const {
    findRecentPromotionDuplicate,
    analyzePromotionProgression,
} = require('../utils/promotionIntelligence');

const NOW = Date.parse('2026-08-04T12:00:00.000Z');

test('detects a duplicate promotion request', () => {
    const duplicate = findRecentPromotionDuplicate({
        records: [
            {
                id: 'promotion-1',
                staffMemberId: 'member',
                previousRank: 'Moderator',
                newRank: 'Senior Moderator',
                status: 'active',
                createdAt: new Date(NOW - 60_000).toISOString(),
            },
        ],
        staffMemberId: 'member',
        previousRank: 'Moderator',
        newRank: 'Senior Moderator',
        now: NOW,
    });

    assert.equal(duplicate.id, 'promotion-1');
});

test('identifies a multi-rank promotion for leadership review', () => {
    const analysis = analyzePromotionProgression({
        records: [],
        staffMemberId: 'member',
        previousRankIndex: 1,
        newRankIndex: 4,
        now: NOW,
    });

    assert.equal(analysis.ranksAdvanced, 3);
    assert.equal(
        analysis.classification,
        'Major Rank Advancement'
    );
    assert.match(
        analysis.recommendation,
        /leadership/i
    );
});

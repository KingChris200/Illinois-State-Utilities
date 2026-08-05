const test = require('node:test');
const assert = require('node:assert/strict');

const {
    analyzeStaffProfile,
    collectStaffEvents,
} = require('../utils/staffProfileIntelligence');

const NOW = new Date('2026-08-04T12:00:00.000Z');

function daysAgo(days) {
    return new Date(
        NOW.getTime() - days * 86400000
    ).toISOString();
}

test('deduplicates records shared by staff history and profile arrays', () => {
    const promotion = {
        id: 'promotion-1',
        type: 'promotion',
        previousRank: 'Moderator',
        newRank: 'Senior Moderator',
        createdAt: daysAgo(60),
    };

    const events = collectStaffEvents(
        {
            promotionHistory: [
                {
                    promotionId: 'promotion-1',
                    previousRank: 'Moderator',
                    newRank: 'Senior Moderator',
                    createdAt: daysAgo(60),
                },
            ],
        },
        [promotion]
    );

    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'promotion');
});

test('recognizes an excellent record with tenure, activity, and recognition', () => {
    const analysis = analyzeStaffProfile({
        now: NOW,
        profile: {
            staffStatus: 'Active',
            blacklistStatus: 'Not Blacklisted',
            joinedStaffAt: daysAgo(180),
            totalShiftMilliseconds:
                50 * 60 * 60 * 1000,
            promotionHistory: [
                {
                    promotionId: 'promotion-1',
                    createdAt: daysAgo(60),
                },
            ],
            awardHistory: [
                {
                    awardId: 'award-1',
                    status: 'active',
                    createdAt: daysAgo(20),
                },
                {
                    awardId: 'award-2',
                    status: 'active',
                    createdAt: daysAgo(40),
                },
            ],
        },
    });

    assert.equal(analysis.standing.label, 'Excellent');
    assert.equal(
        analysis.eligibility.label,
        'Eligible for management review'
    );
    assert.equal(analysis.totals.awards, 2);
});

test('active warnings require management review and lower standing', () => {
    const analysis = analyzeStaffProfile({
        now: NOW,
        profile: {
            staffStatus: 'Active',
            joinedStaffAt: daysAgo(120),
            infractionHistory: [
                {
                    infractionId: 'warning-1',
                    type: 'warning',
                    status: 'active',
                    createdAt: daysAgo(10),
                },
            ],
        },
    });

    assert.equal(
        analysis.standing.label,
        'Needs Review'
    );
    assert.equal(
        analysis.eligibility.label,
        'Management review required'
    );
    assert.equal(
        analysis.totals.activeInfractions,
        1
    );
});

test('resolved disciplinary records do not remain active blockers', () => {
    const analysis = analyzeStaffProfile({
        now: NOW,
        profile: {
            staffStatus: 'Active',
            joinedStaffAt: daysAgo(120),
            infractionHistory: [
                {
                    infractionId: 'warning-1',
                    type: 'warning',
                    status: 'resolved',
                    createdAt: daysAgo(10),
                },
            ],
        },
    });

    assert.equal(
        analysis.totals.activeInfractions,
        0
    );
    assert.equal(
        analysis.eligibility.label,
        'Eligible for management review'
    );
});

test('active notices take priority over recent-promotion guidance', () => {
    const analysis = analyzeStaffProfile({
        now: NOW,
        profile: {
            staffStatus: 'Active',
            joinedStaffAt: daysAgo(120),
            promotionHistory: [
                {
                    promotionId: 'promotion-recent',
                    createdAt: daysAgo(10),
                },
            ],
            infractionHistory: [
                {
                    infractionId: 'notice-active',
                    type: 'notice',
                    status: 'active',
                    createdAt: daysAgo(5),
                },
            ],
        },
    });

    assert.equal(
        analysis.eligibility.label,
        'Management review required'
    );
});

test('recent promotions produce waiting-period guidance', () => {
    const analysis = analyzeStaffProfile({
        now: NOW,
        profile: {
            staffStatus: 'Active',
            joinedStaffAt: daysAgo(180),
            promotionHistory: [
                {
                    promotionId: 'promotion-recent',
                    createdAt: daysAgo(12),
                },
            ],
        },
    });

    assert.equal(
        analysis.eligibility.label,
        'Waiting period recommended'
    );
    assert.equal(
        analysis.daysSincePromotion,
        12
    );
});

test('termination and blacklist states are always critical', () => {
    const analysis = analyzeStaffProfile({
        now: NOW,
        profile: {
            staffStatus: 'Terminated',
            joinedStaffAt: daysAgo(365),
        },
    });

    assert.equal(analysis.standing.label, 'Critical');
    assert.equal(
        analysis.eligibility.label,
        'Not recommended'
    );
});

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const DUPLICATE_WINDOW = 10 * 60 * 1000;

function getMemberPromotions(records, staffMemberId) {
    return (Array.isArray(records) ? records : []).filter(
        (record) =>
            record.staffMemberId === staffMemberId &&
            record.status !== 'voided'
    );
}

function findRecentPromotionDuplicate({
    records,
    staffMemberId,
    previousRank,
    newRank,
    now = Date.now(),
}) {
    return (
        getMemberPromotions(records, staffMemberId).find(
            (record) =>
                record.previousRank === previousRank &&
                record.newRank === newRank &&
                now - new Date(record.createdAt).getTime() <=
                    DUPLICATE_WINDOW
        ) || null
    );
}

function analyzePromotionProgression({
    records,
    staffMemberId,
    previousRankIndex,
    newRankIndex,
    now = Date.now(),
}) {
    const memberPromotions = getMemberPromotions(
        records,
        staffMemberId
    );
    const recentPromotions = memberPromotions.filter(
        (record) => {
            const createdAt = new Date(
                record.createdAt
            ).getTime();

            return Number.isFinite(createdAt) &&
                now - createdAt <= THIRTY_DAYS;
        }
    );
    const ranksAdvanced = Math.max(
        0,
        newRankIndex - previousRankIndex
    );

    let classification = 'Standard Advancement';
    let recommendation =
        'Normal promotion review recommended.';

    if (ranksAdvanced >= 3) {
        classification = 'Major Rank Advancement';
        recommendation =
            'Multiple ranks are being skipped; leadership should verify approval before confirming.';
    } else if (ranksAdvanced === 2) {
        classification = 'Accelerated Advancement';
        recommendation =
            'One intermediate rank is being skipped; verify the intended progression before confirming.';
    } else if (recentPromotions.length > 0) {
        classification = 'Recent Repeat Promotion';
        recommendation =
            'A promotion was recorded within the last 30 days; review performance history before confirming.';
    }

    return {
        ranksAdvanced,
        classification,
        recentPromotionCount:
            recentPromotions.length,
        totalPromotionCount:
            memberPromotions.length,
        recommendation,
    };
}

module.exports = {
    DUPLICATE_WINDOW,
    findRecentPromotionDuplicate,
    analyzePromotionProgression,
};

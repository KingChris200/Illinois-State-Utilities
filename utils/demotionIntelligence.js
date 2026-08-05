const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const DUPLICATE_WINDOW = 10 * 60 * 1000;

function getMemberDemotions(records, staffMemberId) {
    return (Array.isArray(records) ? records : []).filter(
        (record) =>
            record.staffMemberId === staffMemberId &&
            record.status !== 'voided'
    );
}

function findRecentDemotionDuplicate({
    records,
    staffMemberId,
    previousRank,
    newRank,
    now = Date.now(),
}) {
    return (
        getMemberDemotions(records, staffMemberId).find(
            (record) =>
                record.previousRank === previousRank &&
                record.newRank === newRank &&
                now - new Date(record.createdAt).getTime() <=
                    DUPLICATE_WINDOW
        ) || null
    );
}

function analyzeDemotionContext({
    demotions,
    infractions,
    staffMemberId,
    previousRankIndex,
    newRankIndex,
    now = Date.now(),
}) {
    const memberDemotions = getMemberDemotions(
        demotions,
        staffMemberId
    );
    const recentDemotions = memberDemotions.filter(
        (record) => {
            const timestamp = new Date(
                record.createdAt
            ).getTime();

            return Number.isFinite(timestamp) &&
                now - timestamp <= THIRTY_DAYS;
        }
    );
    const activeInfractions = (
        Array.isArray(infractions) ? infractions : []
    ).filter(
        (record) =>
            record.staffMemberId === staffMemberId &&
            record.status === 'active'
    );
    const ranksDropped = Math.max(
        0,
        previousRankIndex - newRankIndex
    );

    let level = 'Standard';
    let recommendation =
        'Normal management review recommended.';

    if (ranksDropped >= 3) {
        level = 'Critical';
        recommendation =
            'This removes three or more rank levels; leadership approval and complete evidence should be verified.';
    } else if (ranksDropped === 2) {
        level = 'High';
        recommendation =
            'This skips an intermediate rank; verify the intended outcome before confirming.';
    } else if (
        recentDemotions.length > 0 ||
        activeInfractions.length > 0
    ) {
        level = 'Elevated';
        recommendation =
            'Recent disciplinary history exists; review related records before confirming.';
    }

    return {
        level,
        ranksDropped,
        recentDemotionCount:
            recentDemotions.length,
        activeInfractionCount:
            activeInfractions.length,
        totalPriorDemotions:
            memberDemotions.length,
        recommendation,
    };
}

module.exports = {
    DUPLICATE_WINDOW,
    findRecentDemotionDuplicate,
    analyzeDemotionContext,
};

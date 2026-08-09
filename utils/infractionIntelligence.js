const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const DUPLICATE_WINDOW = 10 * 60 * 1000;

const ACTION_SEVERITY = {
    notice: 1,
    inactivity_notice: 1,
    warning: 2,
    strike: 3,
    demotion: 3,
    termination: 4,
    blacklist: 4,
};

function normalizeReason(reason) {
    return String(reason || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getMemberInfractions(records, staffMemberId) {
    return (Array.isArray(records) ? records : []).filter(
        (record) =>
            record.staffMemberId === staffMemberId &&
            record.status !== 'voided'
    );
}

function findRecentDuplicate({
    records,
    staffMemberId,
    infractionType,
    reason,
    now = Date.now(),
}) {
    const normalizedReason = normalizeReason(reason);

    return (
        getMemberInfractions(records, staffMemberId).find(
            (record) =>
                record.type === infractionType &&
                normalizeReason(record.reason) ===
                    normalizedReason &&
                now - new Date(record.createdAt).getTime() <=
                    DUPLICATE_WINDOW
        ) || null
    );
}

function analyzeInfractionHistory({
    records,
    staffMemberId,
    infractionType,
    now = Date.now(),
}) {
    const memberRecords = getMemberInfractions(
        records,
        staffMemberId
    );
    const activeRecords = memberRecords.filter(
        (record) => record.status === 'active'
    );
    const recentRecords = memberRecords.filter((record) => {
        const createdAt = new Date(record.createdAt).getTime();
        return Number.isFinite(createdAt) &&
            now - createdAt <= THIRTY_DAYS;
    });
    const activeWarnings = activeRecords.filter(
        (record) => record.type === 'warning'
    ).length;
    const activeStrikes = activeRecords.filter(
        (record) => record.type === 'strike'
    ).length;
    const sameTypeCount = activeRecords.filter(
        (record) => record.type === infractionType
    ).length;

    const baseSeverity = ACTION_SEVERITY[infractionType] || 1;
    const repeatScore = Math.min(
        2,
        activeWarnings + activeStrikes
    );
    const score = Math.min(
        4,
        baseSeverity + repeatScore
    );
    const level =
        ['Low', 'Moderate', 'High', 'Critical'][score - 1] ||
        'Low';

    let recommendation =
        'Standard documentation review recommended.';

    if (
        infractionType === 'termination' ||
        infractionType === 'blacklist'
    ) {
        recommendation =
            'Leadership approval and complete evidence should be verified before confirmation.';
    } else if (
        infractionType === 'demotion'
    ) {
        recommendation =
            'Leadership should verify the replacement rank, role update, supporting evidence, and future advancement expectations.';
    } else if (infractionType === 'strike' || activeStrikes > 0) {
        recommendation =
            'Escalated management review is recommended due to strike-level history.';
    } else if (activeWarnings > 0 || recentRecords.length >= 2) {
        recommendation =
            'Repeat conduct detected; review prior cases before confirming.';
    }

    return {
        level,
        score,
        activeCount: activeRecords.length,
        recentCount: recentRecords.length,
        activeWarnings,
        activeStrikes,
        sameTypeCount,
        recommendation,
    };
}

module.exports = {
    ACTION_SEVERITY,
    DUPLICATE_WINDOW,
    normalizeReason,
    findRecentDuplicate,
    analyzeInfractionHistory,
};

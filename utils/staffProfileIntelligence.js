const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

const INFRACTION_WEIGHTS = {
    notice: 6,
    inactivity_notice: 5,
    warning: 15,
    strike: 30,
    termination: 100,
    blacklist: 100,
};

const INACTIVE_STATUSES = new Set([
    'revoked',
    'resolved',
    'dismissed',
    'expired',
    'appealed',
    'closed',
]);

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function getTimestamp(value) {
    const timestamp = new Date(value || 0).getTime();

    return Number.isFinite(timestamp)
        ? timestamp
        : 0;
}

function isWithinDays(record, nowTimestamp, days) {
    const timestamp = getTimestamp(
        record.createdAt ||
            record.updatedAt ||
            record.requestedAt
    );

    return Boolean(
        timestamp > 0 &&
            timestamp <= nowTimestamp &&
            nowTimestamp - timestamp <=
                days * DAY_MILLISECONDS
    );
}

function getEventType(record) {
    const historyType = normalizeText(
        record.historyType
    );

    if (
        historyType === 'promotion' ||
        normalizeText(record.type) === 'promotion'
    ) {
        return 'promotion';
    }

    if (
        historyType === 'demotion' ||
        normalizeText(record.type) === 'demotion'
    ) {
        return 'demotion';
    }

    if (
        historyType.startsWith('award') ||
        normalizeText(record.type) === 'award'
    ) {
        return 'award';
    }

    const infractionType = normalizeText(
        record.type
    );

    if (
        historyType === 'infraction' ||
        Object.hasOwn(
            INFRACTION_WEIGHTS,
            infractionType
        )
    ) {
        return infractionType || 'infraction';
    }

    if (historyType.startsWith('loa')) {
        return historyType;
    }

    return historyType || infractionType || 'unknown';
}

function getRecordIdentifier(record, eventType) {
    return String(
        record.id ||
            record.promotionId ||
            record.demotionId ||
            record.infractionId ||
            record.awardId ||
            [
                eventType,
                record.createdAt || '',
                record.reason || '',
                record.previousRank || '',
                record.newRank || '',
            ].join(':')
    );
}

function addEvents(target, seen, records, forcedType = null) {
    if (!Array.isArray(records)) {
        return;
    }

    for (const sourceRecord of records) {
        if (
            !sourceRecord ||
            typeof sourceRecord !== 'object'
        ) {
            continue;
        }

        const eventType =
            forcedType || getEventType(sourceRecord);

        const identifier = getRecordIdentifier(
            sourceRecord,
            eventType
        );

        if (seen.has(identifier)) {
            continue;
        }

        seen.add(identifier);
        target.push({
            ...sourceRecord,
            eventType,
        });
    }
}

function collectStaffEvents(profile = {}, history = []) {
    const events = [];
    const seen = new Set();

    addEvents(
        events,
        seen,
        profile.promotionHistory,
        'promotion'
    );
    addEvents(
        events,
        seen,
        profile.demotionHistory,
        'demotion'
    );
    addEvents(
        events,
        seen,
        profile.infractionHistory
    );
    addEvents(
        events,
        seen,
        profile.awardHistory,
        'award'
    );
    addEvents(events, seen, history);

    return events.sort(
        (first, second) =>
            getTimestamp(second.createdAt) -
            getTimestamp(first.createdAt)
    );
}

function isActiveRecord(record) {
    return !INACTIVE_STATUSES.has(
        normalizeText(record.status)
    );
}

function getStanding(score, isCritical) {
    if (isCritical || score < 45) {
        return {
            label: 'Critical',
            emoji: '🔴',
            color: 0xed4245,
        };
    }

    if (score < 70) {
        return {
            label: 'Needs Review',
            emoji: '🟠',
            color: 0xf47b20,
        };
    }

    if (score < 90) {
        return {
            label: 'Good',
            emoji: '🟢',
            color: 0x57f287,
        };
    }

    return {
        label: 'Excellent',
        emoji: '🌟',
        color: 0xfee75c,
    };
}

function analyzeStaffProfile({
    profile = {},
    history = [],
    now = new Date(),
} = {}) {
    const nowTimestamp = getTimestamp(now);
    const events = collectStaffEvents(
        profile,
        history
    );

    const promotions = events.filter(
        (record) => record.eventType === 'promotion'
    );
    const demotions = events.filter(
        (record) => record.eventType === 'demotion'
    );
    const awards = events.filter(
        (record) =>
            record.eventType === 'award' &&
            isActiveRecord(record)
    );
    const infractions = events.filter((record) =>
        Object.hasOwn(
            INFRACTION_WEIGHTS,
            record.eventType
        )
    );
    const activeInfractions = infractions.filter(
        isActiveRecord
    );

    const recent30 = events.filter((record) =>
        isWithinDays(record, nowTimestamp, 30)
    );
    const recent90 = events.filter((record) =>
        isWithinDays(record, nowTimestamp, 90)
    );

    const recentPromotions = promotions.filter(
        (record) =>
            isWithinDays(record, nowTimestamp, 30)
    );
    const recentDemotions = demotions.filter(
        (record) =>
            isWithinDays(record, nowTimestamp, 90)
    );
    const recentAwards = awards.filter((record) =>
        isWithinDays(record, nowTimestamp, 180)
    );

    const staffStatus = normalizeText(
        profile.staffStatus
    );
    const blacklistStatus = normalizeText(
        profile.blacklistStatus
    );

    const terminalProfile =
        staffStatus === 'terminated' ||
        staffStatus === 'blacklisted' ||
        (blacklistStatus.length > 0 &&
            blacklistStatus !== 'not blacklisted');

    const criticalInfraction =
        activeInfractions.some((record) =>
            ['termination', 'blacklist'].includes(
                record.eventType
            )
        );

    const activeInfractionScore =
        activeInfractions.reduce(
            (total, record) =>
                total +
                INFRACTION_WEIGHTS[
                    record.eventType
                ],
            0
        );

    const demotionPenalty =
        recentDemotions.length * 16;

    const positiveScore = Math.min(
        16,
        recentAwards.length * 4 +
            promotions.filter((record) =>
                isWithinDays(
                    record,
                    nowTimestamp,
                    180
                )
            ).length *
                3
    );

    const shiftHours = Math.max(
        0,
        Number(profile.totalShiftMilliseconds || 0) /
            3600000
    );
    const activityScore = Math.min(
        4,
        Math.floor(shiftHours / 10)
    );

    const score = Math.max(
        0,
        Math.min(
            100,
            80 -
                activeInfractionScore -
                demotionPenalty +
                positiveScore +
                activityScore
        )
    );

    const isCritical =
        terminalProfile || criticalInfraction;
    const standing = getStanding(
        score,
        isCritical
    );

    const joinedTimestamp = getTimestamp(
        profile.joinedStaffAt || profile.createdAt
    );
    const tenureDays = joinedTimestamp
        ? Math.max(
              0,
              Math.floor(
                  (nowTimestamp - joinedTimestamp) /
                      DAY_MILLISECONDS
              )
          )
        : null;

    const latestPromotion = promotions[0] || null;
    const daysSincePromotion = latestPromotion
        ? Math.max(
              0,
              Math.floor(
                  (nowTimestamp -
                      getTimestamp(
                          latestPromotion.createdAt
                      )) /
                      DAY_MILLISECONDS
              )
          )
        : null;

    let eligibility = {
        label: 'Eligible for management review',
        emoji: '✅',
        recommendation:
            'No automatic blocker was found. Leadership should still review performance, activity, conduct, and rank availability before approving a promotion.',
    };

    if (isCritical) {
        eligibility = {
            label: 'Not recommended',
            emoji: '⛔',
            recommendation:
                'A termination, blacklist, or critical active record must be resolved before promotion consideration.',
        };
    } else if (
        activeInfractions.some(
            (record) =>
                INFRACTION_WEIGHTS[
                    record.eventType
                ] >= 15
        ) ||
        recentDemotions.length > 0
    ) {
        eligibility = {
            label: 'Management review required',
            emoji: '⚠️',
            recommendation:
                'Recent disciplinary or demotion history should be reviewed by leadership before any promotion decision.',
        };
    } else if (activeInfractions.length > 0) {
        eligibility = {
            label: 'Management review required',
            emoji: '⚠️',
            recommendation:
                'An active disciplinary record exists and should be reviewed before promotion consideration.',
        };
    } else if (profile.activeLoa) {
        eligibility = {
            label: 'Review after leave',
            emoji: '🕒',
            recommendation:
                'The member has an active leave record. Reassess activity and readiness after they return.',
        };
    } else if (recentPromotions.length > 0) {
        eligibility = {
            label: 'Waiting period recommended',
            emoji: '🕒',
            recommendation:
                'A promotion was recorded within the last 30 days. Allow time for performance at the current rank before another advancement.',
        };
    } else if (
        tenureDays !== null &&
        tenureDays < 30
    ) {
        eligibility = {
            label: 'More tenure recommended',
            emoji: '🕒',
            recommendation:
                'Fewer than 30 days of staff tenure are recorded. Leadership should gather more performance history first.',
        };
    }

    const factors = [];

    if (activeInfractions.length > 0) {
        factors.push(
            `${activeInfractions.length} active disciplinary record(s)`
        );
    }

    if (recentDemotions.length > 0) {
        factors.push(
            `${recentDemotions.length} demotion(s) within 90 days`
        );
    }

    if (recentPromotions.length > 0) {
        factors.push(
            `${recentPromotions.length} promotion(s) within 30 days`
        );
    }

    if (recentAwards.length > 0) {
        factors.push(
            `${recentAwards.length} active award(s) within 180 days`
        );
    }

    if (profile.activeLoa) {
        factors.push('Active leave of absence');
    }

    if (factors.length === 0) {
        factors.push(
            'No recent risk or recognition factors were found'
        );
    }

    return {
        score,
        standing,
        eligibility,
        factors,
        events,
        careerTimeline: events
            .filter((record) =>
                ['promotion', 'award'].includes(
                    record.eventType
                )
            )
            .slice(0, 5),
        disciplinaryTimeline: events
            .filter(
                (record) =>
                    record.eventType === 'demotion' ||
                    Object.hasOwn(
                        INFRACTION_WEIGHTS,
                        record.eventType
                    )
            )
            .slice(0, 5),
        totals: {
            promotions: promotions.length,
            demotions: demotions.length,
            awards: awards.length,
            infractions: infractions.length,
            activeInfractions:
                activeInfractions.length,
        },
        recent: {
            actions30Days: recent30.length,
            actions90Days: recent90.length,
            promotions30Days:
                recentPromotions.length,
            demotions90Days:
                recentDemotions.length,
            awards180Days: recentAwards.length,
        },
        tenureDays,
        daysSincePromotion,
    };
}

module.exports = {
    DAY_MILLISECONDS,
    INFRACTION_WEIGHTS,
    collectStaffEvents,
    analyzeStaffProfile,
    getEventType,
    isActiveRecord,
};

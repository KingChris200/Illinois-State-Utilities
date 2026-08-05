function toNonNegativeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? Math.max(0, number)
        : fallback;
}

function toOptionalCount(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? Math.max(0, number)
        : null;
}

function createSessionAnalytics(source = {}) {
    return {
        startingPlayerCount: toOptionalCount(
            source.startingPlayerCount
        ),
        peakPlayerCount: toOptionalCount(
            source.peakPlayerCount
        ),
        endingPlayerCount: toOptionalCount(
            source.endingPlayerCount
        ),
        minimumPlayerCount: toOptionalCount(
            source.minimumPlayerCount
        ),
        playerCountTotal: toNonNegativeNumber(
            source.playerCountTotal
        ),
        sampleCount: Math.floor(
            toNonNegativeNumber(source.sampleCount)
        ),
        peakStaffCount: toOptionalCount(
            source.peakStaffCount
        ),
        peakQueueCount: toOptionalCount(
            source.peakQueueCount
        ),
        firstSampleAt: toOptionalCount(
            source.firstSampleAt
        ),
        lastSampleAt: toOptionalCount(
            source.lastSampleAt
        ),
    };
}

function recordSessionSample(
    source,
    {
        currentPlayers,
        staffCount = null,
        queueCount = null,
        sampledAt = Date.now(),
    }
) {
    const analytics = createSessionAnalytics(source);
    const playerCount = toOptionalCount(currentPlayers);

    if (playerCount === null) {
        return analytics;
    }

    const timestamp = toNonNegativeNumber(
        sampledAt,
        Date.now()
    );
    const normalizedStaffCount =
        toOptionalCount(staffCount);
    const normalizedQueueCount =
        toOptionalCount(queueCount);

    if (analytics.startingPlayerCount === null) {
        analytics.startingPlayerCount = playerCount;
        analytics.firstSampleAt = timestamp;
    }

    analytics.endingPlayerCount = playerCount;
    analytics.peakPlayerCount = Math.max(
        analytics.peakPlayerCount ?? playerCount,
        playerCount
    );
    analytics.minimumPlayerCount = Math.min(
        analytics.minimumPlayerCount ?? playerCount,
        playerCount
    );
    analytics.playerCountTotal += playerCount;
    analytics.sampleCount += 1;
    analytics.lastSampleAt = timestamp;

    if (normalizedStaffCount !== null) {
        analytics.peakStaffCount = Math.max(
            analytics.peakStaffCount ??
                normalizedStaffCount,
            normalizedStaffCount
        );
    }

    if (normalizedQueueCount !== null) {
        analytics.peakQueueCount = Math.max(
            analytics.peakQueueCount ??
                normalizedQueueCount,
            normalizedQueueCount
        );
    }

    return analytics;
}

function calculateAttendanceComparison(
    attendeeCount,
    peakPlayerCount
) {
    const confirmed = Math.floor(
        toNonNegativeNumber(attendeeCount)
    );
    const peak = toOptionalCount(peakPlayerCount);

    if (peak === null) {
        return {
            confirmed,
            peak: null,
            difference: null,
            label: 'Unavailable',
            summary:
                'No live ER:LC samples were available for comparison.',
        };
    }

    const difference = peak - confirmed;
    const sign = difference > 0 ? '+' : '';

    let label = 'Matched';

    if (difference > 0) {
        label = 'Exceeded confirmations';
    } else if (difference < 0) {
        label = 'Below confirmations';
    }

    return {
        confirmed,
        peak,
        difference,
        label,
        summary:
            `**${peak}** peak players vs **${confirmed}** confirmed attendees ` +
            `(${sign}${difference})`,
    };
}

function summarizeSessionAnalytics(
    session,
    endedAt = session?.endedAt ?? Date.now()
) {
    const analytics = createSessionAnalytics(
        session?.analytics
    );
    const startedAt = toNonNegativeNumber(
        session?.startedAt,
        endedAt
    );
    const normalizedEndedAt = toNonNegativeNumber(
        endedAt,
        Date.now()
    );
    const averagePlayerCount =
        analytics.sampleCount > 0
            ? analytics.playerCountTotal /
              analytics.sampleCount
            : null;
    const attendeeCount = Array.isArray(
        session?.attendeeIds
    )
        ? session.attendeeIds.length
        : 0;

    return {
        ...analytics,
        averagePlayerCount,
        averagePlayerCountDisplay:
            averagePlayerCount === null
                ? null
                : Number(
                      averagePlayerCount.toFixed(1)
                  ),
        attendeeCount,
        attendanceComparison:
            calculateAttendanceComparison(
                attendeeCount,
                analytics.peakPlayerCount
            ),
        startedAt,
        endedAt: normalizedEndedAt,
        durationMilliseconds: Math.max(
            0,
            normalizedEndedAt - startedAt
        ),
    };
}

module.exports = {
    createSessionAnalytics,
    recordSessionSample,
    calculateAttendanceComparison,
    summarizeSessionAnalytics,
};

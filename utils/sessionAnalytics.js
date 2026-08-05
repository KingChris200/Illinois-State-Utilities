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

function normalizeSessionHistory(records) {
    if (!Array.isArray(records)) {
        return [];
    }

    return records
        .filter(
            (record) =>
                record &&
                typeof record === 'object' &&
                !Array.isArray(record)
        )
        .map((record) => ({
            ...record,
            attendeeCount: toNonNegativeNumber(
                record.attendeeCount
            ),
            peakPlayerCount: toOptionalCount(
                record.peakPlayerCount
            ),
            averagePlayerCount: toOptionalCount(
                record.averagePlayerCount
            ),
            peakQueueCount: toOptionalCount(
                record.peakQueueCount
            ),
            durationMilliseconds:
                toNonNegativeNumber(
                    record.durationMilliseconds
                ),
            attendanceDifference:
                record.attendanceDifference !== null &&
                record.attendanceDifference !== undefined &&
                Number.isFinite(
                    Number(record.attendanceDifference)
                )
                    ? Number(
                          record.attendanceDifference
                      )
                    : null,
        }))
        .sort(
            (first, second) =>
                getHistoryTimestamp(second) -
                getHistoryTimestamp(first)
        );
}

function getHistoryTimestamp(record) {
    const timestamp = new Date(
        record.endedAt ||
            record.createdAt ||
            record.startedAt ||
            0
    ).getTime();

    return Number.isFinite(timestamp)
        ? timestamp
        : 0;
}

function averageAvailable(records, fieldName) {
    const values = records
        .map((record) => record[fieldName])
        .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
        return null;
    }

    return (
        values.reduce(
            (total, value) => total + value,
            0
        ) / values.length
    );
}

function summarizeSessionHistory(records) {
    const history = normalizeSessionHistory(records);

    if (history.length === 0) {
        return {
            sessionCount: 0,
            totalDurationMilliseconds: 0,
            averageDurationMilliseconds: null,
            totalConfirmedAttendance: 0,
            averageConfirmedAttendance: null,
            averagePeakPlayerCount: null,
            averagePlayerCount: null,
            newestSession: null,
            oldestSession: null,
        };
    }

    const totalDurationMilliseconds =
        history.reduce(
            (total, record) =>
                total + record.durationMilliseconds,
            0
        );
    const totalConfirmedAttendance =
        history.reduce(
            (total, record) =>
                total + record.attendeeCount,
            0
        );

    return {
        sessionCount: history.length,
        totalDurationMilliseconds,
        averageDurationMilliseconds:
            totalDurationMilliseconds /
            history.length,
        totalConfirmedAttendance,
        averageConfirmedAttendance:
            totalConfirmedAttendance /
            history.length,
        averagePeakPlayerCount:
            averageAvailable(
                history,
                'peakPlayerCount'
            ),
        averagePlayerCount: averageAvailable(
            history,
            'averagePlayerCount'
        ),
        newestSession: history[0],
        oldestSession:
            history[history.length - 1],
    };
}

function selectMaximumRecord(
    records,
    fieldName
) {
    return records.reduce((best, record) => {
        if (!Number.isFinite(record[fieldName])) {
            return best;
        }

        if (
            !best ||
            record[fieldName] > best[fieldName]
        ) {
            return record;
        }

        return best;
    }, null);
}

function findSessionRecords(records) {
    const history = normalizeSessionHistory(records);

    return {
        highestPeak: selectMaximumRecord(
            history,
            'peakPlayerCount'
        ),
        highestAverage: selectMaximumRecord(
            history,
            'averagePlayerCount'
        ),
        longestSession: selectMaximumRecord(
            history,
            'durationMilliseconds'
        ),
        largestQueue: selectMaximumRecord(
            history,
            'peakQueueCount'
        ),
        highestConfirmedAttendance:
            selectMaximumRecord(
                history,
                'attendeeCount'
            ),
        strongestTurnout: selectMaximumRecord(
            history,
            'attendanceDifference'
        ),
    };
}

module.exports = {
    createSessionAnalytics,
    recordSessionSample,
    calculateAttendanceComparison,
    summarizeSessionAnalytics,
    normalizeSessionHistory,
    summarizeSessionHistory,
    findSessionRecords,
};

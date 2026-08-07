const {
    readDatabase,
    updateDatabase,
    createRecordId,
} = require('./database');

const WATCHLIST_DATABASE_NAME = 'private-watchlist';
const WATCHLIST_VERSION = 1;
const MAX_AUDIT_ENTRIES = 100;
const VALID_SEVERITIES = [
    'low',
    'medium',
    'high',
    'critical',
];
const VALID_STATUSES = [
    'active',
    'resolved',
    'removed',
];

const defaultStore = {
    readDatabase,
    updateDatabase,
};

class WatchlistError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'WatchlistError';
        this.code = code;
    }
}

function cleanText(value, maximumLength = 1000) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();
    return text
        ? text.slice(0, maximumLength)
        : null;
}

function normalizeSeverity(value) {
    const severity = String(value || '')
        .trim()
        .toLowerCase();

    if (!VALID_SEVERITIES.includes(severity)) {
        throw new WatchlistError(
            'INVALID_SEVERITY',
            'The selected watchlist severity is invalid.'
        );
    }

    return severity;
}

function normalizeDatabase(value) {
    const database =
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
            ? value
            : {};

    const guilds =
        database.guilds &&
        typeof database.guilds === 'object' &&
        !Array.isArray(database.guilds)
            ? database.guilds
            : {};

    return {
        version: WATCHLIST_VERSION,
        guilds,
    };
}

function getGuildRecords(database, guildId) {
    const normalized = normalizeDatabase(database);
    const records = normalized.guilds[String(guildId)];
    return Array.isArray(records) ? records : [];
}

function ensureGuildRecords(database, guildId) {
    const normalized = normalizeDatabase(database);
    const key = String(guildId);

    if (!Array.isArray(normalized.guilds[key])) {
        normalized.guilds[key] = [];
    }

    return normalized;
}

function createAuditEntry({
    action,
    actorId,
    actorUsername,
    reason,
    changes = null,
    createdAt = new Date().toISOString(),
}) {
    return {
        id: createRecordId('watch-event'),
        action: cleanText(action, 50) || 'updated',
        actorId: cleanText(actorId, 30),
        actorUsername: cleanText(actorUsername, 100),
        reason: cleanText(reason, 500),
        changes:
            changes &&
            typeof changes === 'object' &&
            !Array.isArray(changes)
                ? changes
                : null,
        createdAt,
    };
}

function appendAudit(record, auditEntry) {
    const auditLog = Array.isArray(record.auditLog)
        ? record.auditLog
        : [];

    record.auditLog = [...auditLog, auditEntry].slice(
        -MAX_AUDIT_ENTRIES
    );
}

function createWatchlistRecord({
    guildId,
    guildName,
    robloxUserId,
    robloxUsername,
    robloxDisplayName,
    severity,
    reason,
    evidence = null,
    notes = null,
    createdById,
    createdByUsername,
    createdAt = new Date().toISOString(),
}) {
    if (!guildId || !robloxUserId || !robloxUsername) {
        throw new WatchlistError(
            'INVALID_IDENTITY',
            'A complete Roblox identity is required.'
        );
    }

    const normalizedReason = cleanText(reason, 1000);

    if (!normalizedReason) {
        throw new WatchlistError(
            'REASON_REQUIRED',
            'A reason is required for a watchlist entry.'
        );
    }

    const record = {
        id: createRecordId('watch'),
        guildId: String(guildId),
        guildName: cleanText(guildName, 150),
        robloxUserId: String(robloxUserId),
        robloxUsername: cleanText(robloxUsername, 50),
        robloxDisplayName:
            cleanText(robloxDisplayName, 100) ||
            cleanText(robloxUsername, 50),
        severity: normalizeSeverity(severity),
        status: 'active',
        reason: normalizedReason,
        evidence: cleanText(evidence, 1000),
        notes: cleanText(notes, 750),
        createdById: cleanText(createdById, 30),
        createdByUsername:
            cleanText(createdByUsername, 100),
        createdAt,
        updatedAt: createdAt,
        resolvedAt: null,
        resolvedById: null,
        resolution: null,
        removedAt: null,
        removedById: null,
        removalReason: null,
        auditLog: [],
    };

    appendAudit(
        record,
        createAuditEntry({
            action: 'entry_created',
            actorId: createdById,
            actorUsername: createdByUsername,
            reason: normalizedReason,
            createdAt,
        })
    );

    return record;
}

async function addWatchlistEntry(
    details,
    store = defaultStore
) {
    const record = createWatchlistRecord(details);

    await store.updateDatabase(
        WATCHLIST_DATABASE_NAME,
        (database) => {
            const normalized = ensureGuildRecords(
                database,
                details.guildId
            );
            const records =
                normalized.guilds[String(details.guildId)];
            const duplicate = records.find(
                (existing) =>
                    existing.status === 'active' &&
                    String(existing.robloxUserId) ===
                        record.robloxUserId
            );

            if (duplicate) {
                throw new WatchlistError(
                    'ACTIVE_ENTRY_EXISTS',
                    `An active entry already exists for this Roblox user (${duplicate.id}).`
                );
            }

            records.push(record);
            return normalized;
        },
        normalizeDatabase(null)
    );

    return record;
}

async function getWatchlistEntry(
    guildId,
    entryId,
    store = defaultStore
) {
    const database = await store.readDatabase(
        WATCHLIST_DATABASE_NAME,
        normalizeDatabase(null)
    );
    const normalizedId = String(entryId || '').toLowerCase();

    return (
        getGuildRecords(database, guildId).find(
            (record) =>
                String(record.id || '').toLowerCase() ===
                normalizedId
        ) || null
    );
}

async function getActiveWatchlistEntries(
    guildId,
    store = defaultStore
) {
    const database = await store.readDatabase(
        WATCHLIST_DATABASE_NAME,
        normalizeDatabase(null)
    );

    return getGuildRecords(database, guildId)
        .filter((record) => record.status === 'active')
        .sort(sortNewestFirst);
}

async function findWatchlistEntries(
    guildId,
    query,
    { includeRemoved = false } = {},
    store = defaultStore
) {
    const database = await store.readDatabase(
        WATCHLIST_DATABASE_NAME,
        normalizeDatabase(null)
    );
    const normalizedQuery = String(query || '')
        .trim()
        .toLowerCase();

    if (!normalizedQuery) {
        return [];
    }

    return getGuildRecords(database, guildId)
        .filter(
            (record) =>
                includeRemoved || record.status !== 'removed'
        )
        .filter((record) =>
            [
                record.id,
                record.robloxUserId,
                record.robloxUsername,
                record.robloxDisplayName,
            ].some((value) =>
                String(value || '')
                    .toLowerCase()
                    .includes(normalizedQuery)
            )
        )
        .sort(sortNewestFirst);
}

async function searchWatchlistEntries(
    guildId,
    {
        query = null,
        status = 'active',
        severity = null,
        limit = 10,
    } = {},
    store = defaultStore
) {
    const database = await store.readDatabase(
        WATCHLIST_DATABASE_NAME,
        normalizeDatabase(null)
    );
    const normalizedQuery = String(query || '')
        .trim()
        .toLowerCase();
    const normalizedStatus = String(status || 'active')
        .trim()
        .toLowerCase();
    const safeLimit = Math.min(
        20,
        Math.max(1, Number(limit) || 10)
    );

    return getGuildRecords(database, guildId)
        .filter((record) => {
            if (
                normalizedStatus !== 'all' &&
                record.status !== normalizedStatus
            ) {
                return false;
            }

            if (severity && record.severity !== severity) {
                return false;
            }

            if (!normalizedQuery) {
                return true;
            }

            return [
                record.id,
                record.robloxUserId,
                record.robloxUsername,
                record.robloxDisplayName,
                record.reason,
                record.evidence,
                record.notes,
            ].some((value) =>
                String(value || '')
                    .toLowerCase()
                    .includes(normalizedQuery)
            );
        })
        .sort(sortNewestFirst)
        .slice(0, safeLimit);
}

async function updateWatchlistEntry(
    guildId,
    entryId,
    {
        patch,
        actorId,
        actorUsername,
        changeReason,
    },
    store = defaultStore
) {
    const allowedFields = [
        'severity',
        'reason',
        'evidence',
        'notes',
    ];
    const changes = {};
    let updatedRecord = null;

    await store.updateDatabase(
        WATCHLIST_DATABASE_NAME,
        (database) => {
            const normalized = ensureGuildRecords(
                database,
                guildId
            );
            const records = normalized.guilds[String(guildId)];
            const record = records.find(
                (candidate) =>
                    String(candidate.id || '').toLowerCase() ===
                    String(entryId || '').toLowerCase()
            );

            if (!record || record.status === 'removed') {
                throw new WatchlistError(
                    'ENTRY_NOT_FOUND',
                    'That watchlist entry could not be found.'
                );
            }

            for (const field of allowedFields) {
                if (!Object.hasOwn(patch, field)) {
                    continue;
                }

                const nextValue =
                    field === 'severity'
                        ? normalizeSeverity(patch[field])
                        : cleanText(
                              patch[field],
                              field === 'notes' ? 750 : 1000
                          );

                if (
                    field === 'reason' &&
                    !nextValue
                ) {
                    throw new WatchlistError(
                        'REASON_REQUIRED',
                        'The main watchlist reason cannot be empty.'
                    );
                }

                if (record[field] === nextValue) {
                    continue;
                }

                changes[field] = {
                    before: record[field] ?? null,
                    after: nextValue,
                };
                record[field] = nextValue;
            }

            if (Object.keys(changes).length === 0) {
                throw new WatchlistError(
                    'NO_CHANGES',
                    'No watchlist fields were changed.'
                );
            }

            record.updatedAt = new Date().toISOString();
            appendAudit(
                record,
                createAuditEntry({
                    action: 'entry_updated',
                    actorId,
                    actorUsername,
                    reason: changeReason,
                    changes,
                    createdAt: record.updatedAt,
                })
            );
            updatedRecord = structuredClone(record);
            return normalized;
        },
        normalizeDatabase(null)
    );

    return updatedRecord;
}

async function resolveWatchlistEntry(
    guildId,
    entryId,
    {
        resolution,
        actorId,
        actorUsername,
    },
    store = defaultStore
) {
    return changeEntryStatus(
        guildId,
        entryId,
        {
            nextStatus: 'resolved',
            action: 'entry_resolved',
            reason: resolution,
            actorId,
            actorUsername,
        },
        store
    );
}

async function removeWatchlistEntry(
    guildId,
    entryId,
    {
        removalReason,
        actorId,
        actorUsername,
    },
    store = defaultStore
) {
    return changeEntryStatus(
        guildId,
        entryId,
        {
            nextStatus: 'removed',
            action: 'entry_removed',
            reason: removalReason,
            actorId,
            actorUsername,
        },
        store
    );
}

async function recordWatchlistEvent(
    guildId,
    entryId,
    {
        action,
        reason,
        actorId,
        actorUsername,
    },
    store = defaultStore
) {
    const allowedActions = [
        'alert_acknowledged',
        'match_dismissed',
    ];

    if (!allowedActions.includes(action)) {
        throw new WatchlistError(
            'INVALID_EVENT',
            'That watchlist event is not supported.'
        );
    }

    const normalizedReason = cleanText(reason, 500);
    let updatedRecord = null;

    await store.updateDatabase(
        WATCHLIST_DATABASE_NAME,
        (database) => {
            const normalized = ensureGuildRecords(
                database,
                guildId
            );
            const records = normalized.guilds[String(guildId)];
            const record = records.find(
                (candidate) =>
                    String(candidate.id || '').toLowerCase() ===
                    String(entryId || '').toLowerCase()
            );

            if (!record || record.status !== 'active') {
                throw new WatchlistError(
                    'ENTRY_NOT_ACTIVE',
                    'That watchlist entry is no longer active.'
                );
            }

            const createdAt = new Date().toISOString();
            record.updatedAt = createdAt;

            if (action === 'alert_acknowledged') {
                record.lastAcknowledgedAt = createdAt;
                record.lastAcknowledgedById = cleanText(
                    actorId,
                    30
                );
            } else {
                if (!normalizedReason) {
                    throw new WatchlistError(
                        'REASON_REQUIRED',
                        'A reason is required to dismiss a match.'
                    );
                }

                record.lastDismissedAt = createdAt;
                record.lastDismissedById = cleanText(
                    actorId,
                    30
                );
                record.lastDismissalReason = normalizedReason;
            }

            appendAudit(
                record,
                createAuditEntry({
                    action,
                    actorId,
                    actorUsername,
                    reason: normalizedReason,
                    createdAt,
                })
            );
            updatedRecord = structuredClone(record);
            return normalized;
        },
        normalizeDatabase(null)
    );

    return updatedRecord;
}

async function changeEntryStatus(
    guildId,
    entryId,
    {
        nextStatus,
        action,
        reason,
        actorId,
        actorUsername,
    },
    store
) {
    if (!VALID_STATUSES.includes(nextStatus)) {
        throw new WatchlistError(
            'INVALID_STATUS',
            'The requested watchlist status is invalid.'
        );
    }

    const normalizedReason = cleanText(reason, 750);

    if (!normalizedReason) {
        throw new WatchlistError(
            'REASON_REQUIRED',
            'A reason is required for this action.'
        );
    }

    let updatedRecord = null;

    await store.updateDatabase(
        WATCHLIST_DATABASE_NAME,
        (database) => {
            const normalized = ensureGuildRecords(
                database,
                guildId
            );
            const records = normalized.guilds[String(guildId)];
            const record = records.find(
                (candidate) =>
                    String(candidate.id || '').toLowerCase() ===
                    String(entryId || '').toLowerCase()
            );

            if (!record || record.status === 'removed') {
                throw new WatchlistError(
                    'ENTRY_NOT_FOUND',
                    'That watchlist entry could not be found.'
                );
            }

            if (record.status === nextStatus) {
                throw new WatchlistError(
                    'STATUS_UNCHANGED',
                    `That entry is already ${nextStatus}.`
                );
            }

            const previousStatus = record.status;
            const changedAt = new Date().toISOString();
            record.status = nextStatus;
            record.updatedAt = changedAt;

            if (nextStatus === 'resolved') {
                record.resolvedAt = changedAt;
                record.resolvedById = cleanText(actorId, 30);
                record.resolution = normalizedReason;
            }

            if (nextStatus === 'removed') {
                record.removedAt = changedAt;
                record.removedById = cleanText(actorId, 30);
                record.removalReason = normalizedReason;
            }

            appendAudit(
                record,
                createAuditEntry({
                    action,
                    actorId,
                    actorUsername,
                    reason: normalizedReason,
                    changes: {
                        status: {
                            before: previousStatus,
                            after: nextStatus,
                        },
                    },
                    createdAt: changedAt,
                })
            );
            updatedRecord = structuredClone(record);
            return normalized;
        },
        normalizeDatabase(null)
    );

    return updatedRecord;
}

function sortNewestFirst(first, second) {
    return (
        new Date(second.updatedAt || second.createdAt || 0) -
        new Date(first.updatedAt || first.createdAt || 0)
    );
}

module.exports = {
    WATCHLIST_DATABASE_NAME,
    WATCHLIST_VERSION,
    VALID_SEVERITIES,
    VALID_STATUSES,
    WatchlistError,
    addWatchlistEntry,
    createAuditEntry,
    createWatchlistRecord,
    findWatchlistEntries,
    getActiveWatchlistEntries,
    getGuildRecords,
    getWatchlistEntry,
    normalizeDatabase,
    recordWatchlistEvent,
    removeWatchlistEntry,
    resolveWatchlistEntry,
    searchWatchlistEntries,
    updateWatchlistEntry,
};

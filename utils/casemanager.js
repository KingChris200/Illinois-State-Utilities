const {
    readDatabase,
    updateDatabase,
    createRecordId,
} = require('./database');

const CASE_DATABASE_NAME = 'cases';

const VALID_CASE_STATUSES = [
    'open',
    'closed',
    'voided',
];

const VALID_CASE_TYPES = [
    'promotion',
    'demotion',
    'notice',
    'inactivity_notice',
    'warning',
    'strike',
    'termination',
    'blacklist',
    'award',
    'loa',
    'other',
];

function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const normalizedValue =
        String(value).trim();

    return normalizedValue.length > 0
        ? normalizedValue
        : null;
}

function normalizeCaseType(caseType) {
    const normalizedType =
        normalizeText(caseType)
            ?.toLowerCase()
            .replace(/\s+/g, '_');

    if (
        !normalizedType ||
        !VALID_CASE_TYPES.includes(
            normalizedType
        )
    ) {
        return 'other';
    }

    return normalizedType;
}

function normalizeCaseStatus(status) {
    const normalizedStatus =
        normalizeText(status)
            ?.toLowerCase();

    if (
        !normalizedStatus ||
        !VALID_CASE_STATUSES.includes(
            normalizedStatus
        )
    ) {
        return 'open';
    }

    return normalizedStatus;
}

function createCaseId(caseType = 'case') {
    const normalizedType =
        normalizeCaseType(caseType);

    return createRecordId(
        `case-${normalizedType}`
    );
}

function ensureCaseDatabaseStructure(
    casesDatabase,
    guildId
) {
    if (
        !casesDatabase ||
        typeof casesDatabase !== 'object' ||
        Array.isArray(casesDatabase)
    ) {
        casesDatabase = {};
    }

    if (
        !Array.isArray(
            casesDatabase[guildId]
        )
    ) {
        casesDatabase[guildId] = [];
    }

    return casesDatabase;
}

function createAuditEntry({
    action,
    performedById,
    performedByUsername = null,
    reason = null,
    changes = null,
    createdAt = new Date().toISOString(),
}) {
    return {
        id: createRecordId('case-event'),

        action:
            normalizeText(action) ||
            'updated',

        performedById:
            normalizeText(
                performedById
            ),

        performedByUsername:
            normalizeText(
                performedByUsername
            ),

        reason:
            normalizeText(reason),

        changes:
            changes &&
            typeof changes === 'object'
                ? changes
                : null,

        createdAt,
    };
}

async function createCase({
    guildId,
    guildName = null,

    caseType = 'other',
    title = null,

    staffMemberId,
    staffUsername = null,
    staffDisplayName = null,

    issuedById,
    issuedByUsername = null,
    issuedByDisplayName = null,

    reason = null,
    evidence = null,
    notes = null,

    relatedRecordId = null,
    relatedChannelId = null,
    relatedMessageUrl = null,

    metadata = {},
}) {
    if (!guildId) {
        throw new TypeError(
            'A guild ID is required to create a case.'
        );
    }

    if (!staffMemberId) {
        throw new TypeError(
            'A staff member ID is required to create a case.'
        );
    }

    if (!issuedById) {
        throw new TypeError(
            'An issuer ID is required to create a case.'
        );
    }

    const normalizedType =
        normalizeCaseType(caseType);

    const caseId =
        createCaseId(normalizedType);

    const createdAt =
        new Date().toISOString();

    const caseRecord = {
        id: caseId,

        type:
            normalizedType,

        title:
            normalizeText(title),

        status: 'open',

        guildId,
        guildName:
            normalizeText(guildName),

        staffMemberId,

        staffUsername:
            normalizeText(
                staffUsername
            ),

        staffDisplayName:
            normalizeText(
                staffDisplayName
            ),

        issuedById,

        issuedByUsername:
            normalizeText(
                issuedByUsername
            ),

        issuedByDisplayName:
            normalizeText(
                issuedByDisplayName
            ),

        reason:
            normalizeText(reason),

        evidence:
            normalizeText(evidence),

        notes:
            normalizeText(notes),

        relatedRecordId:
            normalizeText(
                relatedRecordId
            ),

        relatedChannelId:
            normalizeText(
                relatedChannelId
            ),

        relatedMessageUrl:
            normalizeText(
                relatedMessageUrl
            ),

        metadata:
            metadata &&
            typeof metadata ===
                'object' &&
            !Array.isArray(metadata)
                ? metadata
                : {},

        closedAt: null,
        closedById: null,
        closeReason: null,

        voidedAt: null,
        voidedById: null,
        voidReason: null,

        reopenedAt: null,
        reopenedById: null,
        reopenReason: null,

        createdAt,
        updatedAt:
            createdAt,

        auditLog: [
            createAuditEntry({
                action:
                    'case_created',

                performedById:
                    issuedById,

                performedByUsername:
                    issuedByUsername,

                reason:
                    'Case created.',

                createdAt,
            }),
        ],
    };

    await updateDatabase(
        CASE_DATABASE_NAME,

        (casesDatabase) => {
            casesDatabase =
                ensureCaseDatabaseStructure(
                    casesDatabase,
                    guildId
                );

            casesDatabase[
                guildId
            ].push(caseRecord);

            return casesDatabase;
        },

        {}
    );

    return caseRecord;
}

async function findCase(
    guildId,
    caseId
) {
    if (!guildId || !caseId) {
        return null;
    }

    const casesDatabase =
        await readDatabase(
            CASE_DATABASE_NAME,
            {}
        );

    const guildCases =
        Array.isArray(
            casesDatabase[guildId]
        )
            ? casesDatabase[guildId]
            : [];

    return (
        guildCases.find(
            (caseRecord) =>
                String(
                    caseRecord.id
                ).toLowerCase() ===
                String(
                    caseId
                ).toLowerCase()
        ) || null
    );
}

async function listCases(
    guildId,
    {
        staffMemberId = null,
        issuedById = null,
        caseType = null,
        status = null,
        limit = 25,
    } = {}
) {
    const casesDatabase =
        await readDatabase(
            CASE_DATABASE_NAME,
            {}
        );

    let guildCases =
        Array.isArray(
            casesDatabase[guildId]
        )
            ? [
                  ...casesDatabase[
                      guildId
                  ],
              ]
            : [];

    if (staffMemberId) {
        guildCases =
            guildCases.filter(
                (caseRecord) =>
                    caseRecord.staffMemberId ===
                    staffMemberId
            );
    }

    if (issuedById) {
        guildCases =
            guildCases.filter(
                (caseRecord) =>
                    caseRecord.issuedById ===
                    issuedById
            );
    }

    if (caseType) {
        const normalizedType =
            normalizeCaseType(
                caseType
            );

        guildCases =
            guildCases.filter(
                (caseRecord) =>
                    caseRecord.type ===
                    normalizedType
            );
    }

    if (status) {
        const normalizedStatus =
            normalizeCaseStatus(
                status
            );

        guildCases =
            guildCases.filter(
                (caseRecord) =>
                    caseRecord.status ===
                    normalizedStatus
            );
    }

    guildCases.sort(
        (
            firstCase,
            secondCase
        ) =>
            new Date(
                secondCase.createdAt
            ).getTime() -
            new Date(
                firstCase.createdAt
            ).getTime()
    );

    return guildCases.slice(
        0,
        Math.max(
            1,
            Math.min(
                Number(limit) || 25,
                100
            )
        )
    );
}

async function updateCase(
    guildId,
    caseId,
    {
        performedById,
        performedByUsername = null,
        reason = null,
        updates = {},
        action = 'case_updated',
    }
) {
    if (!performedById) {
        throw new TypeError(
            'A performer ID is required to update a case.'
        );
    }

    let updatedCase = null;

    await updateDatabase(
        CASE_DATABASE_NAME,

        (casesDatabase) => {
            casesDatabase =
                ensureCaseDatabaseStructure(
                    casesDatabase,
                    guildId
                );

            const caseRecord =
                casesDatabase[
                    guildId
                ].find(
                    (record) =>
                        String(
                            record.id
                        ).toLowerCase() ===
                        String(
                            caseId
                        ).toLowerCase()
                );

            if (!caseRecord) {
                return casesDatabase;
            }

            const allowedFields = [
                'title',
                'reason',
                'evidence',
                'notes',
                'relatedRecordId',
                'relatedChannelId',
                'relatedMessageUrl',
                'metadata',
            ];

            const appliedChanges = {};

            for (
                const field of
                allowedFields
            ) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        updates,
                        field
                    )
                ) {
                    const previousValue =
                        caseRecord[
                            field
                        ];

                    const newValue =
                        field === 'metadata'
                            ? updates[
                                  field
                              ] &&
                              typeof updates[
                                  field
                              ] ===
                                  'object' &&
                              !Array.isArray(
                                  updates[
                                      field
                                  ]
                              )
                                ? updates[
                                      field
                                  ]
                                : {}
                            : normalizeText(
                                  updates[
                                      field
                                  ]
                              );

                    caseRecord[
                        field
                    ] = newValue;

                    appliedChanges[
                        field
                    ] = {
                        from:
                            previousValue ??
                            null,

                        to:
                            newValue ??
                            null,
                    };
                }
            }

            const updatedAt =
                new Date().toISOString();

            caseRecord.updatedAt =
                updatedAt;

            if (
                !Array.isArray(
                    caseRecord.auditLog
                )
            ) {
                caseRecord.auditLog = [];
            }

            caseRecord.auditLog.push(
                createAuditEntry({
                    action,

                    performedById,

                    performedByUsername,

                    reason,

                    changes:
                        appliedChanges,

                    createdAt:
                        updatedAt,
                })
            );

            updatedCase = {
                ...caseRecord,
            };

            return casesDatabase;
        },

        {}
    );

    return updatedCase;
}

async function changeCaseStatus(
    guildId,
    caseId,
    {
        newStatus,
        performedById,
        performedByUsername = null,
        reason = null,
    }
) {
    const normalizedStatus =
        normalizeCaseStatus(
            newStatus
        );

    let updatedCase = null;

    await updateDatabase(
        CASE_DATABASE_NAME,

        (casesDatabase) => {
            casesDatabase =
                ensureCaseDatabaseStructure(
                    casesDatabase,
                    guildId
                );

            const caseRecord =
                casesDatabase[
                    guildId
                ].find(
                    (record) =>
                        String(
                            record.id
                        ).toLowerCase() ===
                        String(
                            caseId
                        ).toLowerCase()
                );

            if (!caseRecord) {
                return casesDatabase;
            }

            const previousStatus =
                caseRecord.status;

            const changedAt =
                new Date().toISOString();

            caseRecord.status =
                normalizedStatus;

            caseRecord.updatedAt =
                changedAt;

            if (
                normalizedStatus ===
                'closed'
            ) {
                caseRecord.closedAt =
                    changedAt;

                caseRecord.closedById =
                    performedById;

                caseRecord.closeReason =
                    normalizeText(reason);
            }

            if (
                normalizedStatus ===
                'voided'
            ) {
                caseRecord.voidedAt =
                    changedAt;

                caseRecord.voidedById =
                    performedById;

                caseRecord.voidReason =
                    normalizeText(reason);
            }

            if (
                normalizedStatus ===
                'open'
            ) {
                caseRecord.reopenedAt =
                    changedAt;

                caseRecord.reopenedById =
                    performedById;

                caseRecord.reopenReason =
                    normalizeText(reason);
            }

            if (
                !Array.isArray(
                    caseRecord.auditLog
                )
            ) {
                caseRecord.auditLog = [];
            }

            caseRecord.auditLog.push(
                createAuditEntry({
                    action:
                        `case_${normalizedStatus}`,

                    performedById,

                    performedByUsername,

                    reason,

                    changes: {
                        status: {
                            from:
                                previousStatus,

                            to:
                                normalizedStatus,
                        },
                    },

                    createdAt:
                        changedAt,
                })
            );

            updatedCase = {
                ...caseRecord,
            };

            return casesDatabase;
        },

        {}
    );

    return updatedCase;
}

async function closeCase(
    guildId,
    caseId,
    performer
) {
    return changeCaseStatus(
        guildId,
        caseId,
        {
            ...performer,
            newStatus: 'closed',
        }
    );
}

async function voidCase(
    guildId,
    caseId,
    performer
) {
    return changeCaseStatus(
        guildId,
        caseId,
        {
            ...performer,
            newStatus: 'voided',
        }
    );
}

async function reopenCase(
    guildId,
    caseId,
    performer
) {
    return changeCaseStatus(
        guildId,
        caseId,
        {
            ...performer,
            newStatus: 'open',
        }
    );
}

module.exports = {
    CASE_DATABASE_NAME,
    VALID_CASE_STATUSES,
    VALID_CASE_TYPES,

    normalizeCaseType,
    normalizeCaseStatus,

    createCaseId,
    createAuditEntry,

    createCase,
    findCase,
    listCases,
    updateCase,
    changeCaseStatus,

    closeCase,
    voidCase,
    reopenCase,
};
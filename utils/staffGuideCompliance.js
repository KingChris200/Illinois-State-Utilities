const {
    readDatabase,
    updateDatabase,
} = require('./database');

const STAFF_GUIDE_COMPLIANCE_DATABASE =
    'staff-guide-compliance';
const DEFAULT_STAFF_GUIDE_VERSION = String(
    process.env.STAFF_GUIDE_VERSION || '1.0'
).trim() || '1.0';

function createDefaultComplianceState(guildId) {
    return {
        guildId,
        currentVersion: DEFAULT_STAFF_GUIDE_VERSION,
        currentSummary:
            'Initial interactive Staff Guide release.',
        publishedAt: null,
        publishedById: null,
        acknowledgements: {},
        onboardingCompletions: {},
    };
}

function normalizeComplianceState(guildId, value) {
    const fallback =
        createDefaultComplianceState(guildId);
    const state =
        value && typeof value === 'object'
            ? value
            : {};

    return {
        ...fallback,
        ...state,
        guildId,
        currentVersion:
            String(
                state.currentVersion ||
                    fallback.currentVersion
            ).trim() || fallback.currentVersion,
        currentSummary:
            String(
                state.currentSummary ||
                    fallback.currentSummary
            ).trim() || fallback.currentSummary,
        acknowledgements:
            state.acknowledgements &&
            typeof state.acknowledgements === 'object'
                ? state.acknowledgements
                : {},
        onboardingCompletions:
            state.onboardingCompletions &&
            typeof state.onboardingCompletions === 'object'
                ? state.onboardingCompletions
                : {},
    };
}

async function getComplianceState(guildId) {
    const database = await readDatabase(
        STAFF_GUIDE_COMPLIANCE_DATABASE,
        {}
    );

    return normalizeComplianceState(
        guildId,
        database[guildId]
    );
}

async function publishGuideVersion({
    guildId,
    version,
    summary,
    actorId,
}) {
    const safeVersion = String(version || '')
        .trim()
        .slice(0, 32);
    const safeSummary = String(summary || '')
        .trim()
        .slice(0, 500);

    if (!safeVersion) {
        throw new Error(
            'A Staff Guide version is required.'
        );
    }

    let result;

    await updateDatabase(
        STAFF_GUIDE_COMPLIANCE_DATABASE,
        (database) => {
            const state = normalizeComplianceState(
                guildId,
                database[guildId]
            );

            if (
                state.currentVersion.toLowerCase() ===
                safeVersion.toLowerCase()
            ) {
                result = {
                    changed: false,
                    state,
                };
                database[guildId] = state;
                return database;
            }

            state.currentVersion = safeVersion;
            state.currentSummary =
                safeSummary ||
                'Staff Guide policies and resources were updated.';
            state.publishedAt =
                new Date().toISOString();
            state.publishedById = actorId;
            database[guildId] = state;
            result = {
                changed: true,
                state,
            };

            return database;
        },
        {}
    );

    return result;
}

function getCurrentAcknowledgements(state) {
    return Object.values(
        state?.acknowledgements?.[
            state.currentVersion
        ] || {}
    );
}

function getCurrentOnboardingCompletions(state) {
    return Object.values(
        state?.onboardingCompletions || {}
    ).filter(
        (record) =>
            record.completedVersion ===
            state.currentVersion
    );
}

module.exports = {
    DEFAULT_STAFF_GUIDE_VERSION,
    STAFF_GUIDE_COMPLIANCE_DATABASE,
    createDefaultComplianceState,
    getComplianceState,
    getCurrentAcknowledgements,
    getCurrentOnboardingCompletions,
    normalizeComplianceState,
    publishGuideVersion,
};

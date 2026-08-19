const callsignConfig = require('../config/ispCallsigns');
const {
    createRecordId,
    readDatabase,
    updateDatabase,
} = require('./database');

const ISP_CALLSIGN_DATABASE = 'isp-callsigns';

function normalizeDatabase(database) {
    return database && typeof database === 'object' && !Array.isArray(database)
        ? database
        : {};
}

function normalizeGuildState(database, guildId) {
    database[guildId] =
        database[guildId] &&
        typeof database[guildId] === 'object' &&
        !Array.isArray(database[guildId])
            ? database[guildId]
            : {};

    const guildState = database[guildId];
    guildState.assignments =
        guildState.assignments &&
        typeof guildState.assignments === 'object' &&
        !Array.isArray(guildState.assignments)
            ? guildState.assignments
            : {};
    guildState.history = Array.isArray(guildState.history)
        ? guildState.history
        : [];

    return guildState;
}

function normalizeCallsignNumber(value) {
    const raw = String(value ?? '').trim();
    if (!/^\d{1,3}$/.test(raw)) return null;

    const number = Number(raw);
    return Number.isInteger(number) && number >= 1 && number <= 250
        ? number
        : null;
}

function formatCallsignNumber(value) {
    const number = normalizeCallsignNumber(value);
    return number === null ? null : String(number).padStart(3, '0');
}

function formatCallsign(value) {
    const number = formatCallsignNumber(value);
    return number ? `${callsignConfig.callsignPrefix}-${number}` : null;
}

function getSectionById(sectionId) {
    return (
        callsignConfig.sections.find((section) => section.id === sectionId) ||
        null
    );
}

function getSectionByNumber(value) {
    const number = normalizeCallsignNumber(value);
    if (number === null) return null;

    return (
        callsignConfig.sections.find(
            (section) =>
                number >= section.minimum && number <= section.maximum
        ) || null
    );
}

function sortAssignments(assignments) {
    return [...assignments].sort(
        (left, right) => left.number - right.number
    );
}

async function getGuildCallsignState(guildId) {
    const database = normalizeDatabase(
        await readDatabase(ISP_CALLSIGN_DATABASE, {})
    );
    return normalizeGuildState(database, guildId);
}

async function listCallsignAssignments(guildId) {
    const state = await getGuildCallsignState(guildId);
    return sortAssignments(Object.values(state.assignments));
}

async function getCallsignForUser(guildId, userId) {
    const state = await getGuildCallsignState(guildId);
    return state.assignments[userId] || null;
}

async function findCallsignAssignment(guildId, value) {
    const number = normalizeCallsignNumber(value);
    if (number === null) return null;

    const assignments = await listCallsignAssignments(guildId);
    return assignments.find((assignment) => assignment.number === number) || null;
}

async function getFreeNumbers(guildId, sectionId) {
    const section = getSectionById(sectionId);
    if (!section) return [];

    const assignments = await listCallsignAssignments(guildId);
    const assigned = new Set(assignments.map((entry) => entry.number));
    const free = [];

    for (let number = section.minimum; number <= section.maximum; number += 1) {
        if (!assigned.has(number)) free.push(number);
    }

    return free;
}

async function assignCallsign(
    guildId,
    identity,
    value,
    sectionId,
    actorId,
    { replaceExisting = false } = {}
) {
    const number = normalizeCallsignNumber(value);
    const section = getSectionById(sectionId);

    if (number === null || !section) {
        return { status: 'invalid' };
    }
    if (number < section.minimum || number > section.maximum) {
        return { status: 'outside_section', section };
    }

    let result;
    await updateDatabase(
        ISP_CALLSIGN_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const assignments = guildState.assignments;
            const existing = assignments[identity.id] || null;
            const conflict = Object.values(assignments).find(
                (assignment) =>
                    assignment.number === number &&
                    assignment.userId !== identity.id
            );

            if (conflict) {
                result = { status: 'taken', assignment: conflict };
                return database;
            }
            if (existing?.number === number) {
                result = { status: 'unchanged', assignment: existing };
                return database;
            }
            if (existing && !replaceExisting) {
                result = { status: 'already_assigned', assignment: existing };
                return database;
            }

            const now = new Date().toISOString();
            const assignment = {
                id: existing?.id || createRecordId('isp-callsign'),
                userId: identity.id,
                username: identity.username || existing?.username || null,
                displayName:
                    identity.displayName || existing?.displayName || null,
                baseNickname:
                    existing?.baseNickname ||
                    identity.baseNickname ||
                    identity.displayName ||
                    identity.username ||
                    'ISP Member',
                number,
                callsign: formatCallsign(number),
                sectionId: section.id,
                sectionName: section.name,
                assignedAt: existing?.assignedAt || now,
                assignedBy: actorId,
                updatedAt: now,
            };

            assignments[identity.id] = assignment;
            guildState.history.push({
                id: createRecordId('isp-callsign-history'),
                action: existing ? 'changed' : 'assigned',
                userId: identity.id,
                actorId,
                previousNumber: existing?.number || null,
                number,
                sectionId: section.id,
                createdAt: now,
            });
            guildState.history = guildState.history.slice(-1000);
            result = {
                status: existing ? 'changed' : 'assigned',
                assignment,
                previous: existing,
            };
            return database;
        },
        {}
    );

    return result;
}

async function assignLowestFreeCallsign(
    guildId,
    identity,
    sectionId,
    actorId,
    options = {}
) {
    const freeNumbers = await getFreeNumbers(guildId, sectionId);
    if (!freeNumbers.length) return { status: 'section_full' };

    // assignCallsign performs the final conflict check inside the serialized
    // database update, so simultaneous requests cannot claim the same number.
    for (const number of freeNumbers) {
        const result = await assignCallsign(
            guildId,
            identity,
            number,
            sectionId,
            actorId,
            options
        );
        if (result.status !== 'taken') return result;
    }

    return { status: 'section_full' };
}

async function releaseCallsign(guildId, userId, actorId) {
    let result;

    await updateDatabase(
        ISP_CALLSIGN_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const existing = guildState.assignments[userId] || null;

            if (!existing) {
                result = { status: 'not_assigned' };
                return database;
            }

            delete guildState.assignments[userId];
            guildState.history.push({
                id: createRecordId('isp-callsign-history'),
                action: 'released',
                userId,
                actorId,
                previousNumber: existing.number,
                number: null,
                sectionId: existing.sectionId,
                createdAt: new Date().toISOString(),
            });
            guildState.history = guildState.history.slice(-1000);
            result = { status: 'released', assignment: existing };
            return database;
        },
        {}
    );

    return result;
}

module.exports = {
    ISP_CALLSIGN_DATABASE,
    assignCallsign,
    assignLowestFreeCallsign,
    findCallsignAssignment,
    formatCallsign,
    formatCallsignNumber,
    getCallsignForUser,
    getFreeNumbers,
    getGuildCallsignState,
    getSectionById,
    getSectionByNumber,
    listCallsignAssignments,
    normalizeCallsignNumber,
    releaseCallsign,
};

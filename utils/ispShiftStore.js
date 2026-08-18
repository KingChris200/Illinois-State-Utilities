const shiftConfig = require('../config/ispShift');
const {
    createRecordId,
    readDatabase,
    updateDatabase,
} = require('./database');

const ISP_SHIFT_DATABASE = 'isp-shifts';
const DAY_MS = 24 * 60 * 60 * 1000;

function getWeekStart(value = Date.now()) {
    const date = new Date(value);
    const weekday = (date.getUTCDay() + 6) % 7;

    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - weekday);
    return date;
}

function getWeekKey(value = Date.now()) {
    return getWeekStart(value).toISOString().slice(0, 10);
}

function formatDuration(milliseconds) {
    const totalMinutes = Math.max(0, Math.floor(Number(milliseconds || 0) / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes || !parts.length) parts.push(`${minutes}m`);
    return parts.join(' ');
}

function createUserState(userId) {
    return {
        userId,
        username: null,
        displayName: null,
        active: null,
        sessions: [],
        adjustments: [],
        excuses: {},
        infractions: [],
        promotionCooldownUntil: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

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

    guildState.settings = {
        loggingEnabled: true,
        weeklyQuotaMs: shiftConfig.weeklyQuotaMs,
        promotionCooldownDays: shiftConfig.promotionCooldownDays,
        ...(guildState.settings || {}),
    };
    guildState.users =
        guildState.users &&
        typeof guildState.users === 'object' &&
        !Array.isArray(guildState.users)
            ? guildState.users
            : {};
    return guildState;
}

function normalizeUserState(guildState, userId) {
    const current = guildState.users[userId];
    const userState = {
        ...createUserState(userId),
        ...(current || {}),
    };

    userState.sessions = Array.isArray(userState.sessions)
        ? userState.sessions
        : [];
    userState.adjustments = Array.isArray(userState.adjustments)
        ? userState.adjustments
        : [];
    userState.excuses =
        userState.excuses &&
        typeof userState.excuses === 'object' &&
        !Array.isArray(userState.excuses)
            ? userState.excuses
            : {};
    userState.infractions = Array.isArray(userState.infractions)
        ? userState.infractions
        : [];
    guildState.users[userId] = userState;
    return userState;
}

function applyIdentity(userState, identity = {}) {
    userState.username = identity.username || userState.username;
    userState.displayName =
        identity.displayName || identity.globalName || userState.displayName;
    userState.updatedAt = new Date().toISOString();
}

function calculateActiveDuration(active, now = Date.now()) {
    if (!active?.startedAt) {
        return 0;
    }

    const startedAt = new Date(active.startedAt).getTime();
    const currentBreak = active.breakStartedAt
        ? Math.max(0, now - new Date(active.breakStartedAt).getTime())
        : 0;
    const breakMilliseconds =
        Math.max(0, Number(active.accumulatedBreakMs || 0)) + currentBreak;

    return Math.max(0, now - startedAt - breakMilliseconds);
}

function getUserWeeklyDuration(userState, weekKey = getWeekKey(), now = Date.now()) {
    const sessionTotal = userState.sessions
        .filter((session) =>
            (session.weekKey || getWeekKey(session.startedAt)) === weekKey
        )
        .reduce((total, session) => total + Number(session.durationMs || 0), 0);
    const adjustmentTotal = userState.adjustments
        .filter((adjustment) => adjustment.weekKey === weekKey)
        .reduce((total, adjustment) => total + Number(adjustment.deltaMs || 0), 0);
    const activeTotal =
        userState.active?.weekKey === weekKey
            ? calculateActiveDuration(userState.active, now)
            : 0;

    return Math.max(0, sessionTotal + adjustmentTotal + activeTotal);
}

function getUserAllTimeDuration(userState, now = Date.now()) {
    const sessions = userState.sessions.reduce(
        (total, session) => total + Number(session.durationMs || 0),
        0
    );
    const adjustments = userState.adjustments.reduce(
        (total, adjustment) => total + Number(adjustment.deltaMs || 0),
        0
    );
    return Math.max(0, sessions + adjustments + calculateActiveDuration(userState.active, now));
}

function summarizeUser(userState, guildState, now = Date.now()) {
    const weekKey = getWeekKey(now);

    return {
        userId: userState.userId,
        username: userState.username,
        displayName: userState.displayName,
        active: userState.active,
        activeDurationMs: calculateActiveDuration(userState.active, now),
        weeklyDurationMs: getUserWeeklyDuration(userState, weekKey, now),
        allTimeDurationMs: getUserAllTimeDuration(userState, now),
        weeklyQuotaMs: Number(
            guildState.settings.weeklyQuotaMs || shiftConfig.weeklyQuotaMs
        ),
        excused: Boolean(userState.excuses[weekKey]),
        excuse: userState.excuses[weekKey] || null,
        activeInfractions: userState.infractions.filter(
            (infraction) => infraction.active !== false
        ),
        promotionCooldownUntil: userState.promotionCooldownUntil,
        sessionCount: userState.sessions.length,
    };
}

async function getGuildState(guildId) {
    const database = normalizeDatabase(
        await readDatabase(ISP_SHIFT_DATABASE, {})
    );
    return normalizeGuildState(database, guildId);
}

async function getShiftSnapshot(guildId, userId, now = Date.now()) {
    const guildState = await getGuildState(guildId);
    const userState = normalizeUserState(guildState, userId);
    const leaderboard = Object.values(guildState.users)
        .map((user) => summarizeUser(user, guildState, now))
        .sort((left, right) => right.weeklyDurationMs - left.weeklyDurationMs);
    const placement = leaderboard.findIndex((entry) => entry.userId === userId);

    return {
        ...summarizeUser(userState, guildState, now),
        loggingEnabled: guildState.settings.loggingEnabled !== false,
        leaderboardPlacement: placement === -1 ? null : placement + 1,
        leaderboardSize: leaderboard.length,
    };
}

async function startShift(guildId, user, now = Date.now()) {
    let result;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);

            if (guildState.settings.loggingEnabled === false) {
                result = { status: 'disabled' };
                return database;
            }
            if (userState.active) {
                result = { status: 'already_active', active: userState.active };
                return database;
            }

            userState.active = {
                id: createRecordId('isp-shift'),
                startedAt: new Date(now).toISOString(),
                weekKey: getWeekKey(now),
                breakStartedAt: null,
                accumulatedBreakMs: 0,
            };
            result = { status: 'started', active: userState.active };
            return database;
        },
        {}
    );
    return result;
}

async function toggleBreak(guildId, user, now = Date.now()) {
    let result;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);

            if (!userState.active) {
                result = { status: 'not_active' };
                return database;
            }

            if (userState.active.breakStartedAt) {
                const breakStartedAt = new Date(
                    userState.active.breakStartedAt
                ).getTime();
                userState.active.accumulatedBreakMs += Math.max(
                    0,
                    now - breakStartedAt
                );
                userState.active.breakStartedAt = null;
                result = { status: 'resumed', active: userState.active };
            } else {
                userState.active.breakStartedAt = new Date(now).toISOString();
                result = { status: 'break_started', active: userState.active };
            }
            return database;
        },
        {}
    );
    return result;
}

async function stopShift(
    guildId,
    user,
    { endedById = user.id, reason = 'Shift ended normally', now = Date.now() } = {}
) {
    let result;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);

            if (!userState.active) {
                result = { status: 'not_active' };
                return database;
            }

            const active = userState.active;
            const durationMs = calculateActiveDuration(active, now);
            const currentBreakMs = active.breakStartedAt
                ? Math.max(0, now - new Date(active.breakStartedAt).getTime())
                : 0;
            const session = {
                id: active.id,
                weekKey: active.weekKey,
                startedAt: active.startedAt,
                endedAt: new Date(now).toISOString(),
                durationMs,
                breakMs:
                    Number(active.accumulatedBreakMs || 0) + currentBreakMs,
                endedById,
                reason,
            };

            userState.sessions.push(session);
            userState.active = null;
            result = { status: 'stopped', session };
            return database;
        },
        {}
    );
    return result;
}

async function setLoggingEnabled(guildId, enabled, actorId) {
    let changed = false;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            changed = guildState.settings.loggingEnabled !== Boolean(enabled);
            guildState.settings.loggingEnabled = Boolean(enabled);
            guildState.settings.updatedById = actorId;
            guildState.settings.updatedAt = new Date().toISOString();
            return database;
        },
        {}
    );
    return { status: changed ? 'changed' : 'unchanged', enabled: Boolean(enabled) };
}

async function endAllShifts(guildId, actorId, now = Date.now()) {
    const ended = [];

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);

            for (const userState of Object.values(guildState.users)) {
                if (!userState.active) continue;
                const active = userState.active;
                const currentBreakMs = active.breakStartedAt
                    ? Math.max(0, now - new Date(active.breakStartedAt).getTime())
                    : 0;
                const session = {
                    id: active.id,
                    weekKey: active.weekKey,
                    startedAt: active.startedAt,
                    endedAt: new Date(now).toISOString(),
                    durationMs: calculateActiveDuration(active, now),
                    breakMs:
                        Number(active.accumulatedBreakMs || 0) + currentBreakMs,
                    endedById: actorId,
                    reason: 'All active shifts ended by management',
                };

                userState.sessions.push(session);
                userState.active = null;
                userState.updatedAt = new Date().toISOString();
                ended.push({ userId: userState.userId, session });
            }
            return database;
        },
        {}
    );
    return ended;
}

async function adjustUserTime(guildId, user, minutes, actorId, reason) {
    let adjustment;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);
            adjustment = {
                id: createRecordId('shift-adjustment'),
                weekKey: getWeekKey(),
                deltaMs: Number(minutes) * 60 * 1000,
                actorId,
                reason,
                createdAt: new Date().toISOString(),
            };
            userState.adjustments.push(adjustment);
            return database;
        },
        {}
    );
    return adjustment;
}

async function addInfraction(guildId, user, actorId, reason) {
    let infraction;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);
            infraction = {
                id: createRecordId('shift-infraction'),
                reason,
                actorId,
                active: true,
                createdAt: new Date().toISOString(),
            };
            userState.infractions.push(infraction);
            return database;
        },
        {}
    );
    return infraction;
}

async function clearInfractions(guildId, user, actorId) {
    let cleared = 0;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);

            for (const infraction of userState.infractions) {
                if (infraction.active === false) continue;
                infraction.active = false;
                infraction.resolvedById = actorId;
                infraction.resolvedAt = new Date().toISOString();
                cleared += 1;
            }
            return database;
        },
        {}
    );
    return cleared;
}

async function setPromotionCooldown(guildId, user, days, actorId, reason) {
    const until = new Date(Date.now() + Number(days) * DAY_MS).toISOString();

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);
            userState.promotionCooldownUntil = until;
            userState.promotionCooldown = {
                actorId,
                reason,
                createdAt: new Date().toISOString(),
            };
            return database;
        },
        {}
    );
    return until;
}

async function clearPromotionCooldown(guildId, user, actorId) {
    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);
            userState.promotionCooldownUntil = null;
            userState.promotionCooldown = {
                clearedById: actorId,
                clearedAt: new Date().toISOString(),
            };
            return database;
        },
        {}
    );
}

async function excuseUser(guildId, user, actorId, reason) {
    const weekKey = getWeekKey();
    let excuse;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);
            excuse = {
                weekKey,
                reason,
                actorId,
                createdAt: new Date().toISOString(),
            };
            userState.excuses[weekKey] = excuse;
            return database;
        },
        {}
    );
    return excuse;
}

async function revokeExcuse(guildId, user, actorId) {
    const weekKey = getWeekKey();
    let removed = null;

    await updateDatabase(
        ISP_SHIFT_DATABASE,
        (current) => {
            const database = normalizeDatabase(current);
            const guildState = normalizeGuildState(database, guildId);
            const userState = normalizeUserState(guildState, user.id);
            applyIdentity(userState, user);
            removed = userState.excuses[weekKey] || null;
            delete userState.excuses[weekKey];
            userState.lastExcuseRevokedById = actorId;
            return database;
        },
        {}
    );
    return removed;
}

async function getLeaderboard(guildId, now = Date.now()) {
    const guildState = await getGuildState(guildId);

    return Object.values(guildState.users)
        .map((userState) => summarizeUser(userState, guildState, now))
        .filter((entry) => entry.weeklyDurationMs > 0 || entry.active)
        .sort((left, right) => right.weeklyDurationMs - left.weeklyDurationMs);
}

async function getOnlineUsers(guildId, now = Date.now()) {
    const guildState = await getGuildState(guildId);

    return Object.values(guildState.users)
        .filter((userState) => userState.active)
        .map((userState) => summarizeUser(userState, guildState, now))
        .sort((left, right) => right.activeDurationMs - left.activeDurationMs);
}

async function getActiveCooldowns(guildId, now = Date.now()) {
    const guildState = await getGuildState(guildId);

    return Object.values(guildState.users)
        .filter(
            (userState) =>
                userState.promotionCooldownUntil &&
                new Date(userState.promotionCooldownUntil).getTime() > now
        )
        .map((userState) => summarizeUser(userState, guildState, now))
        .sort(
            (left, right) =>
                new Date(left.promotionCooldownUntil).getTime() -
                new Date(right.promotionCooldownUntil).getTime()
        );
}

async function getActiveInfractions(guildId, now = Date.now()) {
    const guildState = await getGuildState(guildId);

    return Object.values(guildState.users)
        .map((userState) => summarizeUser(userState, guildState, now))
        .filter((entry) => entry.activeInfractions.length > 0);
}

async function getPromotionCandidates(guildId, now = Date.now()) {
    const guildState = await getGuildState(guildId);

    return Object.values(guildState.users)
        .map((userState) => summarizeUser(userState, guildState, now))
        .filter(
            (entry) =>
                entry.weeklyDurationMs >= entry.weeklyQuotaMs &&
                entry.activeInfractions.length === 0 &&
                (!entry.promotionCooldownUntil ||
                    new Date(entry.promotionCooldownUntil).getTime() <= now)
        )
        .sort((left, right) => right.weeklyDurationMs - left.weeklyDurationMs);
}

module.exports = {
    ISP_SHIFT_DATABASE,
    calculateActiveDuration,
    formatDuration,
    getWeekKey,
    getWeekStart,
    getUserWeeklyDuration,
    getUserAllTimeDuration,
    getGuildState,
    getShiftSnapshot,
    getLeaderboard,
    getOnlineUsers,
    getActiveCooldowns,
    getActiveInfractions,
    getPromotionCandidates,
    startShift,
    toggleBreak,
    stopShift,
    setLoggingEnabled,
    endAllShifts,
    adjustUserTime,
    addInfraction,
    clearInfractions,
    setPromotionCooldown,
    clearPromotionCooldown,
    excuseUser,
    revokeExcuse,
};

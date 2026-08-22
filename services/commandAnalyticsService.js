const {
    readDatabase,
    updateDatabase,
} = require('../utils/database');

const DATABASE_NAME = 'command-analytics';
const MAX_DAILY_BUCKETS = 90;

function normalizeCommandName(commandName, type = 'slash') {
    const name = String(commandName || 'unknown')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '') || 'unknown';

    return type === 'prefix' ? `?${name}` : `/${name}`;
}

function createCounter() {
    return {
        uses: 0,
        successes: 0,
        failures: 0,
        denied: 0,
        totalDurationMs: 0,
        lastUsedAt: null,
    };
}

function incrementCounter(counter, outcome, durationMs, usedAt) {
    const next = {
        ...createCounter(),
        ...(counter || {}),
    };

    next.uses += 1;

    if (outcome === 'denied') {
        next.denied += 1;
    } else if (outcome === 'error' || outcome === 'failed') {
        next.failures += 1;
    } else {
        next.successes += 1;
    }

    next.totalDurationMs += Math.max(
        0,
        Number.isFinite(durationMs) ? Math.round(durationMs) : 0
    );
    next.lastUsedAt = usedAt;
    return next;
}

async function recordCommandUsage({
    guildId = 'global',
    commandName,
    type = 'slash',
    outcome = 'success',
    durationMs = 0,
    usedAt = new Date().toISOString(),
} = {}) {
    if (
        process.env.NODE_TEST_CONTEXT &&
        process.env.ENABLE_RELIABILITY_DURING_TESTS !== 'true'
    ) {
        return null;
    }

    const safeGuildId = String(guildId || 'global');
    const normalizedName = normalizeCommandName(commandName, type);
    const day = usedAt.slice(0, 10);

    return updateDatabase(
        DATABASE_NAME,
        (database) => {
            database.version = 1;
            database.guilds ||= {};
            const guild = database.guilds[safeGuildId] || {
                total: createCounter(),
                commands: {},
                days: {},
            };

            guild.total = incrementCounter(
                guild.total,
                outcome,
                durationMs,
                usedAt
            );
            guild.commands ||= {};
            guild.commands[normalizedName] = incrementCounter(
                guild.commands[normalizedName],
                outcome,
                durationMs,
                usedAt
            );
            guild.days ||= {};
            const daily = guild.days[day] || {
                total: createCounter(),
                commands: {},
            };
            daily.total = incrementCounter(
                daily.total,
                outcome,
                durationMs,
                usedAt
            );
            daily.commands ||= {};
            daily.commands[normalizedName] = incrementCounter(
                daily.commands[normalizedName],
                outcome,
                durationMs,
                usedAt
            );
            guild.days[day] = daily;

            const retainedDays = Object.keys(guild.days)
                .sort()
                .slice(-MAX_DAILY_BUCKETS);
            guild.days = Object.fromEntries(
                retainedDays.map((key) => [key, guild.days[key]])
            );
            database.guilds[safeGuildId] = guild;
            return database;
        },
        { version: 1, guilds: {} }
    );
}

function combineCounters(target, source) {
    const next = { ...target };
    next.uses += source?.uses || 0;
    next.successes += source?.successes || 0;
    next.failures += source?.failures || 0;
    next.denied += source?.denied || 0;
    next.totalDurationMs += source?.totalDurationMs || 0;

    if (
        source?.lastUsedAt &&
        (!next.lastUsedAt || source.lastUsedAt > next.lastUsedAt)
    ) {
        next.lastUsedAt = source.lastUsedAt;
    }

    return next;
}

async function getCommandAnalytics(
    guildId,
    { days = 30, database: suppliedDatabase = null } = {}
) {
    const database = suppliedDatabase ||
        (await readDatabase(DATABASE_NAME, {
            version: 1,
            guilds: {},
        }));
    const guild = database.guilds?.[String(guildId || 'global')];

    if (!guild) {
        return {
            days,
            total: createCounter(),
            commands: [],
        };
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, days) + 1);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    const selectedDays = Object.entries(guild.days || {}).filter(
        ([day]) => day >= cutoffKey
    );
    let total = createCounter();
    const commands = {};

    for (const [, record] of selectedDays) {
        total = combineCounters(total, record.total);

        for (const [name, counter] of Object.entries(
            record.commands || {}
        )) {
            commands[name] = combineCounters(
                commands[name] || createCounter(),
                counter
            );
        }
    }

    return {
        days,
        total,
        commands: Object.entries(commands)
            .map(([name, counter]) => ({ name, ...counter }))
            .sort((first, second) => second.uses - first.uses),
    };
}

module.exports = {
    DATABASE_NAME,
    MAX_DAILY_BUCKETS,
    getCommandAnalytics,
    normalizeCommandName,
    recordCommandUsage,
};

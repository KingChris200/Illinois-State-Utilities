const crypto = require('node:crypto');
const { EmbedBuilder } = require('discord.js');

const {
    readDatabase,
    updateDatabase,
} = require('../utils/database');

const DATABASE_NAME = 'error-events';
const MAX_ERRORS_PER_GUILD = 100;
const DELIVERY_DEDUPE_MS = 30_000;
const recentDeliveries = new Map();
const originalConsoleError = console.error.bind(console);
let consoleCaptureRegistered = false;

function createErrorId() {
    return `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
}

function safeText(value, maximumLength = 300) {
    return String(value || 'Unknown error')
        .replace(/(token|key|secret|authorization)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
        .replace(/[\r\n]+/g, ' ')
        .slice(0, maximumLength);
}

function getErrorCode(error) {
    return safeText(
        error?.code || error?.name || 'UNEXPECTED_ERROR',
        80
    );
}

async function saveErrorRecord(record) {
    await updateDatabase(
        DATABASE_NAME,
        (database) => {
            database.version = 1;
            database.guilds ||= {};
            const key = record.guildId || 'global';
            const records = Array.isArray(database.guilds[key])
                ? database.guilds[key]
                : [];
            records.push(record);
            database.guilds[key] = records.slice(-MAX_ERRORS_PER_GUILD);
            return database;
        },
        { version: 1, guilds: {} }
    );
}

function resolveErrorLogChannelId() {
    return (
        process.env.BOT_ERROR_LOG_CHANNEL_ID ||
        process.env.ERLC_COMMAND_LOG_CHANNEL_ID ||
        null
    );
}

async function deliverError(client, record) {
    const channelId = resolveErrorLogChannelId();

    if (!channelId || !client?.channels?.fetch) {
        return false;
    }

    const signature = `${channelId}:${record.context}:${record.code}`;
    const lastDeliveredAt = recentDeliveries.get(signature) || 0;

    if (Date.now() - lastDeliveredAt < DELIVERY_DEDUPE_MS) {
        return false;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased?.()) {
        return false;
    }

    const location = [
        record.guildId ? `Guild: **${record.guildId}**` : null,
        record.channelId ? `Channel: <#${record.channelId}>` : null,
        record.userId ? `User: **${record.userId}**` : null,
    ].filter(Boolean);
    const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Bot Error')
        .setDescription(
            [
                `**Reference:** ${record.id}`,
                `**Area:** ${record.context}`,
                `**Code:** ${record.code}`,
                record.command ? `**Command:** ${record.command}` : null,
                location.length > 0 ? location.join(' • ') : null,
            ]
                .filter(Boolean)
                .join('\n')
        )
        .setFooter({ text: 'Private reliability log' })
        .setTimestamp(new Date(record.createdAt));

    const sent = await channel
        .send({
            embeds: [embed],
            allowedMentions: { parse: [] },
        })
        .then(() => true)
        .catch(() => false);

    if (sent) {
        recentDeliveries.set(signature, Date.now());
    }

    return sent;
}

async function reportError({
    client,
    error,
    context = 'Unknown area',
    command = null,
    guildId = null,
    channelId = null,
    userId = null,
    logToConsole = true,
} = {}) {
    const record = {
        id: createErrorId(),
        context: safeText(context, 100),
        command: command ? safeText(command, 100) : null,
        code: getErrorCode(error),
        guildId: guildId ? String(guildId) : null,
        channelId: channelId ? String(channelId) : null,
        userId: userId ? String(userId) : null,
        createdAt: new Date().toISOString(),
    };

    if (
        process.env.NODE_TEST_CONTEXT &&
        process.env.ENABLE_RELIABILITY_DURING_TESTS !== 'true'
    ) {
        return record;
    }

    if (logToConsole) {
        originalConsoleError(
            `[${record.id}] ${record.context} (${record.code})`,
            error
        );
    }

    await saveErrorRecord(record).catch((saveError) => {
        originalConsoleError(
            '[ERROR REPORTING] Could not save error record:',
            saveError
        );
    });
    await deliverError(client, record).catch(() => false);
    return record;
}

function registerConsoleErrorCapture(client) {
    if (consoleCaptureRegistered) {
        return;
    }

    consoleCaptureRegistered = true;
    console.error = (...args) => {
        originalConsoleError(...args);

        if (process.env.NODE_TEST_CONTEXT) {
            return;
        }

        const error = args.find((value) => value instanceof Error) ||
            Object.assign(new Error('A handled operation logged an error.'), {
                code: 'LOGGED_ERROR',
            });
        const context = safeText(
            typeof args[0] === 'string' ? args[0] : 'Handled bot error',
            100
        );

        void reportError({
            client,
            error,
            context,
            logToConsole: false,
        });
    };
}

async function getErrorSummary(guildId, { limit = 10 } = {}) {
    const database = await readDatabase(DATABASE_NAME, {
        version: 1,
        guilds: {},
    });
    const guildRecords = database.guilds?.[String(guildId)] || [];
    const globalRecords = database.guilds?.global || [];
    const records = [...guildRecords, ...globalRecords]
        .sort((first, second) =>
            String(second.createdAt).localeCompare(String(first.createdAt))
        )
        .slice(0, Math.max(1, Math.min(25, limit)));

    return {
        totalStored: guildRecords.length + globalRecords.length,
        records,
        channelId: resolveErrorLogChannelId(),
    };
}

function registerProcessErrorHandlers(client) {
    process.on('unhandledRejection', (error) => {
        void reportError({
            client,
            error,
            context: 'Unhandled promise rejection',
        });
    });

    process.on('uncaughtExceptionMonitor', (error) => {
        void reportError({
            client,
            error,
            context: 'Uncaught process exception',
        });
    });
}

module.exports = {
    DATABASE_NAME,
    DELIVERY_DEDUPE_MS,
    MAX_ERRORS_PER_GUILD,
    createErrorId,
    getErrorCode,
    getErrorSummary,
    registerConsoleErrorCapture,
    registerProcessErrorHandlers,
    reportError,
    resolveErrorLogChannelId,
    safeText,
};

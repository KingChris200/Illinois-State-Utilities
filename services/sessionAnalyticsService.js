const { EmbedBuilder } = require('discord.js');

const {
    updateDatabase,
    createRecordId,
} = require('../utils/database');
const {
    summarizeSessionAnalytics,
} = require('../utils/sessionAnalytics');

const DATABASE_NAME = 'session-history';
const MAX_HISTORY_PER_GUILD = 250;

function displayCount(value, suffix = '') {
    return Number.isFinite(value)
        ? `\`${value}${suffix}\``
        : '`Unavailable`';
}

function createSessionRecapEmbed({
    session,
    endedAt = session?.endedAt ?? Date.now(),
    durationDisplay,
    guildIcon = null,
    serverName = 'Illinois State Roleplay | Strict',
} = {}) {
    const summary = summarizeSessionAnalytics(
        session,
        endedAt
    );

    const embed = new EmbedBuilder()
        .setColor('#24589B')
        .setTitle('Session Report')
        .setDescription('Private statistics from the completed session.')
        .addFields(
            {
                name: 'Starting Players',
                value: displayCount(
                    summary.startingPlayerCount
                ),
                inline: true,
            },
            {
                name: 'Peak Players',
                value: displayCount(
                    summary.peakPlayerCount
                ),
                inline: true,
            },
            {
                name: 'Ending Players',
                value: displayCount(
                    summary.endingPlayerCount
                ),
                inline: true,
            },
            {
                name: 'Average Players',
                value: displayCount(
                    summary.averagePlayerCountDisplay
                ),
                inline: true,
            },
            {
                name: 'Attendance',
                value: [
                    `${displayCount(summary.attendeeCount)} voted to attend`,
                    summary.attendanceComparison.summary,
                ].join('\n'),
                inline: false,
            },
            {
                name: 'Peak ER:LC Staff',
                value: displayCount(
                    summary.peakStaffCount
                ),
                inline: true,
            },
            {
                name: 'Duration',
                value: `\`${
                    durationDisplay ||
                    `${Math.floor(
                        summary.durationMilliseconds /
                            60000
                    )} minutes`
                }\``,
                inline: true,
            }
        )
        .setFooter({
            text: 'Private session report',
            iconURL: guildIcon || undefined,
        })
        .setTimestamp(endedAt);

    return embed;
}

async function saveCompletedSessionAnalytics({
    session,
    endedAt = session?.endedAt ?? Date.now(),
    shutdownById = null,
    recapMessageId = null,
    recapMessageUrl = null,
} = {}) {
    const summary = summarizeSessionAnalytics(
        session,
        endedAt
    );
    const record = {
        id: createRecordId('session'),
        guildId: session.guildId,
        channelId: session.channelId,
        startupMessageId:
            session.startupMessageId || null,
        recapMessageId,
        recapMessageUrl,
        hostId: session.hostId,
        hostUsername:
            session.hostUsername || null,
        shutdownById,
        roleplayZone:
            session.roleplayZone || 'Statewide',
        notes: session.notes || null,
        attendeeCount: summary.attendeeCount,
        startingPlayerCount:
            summary.startingPlayerCount,
        peakPlayerCount: summary.peakPlayerCount,
        endingPlayerCount:
            summary.endingPlayerCount,
        averagePlayerCount:
            summary.averagePlayerCountDisplay,
        minimumPlayerCount:
            summary.minimumPlayerCount,
        peakStaffCount: summary.peakStaffCount,
        peakQueueCount: summary.peakQueueCount,
        sampleCount: summary.sampleCount,
        attendanceDifference:
            summary.attendanceComparison.difference,
        startedAt: new Date(
            summary.startedAt
        ).toISOString(),
        endedAt: new Date(
            summary.endedAt
        ).toISOString(),
        durationMilliseconds:
            summary.durationMilliseconds,
        createdAt: new Date().toISOString(),
    };

    await updateDatabase(
        DATABASE_NAME,
        (database) => {
            const history =
                database &&
                typeof database === 'object' &&
                !Array.isArray(database)
                    ? database
                    : {};

            if (!Array.isArray(history[record.guildId])) {
                history[record.guildId] = [];
            }

            history[record.guildId].push(record);
            history[record.guildId] =
                history[record.guildId].slice(
                    -MAX_HISTORY_PER_GUILD
                );

            return history;
        },
        {}
    );

    return record;
}

module.exports = {
    DATABASE_NAME,
    MAX_HISTORY_PER_GUILD,
    createSessionRecapEmbed,
    saveCompletedSessionAnalytics,
};

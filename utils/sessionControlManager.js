const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const sessionManager = require('./sessionManager');
const {
    canManageSessions,
} = require('./sessionAnnouncementManager');

const SESSION_CONTROL_PREFIX = 'session_control:';

function getSessionControlStatus() {
    const vote = sessionManager.getVote();

    if (vote) {
        return {
            state: 'vote',
            label: 'Vote open',
            detail:
                `${sessionManager.getAttendingCount()}/${vote.goal} attending`,
        };
    }

    const session = sessionManager.getSession();

    if (session) {
        return {
            state: 'live',
            label: 'Session live',
            detail: Number.isFinite(session.livePlayerCount)
                ? `${session.livePlayerCount}/${session.maxPlayerCount || 40} players`
                : 'Waiting for the next player update',
        };
    }

    return {
        state: 'idle',
        label: 'No active session',
        detail: 'Start a vote when you are ready.',
    };
}

function createSessionControlPayload(userId) {
    const status = getSessionControlStatus();
    const hasVote = status.state === 'vote';
    const hasSession = status.state === 'live';
    const embed = new EmbedBuilder()
        .setColor('#24589B')
        .setTitle('Session Manager')
        .setDescription(
            `**${status.label}**\n${status.detail}\n\nChoose what you need below.`
        )
        .setFooter({ text: 'Private management panel' });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${SESSION_CONTROL_PREFIX}start:${userId}`)
            .setLabel('Start Vote')
            .setStyle(ButtonStyle.Success)
            .setDisabled(hasVote || hasSession),
        new ButtonBuilder()
            .setCustomId(`${SESSION_CONTROL_PREFIX}low:${userId}`)
            .setLabel('Players Needed')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasSession),
        new ButtonBuilder()
            .setCustomId(`${SESSION_CONTROL_PREFIX}full:${userId}`)
            .setLabel('Session Full')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasSession),
        new ButtonBuilder()
            .setCustomId(`${SESSION_CONTROL_PREFIX}stop:${userId}`)
            .setLabel('End Session')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!hasSession),
        new ButtonBuilder()
            .setCustomId(`${SESSION_CONTROL_PREFIX}refresh:${userId}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
    };
}

function parseSessionControlId(customId) {
    const match = new RegExp(
        `^${SESSION_CONTROL_PREFIX}(start|low|full|stop|refresh):(\\d{17,20})$`
    ).exec(customId || '');

    return match
        ? { action: match[1], userId: match[2] }
        : null;
}

async function refreshSessionControlMessage(interaction) {
    if (!interaction.message?.edit) {
        return;
    }

    const payload = createSessionControlPayload(interaction.user.id);
    delete payload.flags;
    await interaction.message.edit(payload).catch(() => null);
}

async function handleSessionControlInteraction(interaction) {
    const request = parseSessionControlId(interaction.customId);

    if (!request) {
        return;
    }

    if (request.userId !== interaction.user.id) {
        await interaction.reply({
            content: 'This private session panel belongs to another user.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!interaction.inGuild?.() || !canManageSessions(interaction)) {
        await interaction.reply({
            content: 'You need Manage Server to control sessions.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (request.action === 'refresh') {
        const payload = createSessionControlPayload(interaction.user.id);
        delete payload.flags;
        await interaction.update(payload);
        return;
    }

    const commands = {
        start: require('../commands/sessions/ssu'),
        low: require('../commands/sessions/sessionlow'),
        full: require('../commands/sessions/sessionfull'),
        stop: require('../commands/sessions/ssd'),
    };

    await commands[request.action].execute(interaction);
    await refreshSessionControlMessage(interaction);
}

module.exports = {
    SESSION_CONTROL_PREFIX,
    createSessionControlPayload,
    getSessionControlStatus,
    handleSessionControlInteraction,
    parseSessionControlId,
    refreshSessionControlMessage,
};

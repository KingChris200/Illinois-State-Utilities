const { randomUUID } = require('crypto');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const createEmbed = require('./createEmbed');
const erlcService = require('../services/erlcService');
const { resolvePlayer } = require('./playerResolver');
const {
    logModerationAudit,
} = require('./moderationAuditLogger');

const CONFIRMATION_TTL_MS = 60_000;
const pendingActions = new Map();

function createConfirmation(data) {
    const id = randomUUID();
    const pending = {
        ...data,
        id,
        status: 'pending',
        expiresAt: Date.now() + CONFIRMATION_TTL_MS,
        promptMessage: null,
        timer: null,
    };

    pending.timer = setTimeout(
        () => expireConfirmation(id),
        CONFIRMATION_TTL_MS
    );
    pending.timer.unref?.();
    pendingActions.set(id, pending);

    return {
        id,
        components: createButtons(id, data.action),
    };
}

async function attachPromptMessage(id, promptMessage) {
    const pending = pendingActions.get(id);

    if (pending) {
        pending.promptMessage = promptMessage;
        pending.client = promptMessage.client || null;
        pending.guildId = promptMessage.guildId || null;
        pending.channelId = promptMessage.channelId || null;
        await logModerationAudit(pending, 'requested');
    }
}

function removeConfirmation(id) {
    const pending = pendingActions.get(id);

    if (!pending) {
        return;
    }

    clearTimeout(pending.timer);
    pendingActions.delete(id);
}

async function handleModerationButton(interaction) {
    const match = interaction.customId.match(
        /^erlc_mod:(confirm|cancel):([a-f0-9-]+)$/
    );

    if (!match) {
        return false;
    }

    const [, choice, id] = match;
    const pending = pendingActions.get(id);

    if (!pending || Date.now() >= pending.expiresAt) {
        removeConfirmation(id);
        await interaction.reply({
            content:
                'This moderation confirmation has expired or was already completed.',
            ephemeral: true,
        });
        return true;
    }

    if (interaction.user.id !== pending.executorId) {
        await interaction.reply({
            content:
                'Only the staff member who requested this action can confirm or cancel it.',
            ephemeral: true,
        });
        return true;
    }

    if (pending.status !== 'pending') {
        await interaction.reply({
            content:
                'This moderation action is already being processed.',
            ephemeral: true,
        });
        return true;
    }

    pending.status = 'processing';
    clearTimeout(pending.timer);

    if (choice === 'cancel') {
        const embed = createResultEmbed(
            pending,
            'cancelled'
        );
        removeConfirmation(id);
        await interaction.update({
            embeds: [embed],
            components: [],
        });
        await logModerationAudit(pending, 'cancelled');
        return true;
    }

    await interaction.deferUpdate();
    await logModerationAudit(pending, 'confirmed');

    try {
        if (pending.requiresOnlineRecheck !== false) {
            const players = await erlcService.getPlayers();
            const targetQuery =
                pending.player.userId || pending.player.username;
            const resolved = resolvePlayer(players, targetQuery);

            if (
                resolved.player.username.toLowerCase() !==
                pending.player.username.toLowerCase()
            ) {
                throw new Error(
                    'The resolved player identity changed before confirmation.'
                );
            }
        }

        const result = await erlcService.executeCommand(
            pending.command,
            {
                dryRun:
                    pending.mockMode || pending.dryRun,
            }
        );
        const embed = createResultEmbed(
            pending,
            result.dryRun ? 'mock_complete' : 'complete'
        );

        removeConfirmation(id);
        await interaction.editReply({
            embeds: [embed],
            components: [],
        });
        await logModerationAudit(
            pending,
            result.dryRun ? 'mock_complete' : 'complete'
        );

        console.log(
            `[ER:LC MODERATION] action=${pending.action} target=${pending.player.username} executor=${pending.executorId} outcome=${result.dryRun ? 'mock_complete' : 'complete'}`
        );
    } catch (error) {
        console.error(
            'Could not complete confirmed ER:LC moderation action:',
            error
        );

        const embed = createResultEmbed(
            pending,
            'failed',
            error
        );
        removeConfirmation(id);
        await interaction.editReply({
            embeds: [embed],
            components: [],
        });
        await logModerationAudit(
            pending,
            'failed',
            error
        );
    }

    return true;
}

function createButtons(id, action, disabled = false) {
    const actionLabels = {
        kick: 'Confirm Kick',
        respawn: 'Confirm Respawn',
        ban: 'Confirm Ban',
        unban: 'Confirm Unban',
        heal: 'Confirm Heal',
        warn: 'Confirm Warn',
        wanted: 'Confirm Wanted',
        unwanted: 'Confirm Unwanted',
    };
    const actionLabel =
        actionLabels[action] || 'Confirm Action';

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`erlc_mod:confirm:${id}`)
            .setLabel(actionLabel)
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`erlc_mod:cancel:${id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled)
    );
}

async function expireConfirmation(id) {
    const pending = pendingActions.get(id);

    if (!pending || pending.status !== 'pending') {
        return;
    }

    pending.status = 'expired';
    pendingActions.delete(id);
    await logModerationAudit(pending, 'expired');

    if (!pending.promptMessage) {
        return;
    }

    await pending.promptMessage
        .edit({
            components: [
                createButtons(id, pending.action, true),
            ],
        })
        .catch(() => null);
}

function createResultEmbed(pending, outcome, error = null) {
    const actionNames = {
        kick: 'Kick',
        respawn: 'Respawn',
        ban: 'Ban',
        unban: 'Unban',
        heal: 'Heal',
        warn: 'Warn',
        wanted: 'Wanted',
        unwanted: 'Unwanted',
    };
    const actionName =
        actionNames[pending.action] || 'Moderation Action';
    const outcomes = {
        cancelled: {
            title: `${actionName} Cancelled`,
            color: '#7F8C8D',
            description:
                'The request was cancelled. No ER:LC command was executed.',
        },
        mock_complete: {
            title: `${actionName} Mock Confirmation Complete`,
            color: '#27AE60',
            description:
                'The full confirmation flow succeeded in mock mode. Nothing was sent to ER:LC.',
        },
        complete: {
            title: `${actionName} Completed`,
            color: '#27AE60',
            description:
                'The confirmed command was sent to ER:LC successfully.',
        },
        failed: {
            title: `${actionName} Not Completed`,
            color: '#C0392B',
            description:
                'The safety recheck or ER:LC request failed. No further attempt was made.',
        },
    };
    const selected = outcomes[outcome];
    const embed = createEmbed(selected.title, 'isrp')
        .setColor(selected.color)
        .setDescription(selected.description)
        .addFields(
            {
                name: 'Target',
                value: pending.player.userId
                    ? `**${pending.player.username}** · \`${pending.player.userId}\``
                    : `**${pending.player.username}**`,
            },
            {
                name: 'Requested By',
                value: pending.executorMention,
                inline: true,
            }
        );

    if (pending.reason) {
        embed.addFields({
            name: 'Reason',
            value: pending.reason,
        });
    }

    if (error) {
        embed.addFields({
            name: 'Details',
            value:
                error.code === 'PLAYER_NOT_FOUND'
                    ? 'The target is no longer online.'
                    : 'Check the bot console for technical details.',
        });
    }

    return embed;
}

module.exports = {
    CONFIRMATION_TTL_MS,
    attachPromptMessage,
    createConfirmation,
    handleModerationButton,
    removeConfirmation,
};

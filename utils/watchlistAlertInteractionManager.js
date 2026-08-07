const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const prefixConfig = require('../config/prefixCommands');
const erlcService = require('../services/erlcService');
const {
    createPlayerIntelligencePanel,
    removePlayerPanel,
} = require('./playerIntelligenceManager');
const {
    WatchlistError,
    getWatchlistEntry,
    recordWatchlistEvent,
    resolveWatchlistEntry,
} = require('./watchlistManager');
const {
    matchWatchlistPlayers,
} = require('./watchlistMatcher');
const { PlayerResolverError } = require('./playerResolver');
const {
    canManageWatchlist,
} = require('./watchlistPermissions');

const BUTTON_PREFIX = 'watchlist_alert:';
const MODAL_PREFIX = 'watchlist_alert_modal:';

function createWatchlistAlertComponents(
    entryId,
    { disabled = false } = {}
) {
    const firstRow = new ActionRowBuilder().addComponents(
        createButton(
            entryId,
            'acknowledge',
            'Acknowledge',
            '✅',
            ButtonStyle.Success,
            disabled
        ),
        createButton(
            entryId,
            'view',
            'Full Record',
            '🔒',
            ButtonStyle.Secondary,
            disabled
        ),
        createButton(
            entryId,
            'profile',
            'Live Profile',
            '👤',
            ButtonStyle.Primary,
            disabled
        )
    );
    const secondRow = new ActionRowBuilder().addComponents(
        createButton(
            entryId,
            'false_match',
            'False Match',
            '⚪',
            ButtonStyle.Secondary,
            disabled
        ),
        createButton(
            entryId,
            'resolve',
            'Resolve Entry',
            '🛡️',
            ButtonStyle.Danger,
            disabled
        ),
        createButton(
            entryId,
            'refresh',
            'Refresh',
            '🔄',
            ButtonStyle.Secondary,
            disabled
        )
    );

    return [firstRow, secondRow];
}

function createButton(
    entryId,
    action,
    label,
    emoji,
    style,
    disabled
) {
    return new ButtonBuilder()
        .setCustomId(`${BUTTON_PREFIX}${action}:${entryId}`)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(style)
        .setDisabled(disabled);
}

async function handleWatchlistAlertButton(interaction) {
    const match = interaction.customId.match(
        /^watchlist_alert:(acknowledge|view|profile|false_match|resolve|refresh):(.+)$/
    );

    if (!match) {
        return false;
    }

    if (!canManageWatchlist(interaction)) {
        await interaction.reply({
            content:
                '❌ This private watchlist control is restricted to authorized management.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    const [, action, entryId] = match;

    try {
        switch (action) {
            case 'acknowledge':
                await acknowledgeAlert(interaction, entryId);
                break;
            case 'view':
                await viewFullRecord(interaction, entryId);
                break;
            case 'profile':
                await openLiveProfile(interaction, entryId);
                break;
            case 'false_match':
                await interaction.showModal(
                    createReasonModal(
                        'false_match',
                        entryId,
                        'Dismiss Watchlist Match',
                        'Explain why this alert is a false match'
                    )
                );
                break;
            case 'resolve':
                await interaction.showModal(
                    createReasonModal(
                        'resolve',
                        entryId,
                        'Resolve Watchlist Entry',
                        'Document the final resolution'
                    )
                );
                break;
            case 'refresh':
                await refreshAlert(interaction, entryId);
                break;
            default:
                return false;
        }
    } catch (error) {
        await sendInteractionError(interaction, error);
    }

    return true;
}

async function handleWatchlistAlertModal(interaction) {
    const match = interaction.customId.match(
        /^watchlist_alert_modal:(false_match|resolve):(.+)$/
    );

    if (!match) {
        return false;
    }

    if (!canManageWatchlist(interaction)) {
        await interaction.reply({
            content:
                '❌ This private watchlist control is restricted to authorized management.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    const [, action, entryId] = match;
    const reason = interaction.fields
        .getTextInputValue('reason')
        .trim();

    try {
        if (action === 'false_match') {
            await dismissMatch(interaction, entryId, reason);
        } else {
            await resolveEntry(interaction, entryId, reason);
        }
    } catch (error) {
        await sendInteractionError(interaction, error);
    }

    return true;
}

async function acknowledgeAlert(interaction, entryId) {
    const record = await recordWatchlistEvent(
        interaction.guildId,
        entryId,
        actorEvent(interaction, 'Alert acknowledged.')
    );
    const embed = appendResponseStatus(
        interaction.message?.embeds?.[0],
        `✅ Acknowledged by <@${interaction.user.id}> • <t:${Math.floor(Date.now() / 1000)}:R>`
    );

    await interaction.update({
        embeds: embed ? [embed] : undefined,
        components: disableAlertAction(
            interaction.message,
            'acknowledge'
        ),
        allowedMentions: { parse: [] },
    });

    console.log(
        `[WATCHLIST CONTROL] action=acknowledge entry=${record.id} executor=${interaction.user.id} outcome=success`
    );
}

async function viewFullRecord(interaction, entryId) {
    const record = await requireRecord(interaction, entryId);
    const { createWatchlistEmbed } = require(
        '../commands/management/watchlist'
    );

    await interaction.reply({
        content: '🔒 Private watchlist record.',
        embeds: [createWatchlistEmbed(record, interaction)],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
}

async function openLiveProfile(interaction, entryId) {
    const record = await requireRecord(interaction, entryId);
    let panel;

    try {
        panel = await createPlayerIntelligencePanel({
            query: record.robloxUserId,
            executorId: interaction.user.id,
            executorMention: `<@${interaction.user.id}>`,
            config: prefixConfig,
        });

        await interaction.reply({
            embeds: [panel.embed],
            components: [panel.components],
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    } catch (error) {
        if (panel) {
            removePlayerPanel(panel.id);
        }

        throw error;
    }
}

async function refreshAlert(interaction, entryId) {
    const record = await requireRecord(interaction, entryId);
    const players = await erlcService.getPlayers();
    const matches = matchWatchlistPlayers([record], players);
    const online = matches.length > 0;
    const { createScanEmbed } = require(
        '../commands/management/watchlist'
    );

    await interaction.reply({
        embeds: [
            createScanEmbed(matches, interaction, {
                activeRecordCount:
                    record.status === 'active' ? 1 : 0,
                onlinePlayerCount: players.length,
                isMockMode: erlcService.isMockMode(),
            }),
        ],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });

    if (interaction.message?.edit) {
        const embed = appendResponseStatus(
            interaction.message.embeds?.[0],
            `${online ? '🟢 Still online' : '⚪ No longer online'} • refreshed by <@${interaction.user.id}> <t:${Math.floor(Date.now() / 1000)}:R>`
        );

        if (embed) {
            await interaction.message
                .edit({ embeds: [embed] })
                .catch(() => null);
        }
    }
}

async function dismissMatch(interaction, entryId, reason) {
    const record = await recordWatchlistEvent(
        interaction.guildId,
        entryId,
        actorEvent(interaction, reason, 'match_dismissed')
    );

    await interaction.reply({
        content:
            '✅ This alert was documented as a false match. The underlying watchlist entry remains active.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    await updateSourceMessage(
        interaction,
        `⚪ Dismissed as a false match by <@${interaction.user.id}> • <t:${Math.floor(Date.now() / 1000)}:R>\nReason: ${safeText(reason, 300)}`,
        'false_match'
    );

    console.log(
        `[WATCHLIST CONTROL] action=false_match entry=${record.id} executor=${interaction.user.id} outcome=success`
    );
}

async function resolveEntry(interaction, entryId, resolution) {
    const record = await resolveWatchlistEntry(
        interaction.guildId,
        entryId,
        {
            resolution,
            actorId: interaction.user.id,
            actorUsername: interaction.user.username,
        }
    );
    const { createWatchlistEmbed } = require(
        '../commands/management/watchlist'
    );

    await interaction.reply({
        content: '✅ The watchlist entry was resolved and audited.',
        embeds: [createWatchlistEmbed(record, interaction)],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    await updateSourceMessage(
        interaction,
        `🛡️ Entry resolved by <@${interaction.user.id}> • <t:${Math.floor(Date.now() / 1000)}:R>`,
        null,
        true
    );

    console.log(
        `[WATCHLIST CONTROL] action=resolve entry=${record.id} executor=${interaction.user.id} outcome=success`
    );
}

function createReasonModal(
    action,
    entryId,
    title,
    label
) {
    return new ModalBuilder()
        .setCustomId(`${MODAL_PREFIX}${action}:${entryId}`)
        .setTitle(title)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel(label)
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(3)
                    .setMaxLength(500)
                    .setRequired(true)
            )
        );
}

async function requireRecord(interaction, entryId) {
    const record = await getWatchlistEntry(
        interaction.guildId,
        entryId
    );

    if (!record || record.status === 'removed') {
        throw new WatchlistError(
            'ENTRY_NOT_FOUND',
            'This private watchlist entry is no longer available.'
        );
    }

    return record;
}

function actorEvent(
    interaction,
    reason,
    action = 'alert_acknowledged'
) {
    return {
        action,
        reason,
        actorId: interaction.user.id,
        actorUsername: interaction.user.username,
    };
}

async function updateSourceMessage(
    interaction,
    status,
    actionToDisable,
    disableAll = false
) {
    if (!interaction.message?.edit) {
        return;
    }

    const embed = appendResponseStatus(
        interaction.message.embeds?.[0],
        status
    );

    await interaction.message
        .edit({
            embeds: embed ? [embed] : undefined,
            components: disableAlertAction(
                interaction.message,
                actionToDisable,
                disableAll
            ),
            allowedMentions: { parse: [] },
        })
        .catch(() => null);
}

function appendResponseStatus(sourceEmbed, status) {
    if (!sourceEmbed) {
        return null;
    }

    const embed = EmbedBuilder.from(sourceEmbed);
    const data = embed.toJSON();
    const fields = [...(data.fields || [])];
    const existingIndex = fields.findIndex(
        (field) => field.name === 'Alert Response'
    );
    const previous =
        existingIndex >= 0 ? fields[existingIndex].value : null;
    const value = safeText(
        previous ? `${previous}\n${status}` : status,
        1000
    );
    const responseField = {
        name: 'Alert Response',
        value,
    };

    if (existingIndex >= 0) {
        fields[existingIndex] = responseField;
    } else {
        fields.push(responseField);
    }

    return EmbedBuilder.from({ ...data, fields });
}

function disableAlertAction(
    message,
    action,
    disableAll = false
) {
    if (!Array.isArray(message?.components)) {
        return [];
    }

    return message.components.map((row) =>
        new ActionRowBuilder().addComponents(
            row.components.map((component) => {
                const button = ButtonBuilder.from(component);
                const customId =
                    component.customId ||
                    component.data?.custom_id ||
                    component.toJSON?.().custom_id;
                const shouldDisable =
                    disableAll ||
                    (action &&
                        customId?.startsWith(
                            `${BUTTON_PREFIX}${action}:`
                        ));
                return shouldDisable
                    ? button.setDisabled(true)
                    : button;
            })
        )
    );
}

async function sendInteractionError(interaction, error) {
    console.error(
        '[WATCHLIST CONTROL] Interaction failed:',
        error.code || error.name || 'UNKNOWN_ERROR'
    );

    const message =
        error instanceof WatchlistError
            ? error.message
            : error instanceof PlayerResolverError
              ? error.message
            : erlcService.getPublicErrorMessage(error);
    const payload = {
        content: `❌ ${message}`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    };

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => null);
    } else {
        await interaction.reply(payload).catch(() => null);
    }
}

function safeText(value, maximumLength) {
    const text = String(value || 'Not provided')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[*_~`|>\\]/g, '\\$&');
    return text.length <= maximumLength
        ? text
        : `${text.slice(0, maximumLength - 3)}...`;
}

module.exports = {
    BUTTON_PREFIX,
    MODAL_PREFIX,
    appendResponseStatus,
    createReasonModal,
    createWatchlistAlertComponents,
    disableAlertAction,
    handleWatchlistAlertButton,
    handleWatchlistAlertModal,
};

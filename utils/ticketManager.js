const path = require('node:path');
const {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const brands = require('../config/branding');
const {
    getTicketCategory,
    getTicketConfig,
} = require('../config/tickets');
const {
    getServerConfig,
} = require('../config/serverConfigs');
const {
    createRecordId,
    readDatabase,
    updateDatabase,
} = require('./database');
const { detectMemberRank } = require('./rankManager');

const TICKET_DATABASE = 'tickets';
const TICKET_PANEL_DATABASE = 'ticket-panels';
const APPEAL_DATABASE = 'ticket-appeals';
const TICKET_PREFIX = 'ticket:';
const CREATE_MENU_ID = `${TICKET_PREFIX}create`;
const TRANSCRIPT_MESSAGE_LIMIT = 1000;
const PANEL_IMAGE_NAME = 'assistance-banner-v2.png';
const PANEL_IMAGE_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    PANEL_IMAGE_NAME
);
const PANEL_IMAGE_URL = `attachment://${PANEL_IMAGE_NAME}`;

function createPanelAttachment() {
    return new AttachmentBuilder(PANEL_IMAGE_PATH, {
        name: PANEL_IMAGE_NAME,
    });
}

function getSupportRoleIds(guildId) {
    const serverConfig = getServerConfig(guildId);
    const roleIds = [
        ...(serverConfig?.reviewerRoleIds || []),
        serverConfig?.roleGroups?.serverStaffTeam,
    ];

    return [...new Set(roleIds.filter(Boolean))];
}

function getCategorySupportRoleIds(guildId, category) {
    if (category?.teamRoleId) {
        return [category.teamRoleId];
    }

    const serverConfig = getServerConfig(guildId);

    if (category?.accessLevel === 'internal_affairs') {
        return [
            serverConfig?.roleGroups?.ownershipTeam,
            serverConfig?.roleGroups?.directorTeam,
            serverConfig?.roleGroups?.internalAffairsTeam,
        ].filter(Boolean);
    }

    if (category?.accessLevel === 'management') {
        return [...new Set(serverConfig?.reviewerRoleIds || [])];
    }

    return getSupportRoleIds(guildId);
}

function memberCanManageTickets(member) {
    if (
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    return getSupportRoleIds(member?.guild?.id).some(
        (roleId) => member?.roles?.cache?.has(roleId)
    );
}

function memberCanManageTicket(member, ticket) {
    if (
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    const category = getTicketCategory(
        member?.guild?.id,
        ticket?.categoryId
    );

    return getCategorySupportRoleIds(
        member?.guild?.id,
        category
    ).some((roleId) => member?.roles?.cache?.has(roleId));
}

function createTicketPanelPayload(guild) {
    const config = getTicketConfig(guild?.id);
    const categories = config?.categories || [];

    const menu = new StringSelectMenuBuilder()
        .setCustomId(CREATE_MENU_ID)
        .setPlaceholder('Choose the assistance you need…')
        .addOptions(
            categories.map((category) => ({
                label: category.label,
                description: category.description,
                value: category.id,
                emoji: category.emoji,
            }))
        );

    const categorySummary = categories
        .map(
            (category) =>
                `### ${category.emoji} ${category.label}\n${category.description}`
        )
        .join('\n\n');
    const container = new ContainerBuilder()
        .setAccentColor(Number.parseInt(
            brands.palette.lightBlue.slice(1),
            16
        ))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(PANEL_IMAGE_URL)
                    .setDescription(
                        'Illinois State Roleplay Assistance'
                    )
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    '# Illinois State Roleplay Assistance',
                    'Choose the team that best matches your request. A private channel will be created for you and that support team.',
                    '',
                    categorySummary,
                ].join('\n')
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Open a Ticket\nSelect one assistance category below.'
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(menu)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '-# Private support • One ticket per concern • Illinois State Roleplay'
            )
        );

    return {
        files: [createPanelAttachment()],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    };
}

function createTicketControlRow(ticket, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${TICKET_PREFIX}claim:${ticket.id}`)
            .setLabel('Claim Ticket')
            .setEmoji('🙋')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`${TICKET_PREFIX}close:${ticket.id}`)
            .setLabel(disabled ? 'Ticket Closed' : 'Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

function createTicketWelcomeEmbed(ticket, category, guild) {
    return new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setTitle(`${category.emoji} ${category.label}`)
        .setDescription(
            [
                `Welcome <@${ticket.openerId}>! Your private assistance channel is ready.`,
                '',
                'Please describe what happened, what outcome you are requesting, and attach any relevant screenshots or links.',
                '',
                category.id.endsWith('appeal')
                    ? 'An Internal Affairs team member can start the appropriate guided appeal form with `!appeal`.'
                    : category.id === 'internal_affairs'
                      ? 'Internal Affairs can start the guided appeal form with `!appeal` when needed.'
                    : 'A support team member will greet you and begin assisting as soon as possible.',
            ].join('\n')
        )
        .addFields(
            {
                name: 'Ticket ID',
                value: `\`${ticket.id}\``,
                inline: true,
            },
            {
                name: 'Status',
                value: 'Open • Unclaimed',
                inline: true,
            },
            {
                name: 'Assigned Team',
                value: category.teamRoleId
                    ? `<@&${category.teamRoleId}>`
                    : 'ISRP Support Team',
                inline: true,
            }
        )
        .setThumbnail(guild.iconURL({ size: 256 }) || null)
        .setFooter({
            text: 'Illinois State Utilities • Assistance Center',
        })
        .setTimestamp();
}

function sanitizeChannelName(value) {
    return String(value || 'member')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 28) || 'member';
}

function createTicketOpeningMentions(openerId, category) {
    const roleIds = category?.teamRoleId
        ? [category.teamRoleId]
        : [];

    return {
        content: [
            `<@${openerId}>`,
            ...roleIds.map((roleId) => `<@&${roleId}>`),
        ].join(' '),
        allowedMentions: {
            users: [openerId],
            roles: roleIds,
            parse: [],
        },
    };
}

function getMessageCollectionValues(collection) {
    if (!collection) {
        return [];
    }

    if (Array.isArray(collection)) {
        return collection;
    }

    return typeof collection.values === 'function'
        ? [...collection.values()]
        : [];
}

function createTicketTranscript(ticket, messages) {
    const orderedMessages = [...messages].sort(
        (left, right) =>
            Number(left.createdTimestamp || 0) -
            Number(right.createdTimestamp || 0)
    );
    const lines = [
        'Illinois State Roleplay | Assistance Ticket Transcript',
        `Ticket ID: ${ticket.id}`,
        `Category: ${ticket.categoryLabel}`,
        `Opened By: ${ticket.openerUsername} (${ticket.openerId})`,
        `Created: ${ticket.createdAt}`,
        `Closed: ${ticket.closedAt || 'Not recorded'}`,
        `Closed By: ${ticket.closedById || 'Not recorded'}`,
        `Messages: ${orderedMessages.length}`,
        '',
        '============================================================',
        '',
    ];

    for (const message of orderedMessages) {
        const timestamp = message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : new Date(
                  message.createdTimestamp || Date.now()
              ).toISOString();
        const authorName =
            message.member?.displayName ||
            message.author?.globalName ||
            message.author?.username ||
            'Unknown User';
        const authorId = message.author?.id || 'unknown';
        const content = String(message.content || '').trim();

        lines.push(`[${timestamp}] ${authorName} (${authorId})`);
        lines.push(content || '[No text content]');

        for (const attachment of getMessageCollectionValues(
            message.attachments
        )) {
            lines.push(
                `[Attachment] ${attachment.name || 'file'}: ${attachment.url}`
            );
        }

        for (const embed of message.embeds || []) {
            const embedParts = [
                embed.author?.name,
                embed.title,
                embed.description,
                ...(embed.fields || []).map(
                    (field) => `${field.name}: ${field.value}`
                ),
                embed.footer?.text,
            ].filter(Boolean);
            lines.push(
                `[Embed] ${embedParts.join(' | ') || 'Embedded content'}`
            );
        }

        lines.push('');
    }

    return lines.join('\n');
}

async function fetchTicketMessages(channel) {
    const messages = [];
    let before;

    while (messages.length < TRANSCRIPT_MESSAGE_LIMIT) {
        const limit = Math.min(
            100,
            TRANSCRIPT_MESSAGE_LIMIT - messages.length
        );
        const page = await channel.messages.fetch({
            limit,
            ...(before ? { before } : {}),
        });
        const pageMessages = getMessageCollectionValues(page);

        if (pageMessages.length === 0) {
            break;
        }

        messages.push(...pageMessages);
        before = pageMessages[pageMessages.length - 1].id;

        if (pageMessages.length < limit) {
            break;
        }
    }

    return messages;
}

async function archiveTicketTranscript(
    guild,
    sourceChannel,
    ticket,
    closedByUser
) {
    const config = getTicketConfig(guild.id);
    const transcriptChannelId = config?.transcriptChannelId;

    if (!transcriptChannelId) {
        return null;
    }

    const transcriptChannel =
        guild.channels.cache.get(transcriptChannelId) ||
        (await guild.channels
            .fetch(transcriptChannelId)
            .catch(() => null));

    if (!transcriptChannel?.isTextBased()) {
        return null;
    }

    const messages = await fetchTicketMessages(sourceChannel);
    const transcript = createTicketTranscript(ticket, messages);
    const category = getTicketCategory(
        guild.id,
        ticket.categoryId
    );
    const attachmentName = `ticket-${ticket.id}.txt`;

    return transcriptChannel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(brands.isrp.color)
                .setTitle('📄 Assistance Transcript Archived')
                .setDescription(
                    'A private record of the completed assistance ticket is attached.'
                )
                .addFields(
                    {
                        name: 'Ticket',
                        value: `\`${ticket.id}\``,
                        inline: true,
                    },
                    {
                        name: 'Category',
                        value:
                            category?.label ||
                            ticket.categoryLabel ||
                            'Unknown',
                        inline: true,
                    },
                    {
                        name: 'Messages',
                        value: String(messages.length),
                        inline: true,
                    },
                    {
                        name: 'Opened By',
                        value: `<@${ticket.openerId}>`,
                        inline: true,
                    },
                    {
                        name: 'Closed By',
                        value: `<@${closedByUser.id}>`,
                        inline: true,
                    },
                    {
                        name: 'Claimed By',
                        value: ticket.claimedById
                            ? `<@${ticket.claimedById}>`
                            : 'Unclaimed',
                        inline: true,
                    }
                )
                .setThumbnail(guild.iconURL({ size: 256 }) || null)
                .setFooter({
                    text: 'Illinois State Utilities • Private ticket archive',
                })
                .setTimestamp(),
        ],
        files: [
            new AttachmentBuilder(Buffer.from(transcript, 'utf8'), {
                name: attachmentName,
            }),
        ],
        allowedMentions: { parse: [] },
    });
}

async function readGuildTickets(guildId) {
    const database = await readDatabase(TICKET_DATABASE, {});
    return Array.isArray(database[guildId])
        ? database[guildId]
        : [];
}

async function saveTicket(ticket) {
    await updateDatabase(
        TICKET_DATABASE,
        (database) => {
            database =
                database && typeof database === 'object'
                    ? database
                    : {};
            const tickets = Array.isArray(database[ticket.guildId])
                ? database[ticket.guildId]
                : [];
            const index = tickets.findIndex(
                (record) => record.id === ticket.id
            );

            if (index === -1) {
                tickets.push(ticket);
            } else {
                tickets[index] = ticket;
            }

            database[ticket.guildId] = tickets;
            return database;
        },
        {}
    );

    return ticket;
}

async function getTicketById(guildId, ticketId) {
    return (
        (await readGuildTickets(guildId)).find(
            (ticket) => ticket.id === ticketId
        ) || null
    );
}

async function getTicketByChannel(guildId, channelId) {
    return (
        (await readGuildTickets(guildId)).find(
            (ticket) =>
                ticket.channelId === channelId &&
                ticket.status === 'open'
        ) || null
    );
}

async function getStoredTicketPanel(guildId) {
    const database = await readDatabase(
        TICKET_PANEL_DATABASE,
        {}
    );
    return database[guildId] || null;
}

async function saveTicketPanel(guildId, panel) {
    await updateDatabase(
        TICKET_PANEL_DATABASE,
        (database) => ({
            ...(database || {}),
            [guildId]: panel,
        }),
        {}
    );
    return panel;
}

async function fetchStoredTicketMessage(client, panel) {
    if (!panel?.channelId || !panel?.messageId) {
        return null;
    }

    const channel =
        client.channels.cache.get(panel.channelId) ||
        (await client.channels.fetch(panel.channelId).catch(() => null));

    if (!channel?.isTextBased()) {
        return null;
    }

    return channel.messages.fetch(panel.messageId).catch(() => null);
}

function buildPermissionOverwrites(guild, openerId, category) {
    const overwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: openerId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
        {
            id: guild.members.me.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
    ];

    for (const roleId of getCategorySupportRoleIds(
        guild.id,
        category
    )) {
        if (!guild.roles.cache.has(roleId)) {
            continue;
        }

        overwrites.push({
            id: roleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        });
    }

    return overwrites;
}

async function createTicket(interaction) {
    const config = getTicketConfig(interaction.guildId);
    const category = getTicketCategory(
        interaction.guildId,
        interaction.values[0]
    );

    if (!config || !category) {
        await interaction.reply({
            content: '❌ That assistance category is not configured.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const existing = (await readGuildTickets(interaction.guildId)).find(
        (ticket) =>
            ticket.openerId === interaction.user.id &&
            ticket.status === 'open'
    );

    if (existing) {
        await interaction.reply({
            content:
                `You already have an open ticket: <#${existing.channelId}>`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
        return;
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    });

    const assistanceChannel =
        interaction.guild.channels.cache.get(
            config.assistanceChannelId
        ) ||
        (await interaction.guild.channels
            .fetch(config.assistanceChannelId)
            .catch(() => null));

    if (!assistanceChannel?.isTextBased()) {
        await interaction.editReply(
            '❌ The Assistance channel is unavailable.'
        );
        return;
    }

    const ticket = {
        id: createRecordId('ticket'),
        guildId: interaction.guildId,
        openerId: interaction.user.id,
        openerUsername: interaction.user.username,
        categoryId: category.id,
        categoryLabel: category.label,
        channelId: null,
        status: 'open',
        claimedById: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    let channel = null;

    try {
        channel = await interaction.guild.channels.create({
            name:
                `${category.id.replace(/_/g, '-')}-` +
                sanitizeChannelName(interaction.user.username),
            type: ChannelType.GuildText,
            parent:
                category.parentCategoryId ||
                assistanceChannel.parentId ||
                undefined,
            topic:
                `${category.label} • ${interaction.user.username} • ${ticket.id}`,
            permissionOverwrites: buildPermissionOverwrites(
                interaction.guild,
                interaction.user.id,
                category
            ),
            reason:
                `ISRP assistance ticket opened by ${interaction.user.username}`,
        });

        ticket.channelId = channel.id;
        await saveTicket(ticket);

        const openingMentions = createTicketOpeningMentions(
            interaction.user.id,
            category
        );

        await channel.send({
            content: openingMentions.content,
            embeds: [
                createTicketWelcomeEmbed(
                    ticket,
                    category,
                    interaction.guild
                ),
            ],
            components: [createTicketControlRow(ticket)],
            allowedMentions: openingMentions.allowedMentions,
        });

        await interaction.editReply({
            content:
                `✅ Your **${category.label}** ticket is ready: ${channel}`,
            allowedMentions: { parse: [] },
        });
    } catch (error) {
        console.error('[TICKETS] Could not create ticket:', error);
        if (channel) {
            await channel.delete('Ticket creation rollback').catch(() => {});
        }
        await interaction.editReply(
            '❌ I could not create the ticket. Please confirm that I can manage channels and roles.'
        );
    }
}

async function claimTicket(interaction, ticketId) {
    const ticket = await getTicketById(interaction.guildId, ticketId);

    if (!ticket || ticket.status !== 'open') {
        await interaction.reply({
            content: 'This ticket is no longer open.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!memberCanManageTicket(interaction.member, ticket)) {
        await interaction.reply({
            content: 'Only authorized support staff can claim tickets.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (
        ticket.claimedById &&
        ticket.claimedById !== interaction.user.id
    ) {
        await interaction.reply({
            content: `This ticket is already claimed by <@${ticket.claimedById}>.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
        return;
    }

    ticket.claimedById = interaction.user.id;
    ticket.claimedAt = new Date().toISOString();
    ticket.updatedAt = ticket.claimedAt;
    await saveTicket(ticket);

    await interaction.channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0x2ecc71)
                .setDescription(
                    `🙋 ${interaction.user} has claimed this ticket and will provide assistance.`
                ),
        ],
        allowedMentions: { parse: [] },
    });
    await interaction.reply({
        content: '✅ Ticket claimed.',
        flags: MessageFlags.Ephemeral,
    });
}

async function closeTicket(interaction, ticketId) {
    const ticket = await getTicketById(interaction.guildId, ticketId);

    if (!ticket || ticket.status !== 'open') {
        await interaction.reply({
            content: 'This ticket is already closed.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (
        interaction.user.id !== ticket.openerId &&
        !memberCanManageTicket(interaction.member, ticket)
    ) {
        await interaction.reply({
            content: 'Only the ticket creator or support staff can close it.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    });
    const closedAt = new Date().toISOString();
    ticket.status = 'closed';
    ticket.closedAt = closedAt;
    ticket.closedById = interaction.user.id;
    ticket.updatedAt = closedAt;
    await saveTicket(ticket);

    await interaction.channel.permissionOverwrites
        .edit(ticket.openerId, {
            SendMessages: false,
            AddReactions: false,
        })
        .catch(() => {});
    await interaction.channel
        .setName(
            `closed-${sanitizeChannelName(interaction.channel.name)}`.slice(
                0,
                100
            )
        )
        .catch(() => {});
    await interaction.message
        .edit({
            components: [createTicketControlRow(ticket, true)],
        })
        .catch(() => {});
    await interaction.channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle('🔒 Ticket Closed')
                .setDescription(
                    `Closed by ${interaction.user}. A private transcript will be archived for staff recordkeeping.`
                )
                .setTimestamp(),
        ],
        allowedMentions: { parse: [] },
    });

    let transcriptArchived = false;

    try {
        const transcriptMessage = await archiveTicketTranscript(
            interaction.guild,
            interaction.channel,
            ticket,
            interaction.user
        );

        if (transcriptMessage) {
            ticket.transcriptChannelId = transcriptMessage.channel.id;
            ticket.transcriptMessageId = transcriptMessage.id;
            ticket.transcriptSavedAt = new Date().toISOString();
            ticket.updatedAt = ticket.transcriptSavedAt;
            await saveTicket(ticket);
            transcriptArchived = true;
        }
    } catch (error) {
        console.error(
            `[TICKETS] Could not archive transcript for ${ticket.id}:`,
            error
        );
    }

    await interaction.editReply(
        transcriptArchived
            ? '✅ Ticket closed, locked, and privately archived.'
            : '⚠️ Ticket closed and locked, but its transcript could not be archived. Please check the transcript channel permissions.'
    );
}

function createAppealChoiceRow(ticket) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(
                `${TICKET_PREFIX}appeal:${ticket.id}:${ticket.openerId}`
            )
            .setPlaceholder('Choose an appeal form…')
            .addOptions(
                {
                    label: 'In-Game Punishment Appeal',
                    description:
                        'Warnings, kicks, bans, and other ER:LC punishments.',
                    value: 'ingame',
                    emoji: '🚓',
                },
                {
                    label: 'Staff Infraction Appeal',
                    description:
                        'Notices, strikes, demotions, or staff discipline.',
                    value: 'staff',
                    emoji: '📋',
                }
            )
    );
}

function createAppealModal(type, ticketId) {
    const isStaff = type === 'staff';
    const modal = new ModalBuilder()
        .setCustomId(
            `${TICKET_PREFIX}appeal_modal:${type}:${ticketId}`
        )
        .setTitle(
            isStaff
                ? 'Staff Infraction Appeal'
                : 'In-Game Punishment Appeal'
        );
    const fields = isStaff
        ? [
              ['identity', 'Your Roblox username', TextInputStyle.Short, true],
              ['action', 'Infraction type or record ID', TextInputStyle.Short, true],
              ['issuer', 'Who issued it and when?', TextInputStyle.Short, false],
              ['reason', 'Why should the action be reconsidered?', TextInputStyle.Paragraph, true],
              ['evidence', 'Evidence or supporting links', TextInputStyle.Paragraph, false],
          ]
        : [
              ['identity', 'Your Roblox username', TextInputStyle.Short, true],
              ['action', 'Punishment type and approximate date', TextInputStyle.Short, true],
              ['issuer', 'Staff member involved (if known)', TextInputStyle.Short, false],
              ['reason', 'Why should the punishment be reconsidered?', TextInputStyle.Paragraph, true],
              ['evidence', 'Evidence or supporting links', TextInputStyle.Paragraph, false],
          ];

    for (const [id, label, style, required] of fields) {
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId(id)
                    .setLabel(label)
                    .setStyle(style)
                    .setRequired(required)
                    .setMaxLength(style === TextInputStyle.Short ? 200 : 1000)
            )
        );
    }

    return modal;
}

async function showAppealModal(interaction) {
    const [, , ticketId, allowedUserId] =
        interaction.customId.split(':');
    const ticket = await getTicketById(
        interaction.guildId,
        ticketId
    );

    if (
        !ticket ||
        ticket.status !== 'open' ||
        interaction.channelId !== ticket.channelId
    ) {
        await interaction.reply({
            content: 'This appeal form is no longer available.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (interaction.user.id !== allowedUserId) {
        await interaction.reply({
            content: 'This appeal form belongs to the ticket creator.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.showModal(
        createAppealModal(interaction.values[0], ticket.id)
    );
}

async function submitAppeal(interaction) {
    const [, , type, ticketId] = interaction.customId.split(':');
    const ticket = await getTicketById(
        interaction.guildId,
        ticketId
    );

    if (
        !ticket ||
        ticket.status !== 'open' ||
        interaction.user.id !== ticket.openerId
    ) {
        await interaction.reply({
            content: 'This appeal form is invalid or expired.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const appeal = {
        id: createRecordId('appeal'),
        guildId: interaction.guildId,
        ticketId: ticket.id,
        channelId: ticket.channelId,
        submittedById: interaction.user.id,
        type,
        identity: interaction.fields.getTextInputValue('identity').trim(),
        action: interaction.fields.getTextInputValue('action').trim(),
        issuer: interaction.fields.getTextInputValue('issuer').trim() || null,
        reason: interaction.fields.getTextInputValue('reason').trim(),
        evidence:
            interaction.fields.getTextInputValue('evidence').trim() || null,
        status: 'submitted',
        createdAt: new Date().toISOString(),
    };

    await updateDatabase(
        APPEAL_DATABASE,
        (database) => {
            database =
                database && typeof database === 'object'
                    ? database
                    : {};
            const records = Array.isArray(database[interaction.guildId])
                ? database[interaction.guildId]
                : [];
            records.push(appeal);
            database[interaction.guildId] = records;
            return database;
        },
        {}
    );

    const title =
        type === 'staff'
            ? '📋 Staff Infraction Appeal Submitted'
            : '🚓 In-Game Punishment Appeal Submitted';
    await interaction.channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle(title)
                .setDescription(
                    `Submitted by <@${interaction.user.id}> for support-team review.`
                )
                .addFields(
                    { name: 'Roblox Username', value: appeal.identity },
                    { name: 'Action Being Appealed', value: appeal.action },
                    {
                        name: 'Staff Member / Date',
                        value: appeal.issuer || 'Not provided',
                    },
                    { name: 'Appeal Explanation', value: appeal.reason },
                    {
                        name: 'Evidence',
                        value: appeal.evidence || 'None provided',
                    },
                    {
                        name: 'Appeal ID',
                        value: `\`${appeal.id}\``,
                    }
                )
                .setFooter({
                    text: 'Illinois State Utilities • Appeal record',
                })
                .setTimestamp(),
        ],
        allowedMentions: { parse: [] },
    });
    await interaction.reply({
        content:
            `✅ Your appeal was submitted successfully. Appeal ID: \`${appeal.id}\``,
        flags: MessageFlags.Ephemeral,
    });
}

async function handleTicketInteraction(interaction) {
    if (interaction.isModalSubmit?.()) {
        await submitAppeal(interaction);
        return;
    }

    if (interaction.isStringSelectMenu?.()) {
        if (interaction.customId === CREATE_MENU_ID) {
            await createTicket(interaction);
            return;
        }

        if (interaction.customId.startsWith(`${TICKET_PREFIX}appeal:`)) {
            await showAppealModal(interaction);
        }
        return;
    }

    if (!interaction.isButton?.()) {
        return;
    }

    const [, action, ticketId] = interaction.customId.split(':');

    if (action === 'claim') {
        await claimTicket(interaction, ticketId);
    } else if (action === 'close') {
        await closeTicket(interaction, ticketId);
    }
}

async function handleTicketMessage(message) {
    const command = message.content.trim().toLowerCase();

    if (!['!hello', '!appeal'].includes(command)) {
        return false;
    }

    const ticket = await getTicketByChannel(
        message.guildId,
        message.channelId
    );

    if (!ticket) {
        return false;
    }

    if (!memberCanManageTicket(message.member, ticket)) {
        await message.reply(
            'Only authorized support staff can use that ticket command.'
        );
        return true;
    }

    if (command === '!hello') {
        const detectedRank = detectMemberRank(
            message.guildId,
            message.member
        );
        const visibleRank =
            detectedRank?.name ||
            (message.member.roles.highest.id !== message.guildId
                ? message.member.roles.highest.name
                : 'Support Team Member');

        if (!ticket.claimedById) {
            ticket.claimedById = message.author.id;
            ticket.claimedAt = new Date().toISOString();
            ticket.updatedAt = ticket.claimedAt;
            await saveTicket(ticket);
        }

        await message.channel.send({
            content:
                `Greetings <@${ticket.openerId}>! I’m **${message.member.displayName}**, ` +
                `a **${visibleRank}** within the Illinois State Roleplay Support Team. ` +
                'I’ll be assisting you today. Please explain your request in detail and provide any relevant evidence or links so I can review everything accurately. How may I help you?',
            allowedMentions: {
                users: [ticket.openerId],
                roles: [],
                parse: [],
            },
        });
        return true;
    }

    await message.channel.send({
        content:
            `<@${ticket.openerId}>, please choose the appeal form that matches your situation. ` +
            'The completed form will be posted privately in this ticket for review.',
        components: [createAppealChoiceRow(ticket)],
        allowedMentions: {
            users: [ticket.openerId],
            roles: [],
            parse: [],
        },
    });
    return true;
}

async function countOpenTickets(guildId) {
    return (await readGuildTickets(guildId)).filter(
        (ticket) => ticket.status === 'open'
    ).length;
}

module.exports = {
    APPEAL_DATABASE,
    CREATE_MENU_ID,
    TICKET_DATABASE,
    TICKET_PANEL_DATABASE,
    TICKET_PREFIX,
    archiveTicketTranscript,
    countOpenTickets,
    createAppealModal,
    createTicketTranscript,
    createTicketOpeningMentions,
    createTicketPanelPayload,
    fetchStoredTicketMessage,
    getStoredTicketPanel,
    getCategorySupportRoleIds,
    getSupportRoleIds,
    getTicketByChannel,
    handleTicketInteraction,
    handleTicketMessage,
    memberCanManageTickets,
    memberCanManageTicket,
    saveTicketPanel,
};

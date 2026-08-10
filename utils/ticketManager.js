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
    PermissionFlagsBits,
    SeparatorBuilder,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    TextDisplayBuilder,
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
                    ? 'An Internal Affairs team member can post the appeal questionnaire with `!appeal`.'
                    : category.id === 'internal_affairs'
                      ? 'Internal Affairs can post the appeal questionnaire with `!appeal` when needed.'
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
                    `Closed by ${interaction.user}. A private transcript will be archived, then this channel will be deleted automatically.`
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

    if (!transcriptArchived) {
        await interaction.editReply(
            '⚠️ Ticket closed and locked, but its transcript could not be archived. The channel was kept to prevent evidence loss. Please check the transcript channel permissions.'
        );
        return;
    }

    await interaction.editReply(
        '✅ Ticket closed and privately archived. This channel will be deleted in 5 seconds.'
    );

    await new Promise((resolve) => setTimeout(resolve, 5_000));

    try {
        await interaction.channel.delete(
            `Ticket ${ticket.id} closed by ${interaction.user.username}`
        );
        ticket.channelDeletedAt = new Date().toISOString();
        ticket.updatedAt = ticket.channelDeletedAt;
        await saveTicket(ticket);
    } catch (error) {
        console.error(
            `[TICKETS] Could not delete closed ticket channel ${ticket.channelId}:`,
            error
        );
    }
}

function createAppealQuestionnaire(ticket) {
    const questions = [
        'Appeal Type: In-Game Punishment / Staff Infraction',
        'Roblox Username:',
        'Punishment or Infraction Being Appealed:',
        'Approximate Date and Time:',
        'Staff Member Involved (if known):',
        'Why Should This Action Be Reconsidered?',
        'Evidence or Supporting Links:',
        'Anything Else We Should Know:',
    ].join('\n\n');

    return {
        content: [
            '## Appeal Questionnaire',
            `<@${ticket.openerId}>, copy the template below, add your answers, and send the completed version as a normal message in this ticket.`,
            '',
            '```text',
            questions,
            '```',
            'A ticket handler will review your answers and tell you whether the appeal is accepted, denied, or needs more information.',
        ].join('\n'),
        allowedMentions: {
            users: [ticket.openerId],
            roles: [],
            parse: [],
        },
    };
}

function createPartnershipRequirementsPayload(guild) {
    const embed = new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setTitle('🤝 | Partnership Requirements')
        .setDescription(
            [
                'Thank you for your interest in partnering with **Illinois State Roleplay**. Please review every requirement before continuing with your request.',
                '',
                '**Representatives**',
                '• Communities with **200 or more members** require **1 representative**.',
                '• Communities with **fewer than 200 members** require **2 representatives**.',
                '• Representatives must remain in both communities and maintain professional communication.',
                '',
                '**Basic Requirements**',
                '• Must comply with the **Discord Terms of Service** and **Roblox Terms of Use**.',
                '• Must be an active and established community.',
                '• Must not be blacklisted by Illinois State Roleplay.',
                '• Must be in good standing with PRC and have no serious reputation concerns.',
                '• Must maintain professional ownership, staff conduct, and community standards.',
                '',
                '**Affiliation Requirement**',
                'If approved, post the provided ISRP advertisement in a server where your community is affiliated and keep it available for the partnership duration.',
                '',
                '*Meeting these requirements does not guarantee approval. Management will review the community before making a final decision.*',
            ].join('\n')
        )
        .setFooter({
            text: 'Illinois State Utilities • Partnership Review',
        })
        .setTimestamp();

    const guildIcon = guild?.iconURL?.({ size: 256 });

    if (guildIcon) {
        embed.setThumbnail(guildIcon);
    }

    return {
        embeds: [embed],
        allowedMentions: { parse: [] },
    };
}

async function handleTicketInteraction(interaction) {
    if (interaction.isModalSubmit?.()) {
        await interaction.reply({
            content:
                'This form has been retired. Ask the ticket handler to run `!appeal` for the in-ticket questionnaire.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (interaction.isStringSelectMenu?.()) {
        if (interaction.customId === CREATE_MENU_ID) {
            await createTicket(interaction);
            return;
        }

        if (interaction.customId.startsWith(`${TICKET_PREFIX}appeal:`)) {
            await interaction.reply({
                content:
                    'This form has been retired. Ask the ticket handler to run `!appeal` again.',
                flags: MessageFlags.Ephemeral,
            });
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
    const isTicketCommand = ['!hello', '!appeal'].includes(command);
    const isPartnershipRequest = /\bpartnerships?\b/i.test(
        message.content
    );

    if (!isTicketCommand && !isPartnershipRequest) {
        return false;
    }

    const ticket = await getTicketByChannel(
        message.guildId,
        message.channelId
    );

    if (!ticket) {
        if (!isTicketCommand) {
            return false;
        }

        await message.delete().catch(() => null);

        const notice = await message.channel
            .send({
                content:
                    '`!hello` and `!appeal` only work inside a ticket created from the Assistance panel. Open a ticket from the dropdown first, then use the command inside that private ticket channel.',
                allowedMentions: { parse: [] },
            })
            .catch(() => null);

        if (notice?.delete) {
            const cleanupTimer = setTimeout(
                () => notice.delete().catch(() => null),
                10_000
            );
            cleanupTimer.unref?.();
        }

        return true;
    }

    if (isPartnershipRequest) {
        if (
            message.author.id !== ticket.openerId ||
            ticket.partnershipRequirementsSentAt
        ) {
            return false;
        }

        ticket.partnershipRequirementsSentAt = new Date().toISOString();
        ticket.updatedAt = ticket.partnershipRequirementsSentAt;
        await saveTicket(ticket);

        try {
            await message.channel.send(
                createPartnershipRequirementsPayload(message.guild)
            );
            return true;
        } catch (error) {
            delete ticket.partnershipRequirementsSentAt;
            ticket.updatedAt = new Date().toISOString();
            await saveTicket(ticket).catch(() => null);
            console.error(
                `[TICKETS] Could not send partnership requirements in ${ticket.id}:`,
                error
            );
            return false;
        }
    }

    if (!memberCanManageTicket(message.member, ticket)) {
        await message.reply(
            'Only authorized support staff can use that ticket command.'
        );
        return true;
    }

    if (command === '!hello') {
        await message.delete().catch(() => null);

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

    await message.channel.send(
        createAppealQuestionnaire(ticket)
    );
    return true;
}

async function countOpenTickets(guildId) {
    return (await readGuildTickets(guildId)).filter(
        (ticket) => ticket.status === 'open'
    ).length;
}

module.exports = {
    CREATE_MENU_ID,
    TICKET_DATABASE,
    TICKET_PANEL_DATABASE,
    TICKET_PREFIX,
    archiveTicketTranscript,
    countOpenTickets,
    createAppealQuestionnaire,
    createPartnershipRequirementsPayload,
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

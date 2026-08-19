const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const brands = require('../config/branding');
const callsignConfig = require('../config/ispCallsigns');
const {
    fetchGuildMember,
    isIspMember,
} = require('./ispShiftManager');
const {
    assignCallsign,
    assignLowestFreeCallsign,
    findCallsignAssignment,
    formatCallsign,
    formatCallsignNumber,
    getCallsignForUser,
    getFreeNumbers,
    getSectionById,
    listCallsignAssignments,
    normalizeCallsignNumber,
    releaseCallsign,
} = require('./ispCallsignStore');

const ISP_CALLSIGN_PREFIX = 'isp_callsign:';
const DIRECTORY_PAGE_SIZE = 20;

function memberHasRole(member, roleId) {
    return Boolean(roleId && member?.roles?.cache?.has?.(roleId));
}

function isCallsignAdministrator(interaction) {
    return Boolean(
        interaction.memberPermissions?.has?.(
            PermissionFlagsBits.Administrator
        ) || memberHasRole(interaction.member, callsignConfig.managementRoleId)
    );
}

function getMemberCallsignSection(member) {
    if (!member) return null;

    const configured = callsignConfig.sections.find((section) =>
        section.roleIds.some((roleId) => memberHasRole(member, roleId))
    );
    if (configured) return configured;

    // A department member whose exact rank is temporarily unavailable is
    // placed in Patrol rather than being blocked from the system.
    return isIspMember(member)
        ? callsignConfig.sections.find((section) => section.id === 'patrol') ||
              null
        : null;
}

function stripManagedCallsign(value) {
    return String(value || '')
        .replace(/^(?:SP|ISP)-\d{3}\s*\|\s*/i, '')
        .trim();
}

function buildManagedNickname(assignment, member) {
    const baseName =
        stripManagedCallsign(member?.displayName) ||
        assignment.baseNickname ||
        member?.user?.username ||
        'ISP Member';
    const prefix = `${assignment.callsign} | `;
    return `${prefix}${baseName.slice(0, Math.max(1, 32 - prefix.length))}`;
}

async function syncCallsignNickname(member, assignment) {
    if (!member?.setNickname) {
        return 'I saved the callsign, but this member could not be renamed.';
    }
    if (member.manageable === false) {
        return 'I saved the callsign, but my bot role is below this member in the role list.';
    }

    const nickname = buildManagedNickname(assignment, member);
    try {
        await member.setNickname(
            nickname,
            `ISP callsign assigned by ${assignment.assignedBy}`
        );
        return null;
    } catch (error) {
        console.error('[ISP CALLSIGN] Nickname sync failed:', error);
        return 'I saved the callsign, but Discord prevented the nickname update. Check the bot role hierarchy.';
    }
}

async function restoreCallsignNickname(member, assignment) {
    if (!member?.setNickname || member.manageable === false) {
        return 'The callsign was released, but I could not restore the nickname.';
    }

    const restored =
        stripManagedCallsign(member.displayName) ||
        assignment.baseNickname ||
        member.user.username;
    try {
        await member.setNickname(
            restored.slice(0, 32),
            'ISP callsign released'
        );
        return null;
    } catch (error) {
        console.error('[ISP CALLSIGN] Nickname restore failed:', error);
        return 'The callsign was released, but Discord prevented the nickname update.';
    }
}

async function fetchLogChannel(guild) {
    const channel =
        guild.channels.cache.get(callsignConfig.logChannelId) ||
        (await guild.channels.fetch(callsignConfig.logChannelId).catch(() => null));
    return channel?.isTextBased?.() ? channel : null;
}

async function sendCallsignLog(
    guild,
    { title, memberId, actorId, assignment, previous = null, warning = null }
) {
    const channel = await fetchLogChannel(guild);
    if (!channel) return null;

    const embed = new EmbedBuilder()
        .setColor(brands.isp.color)
        .setTitle(title)
        .addFields(
            { name: 'Member', value: `<@${memberId}>`, inline: true },
            { name: 'Actioned By', value: `<@${actorId}>`, inline: true },
            {
                name: 'Callsign',
                value: assignment?.callsign || 'Released',
                inline: true,
            }
        )
        .setFooter({ text: brands.isp.footer })
        .setTimestamp();

    if (assignment?.sectionName) {
        embed.addFields({
            name: 'Section',
            value: assignment.sectionName,
            inline: true,
        });
    }
    if (previous?.callsign) {
        embed.addFields({
            name: 'Previous Callsign',
            value: previous.callsign,
            inline: true,
        });
    }
    if (warning) embed.addFields({ name: 'Nickname Warning', value: warning });

    return channel
        .send({ embeds: [embed], allowedMentions: { parse: [] } })
        .catch((error) => {
            console.error('[ISP CALLSIGN] Could not send audit log:', error);
            return null;
        });
}

function createPanelButtons(ownerId, assignment, administrator = false) {
    const rows = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${ISP_CALLSIGN_PREFIX}mine:${ownerId}`)
                .setLabel('My Callsign')
                .setEmoji('🪪')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`${ISP_CALLSIGN_PREFIX}request:${ownerId}`)
                .setLabel('Request Callsign')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
                .setDisabled(Boolean(assignment)),
            new ButtonBuilder()
                .setCustomId(`${ISP_CALLSIGN_PREFIX}list:${ownerId}:0`)
                .setLabel('Browse / List')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`${ISP_CALLSIGN_PREFIX}find:${ownerId}`)
                .setLabel('Find by Callsign')
                .setEmoji('🔎')
                .setStyle(ButtonStyle.Secondary)
        ),
    ];

    if (administrator) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`${ISP_CALLSIGN_PREFIX}admin_assign:${ownerId}`)
                    .setLabel('Assign / Change Member')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`${ISP_CALLSIGN_PREFIX}admin_release:${ownerId}`)
                    .setLabel('Release Member')
                    .setStyle(ButtonStyle.Danger)
            )
        );
    }

    return rows;
}

async function createCallsignPanelPayload(interaction, member = interaction.member) {
    const assignment = await getCallsignForUser(interaction.guildId, member.id);
    if (assignment) {
        // Opening the panel upgrades a legacy ISP-XXX nickname to SP-XXX
        // without changing the member's assigned number.
        await syncCallsignNickname(member, assignment);
    }
    const section = getMemberCallsignSection(member);
    const freeNumbers = section
        ? await getFreeNumbers(interaction.guildId, section.id)
        : [];
    const embed = new EmbedBuilder()
        .setColor(brands.palette.lightBlue)
        .setTitle('ISP Callsign Management')
        .setDescription(
            'Manage your official Illinois State Police callsign from one private panel.'
        )
        .addFields(
            {
                name: 'Your Callsign',
                value: assignment ? `\`${assignment.callsign}\`` : 'Not assigned',
                inline: true,
            },
            {
                name: 'Your Section',
                value: section?.name || 'Not eligible',
                inline: true,
            },
            {
                name: 'Free Numbers',
                value: String(freeNumbers.length),
                inline: true,
            }
        )
        .setFooter({
            text: `Officer: ${interaction.user.username} • ${brands.isp.footer}`,
        })
        .setTimestamp();

    const avatar = interaction.user.displayAvatarURL?.({ size: 256 });
    if (avatar) embed.setThumbnail(avatar);

    return {
        embeds: [embed],
        components: createPanelButtons(
            interaction.user.id,
            assignment,
            isCallsignAdministrator(interaction)
        ),
        allowedMentions: { parse: [] },
    };
}

async function createRequestPayload(interaction) {
    const section = getMemberCallsignSection(interaction.member);
    const current = await getCallsignForUser(
        interaction.guildId,
        interaction.user.id
    );

    if (!section) {
        return {
            content: 'Your ISP rank does not have a callsign section configured.',
            embeds: [],
            components: [createBackRow(interaction.user.id)],
        };
    }

    const freeNumbers = await getFreeNumbers(interaction.guildId, section.id);
    const preview = freeNumbers
        .slice(0, 12)
        .map((number) => `\`${formatCallsign(number)}\``)
        .join(' ');
    const embed = new EmbedBuilder()
        .setColor(brands.palette.lightBlue)
        .setTitle('Request a Callsign')
        .addFields(
            { name: 'Section', value: section.name, inline: true },
            {
                name: 'Range',
                value: `\`${formatCallsign(section.minimum)}\` – \`${formatCallsign(section.maximum)}\``,
                inline: true,
            },
            {
                name: 'Current',
                value: current ? `\`${current.callsign}\`` : 'None',
                inline: true,
            },
            { name: 'Free', value: String(freeNumbers.length), inline: true },
            {
                name: 'Next Available',
                value: preview || 'This section is currently full.',
            }
        )
        .setFooter({ text: brands.isp.footer });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ISP_CALLSIGN_PREFIX}request_number:${interaction.user.id}`)
            .setLabel('Enter a Number')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(Boolean(current) || !freeNumbers.length),
        new ButtonBuilder()
            .setCustomId(`${ISP_CALLSIGN_PREFIX}request_lowest:${interaction.user.id}`)
            .setLabel('Assign Lowest Free')
            .setStyle(ButtonStyle.Success)
            .setDisabled(Boolean(current) || !freeNumbers.length),
        backButton(interaction.user.id)
    );

    return {
        content: '',
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: [] },
    };
}

function backButton(ownerId) {
    return new ButtonBuilder()
        .setCustomId(`${ISP_CALLSIGN_PREFIX}back:${ownerId}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary);
}

function createBackRow(ownerId) {
    return new ActionRowBuilder().addComponents(backButton(ownerId));
}

async function createMinePayload(interaction) {
    const assignment = await getCallsignForUser(
        interaction.guildId,
        interaction.user.id
    );
    const embed = new EmbedBuilder()
        .setColor(brands.palette.lightBlue)
        .setTitle('Your Callsign')
        .setDescription(
            assignment
                ? `# ${assignment.callsign}\nYour official ISP callsign is active.`
                : 'You do not currently have an assigned callsign.'
        )
        .setFooter({ text: brands.isp.footer });

    if (assignment) {
        embed.addFields(
            { name: 'Section', value: assignment.sectionName, inline: true },
            {
                name: 'Assigned',
                value: `<t:${Math.floor(new Date(assignment.assignedAt).getTime() / 1000)}:R>`,
                inline: true,
            }
        );
    }

    return {
        content: '',
        embeds: [embed],
        components: [createBackRow(interaction.user.id)],
        allowedMentions: { parse: [] },
    };
}

async function createDirectoryPayload(interaction, requestedPage = 0) {
    const assignments = await listCallsignAssignments(interaction.guildId);
    const pageCount = Math.max(
        1,
        Math.ceil(assignments.length / DIRECTORY_PAGE_SIZE)
    );
    const page = Math.min(Math.max(0, Number(requestedPage) || 0), pageCount - 1);
    const entries = assignments.slice(
        page * DIRECTORY_PAGE_SIZE,
        (page + 1) * DIRECTORY_PAGE_SIZE
    );
    const lines = [];
    let previousSectionId = null;

    for (const assignment of entries) {
        if (assignment.sectionId !== previousSectionId) {
            const section = getSectionById(assignment.sectionId);
            lines.push(`\n**${section?.name || assignment.sectionName}**`);
            previousSectionId = assignment.sectionId;
        }
        lines.push(`\`${assignment.callsign}\` — <@${assignment.userId}>`);
    }

    const embed = new EmbedBuilder()
        .setColor(brands.palette.lightBlue)
        .setTitle(`ISP Callsign Directory — ${assignments.length} assigned`)
        .setDescription(
            lines.length ? lines.join('\n').trim() : 'No callsigns are assigned yet.'
        )
        .setFooter({
            text: `Page ${page + 1} of ${pageCount} • ${brands.isp.footer}`,
        });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${ISP_CALLSIGN_PREFIX}list:${interaction.user.id}:${page - 1}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`${ISP_CALLSIGN_PREFIX}list:${interaction.user.id}:${page + 1}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= pageCount - 1),
        backButton(interaction.user.id)
    );

    return {
        content: '',
        embeds: [embed],
        components: [row],
        allowedMentions: { parse: [] },
    };
}

function createNumberModal(ownerId, find = false) {
    const modal = new ModalBuilder()
        .setCustomId(
            `${ISP_CALLSIGN_PREFIX}${find ? 'find_modal' : 'number_modal'}:${ownerId}`
        )
        .setTitle(find ? 'Find Member by Callsign' : 'Choose Your Callsign');
    const input = new TextInputBuilder()
        .setCustomId('number')
        .setLabel('Callsign number (for example, 072)')
        .setPlaceholder('3-digit number')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(3)
        .setRequired(true);
    return modal.addComponents(new ActionRowBuilder().addComponents(input));
}

function createAdminAssignModal(ownerId) {
    return new ModalBuilder()
        .setCustomId(`${ISP_CALLSIGN_PREFIX}admin_assign_modal:${ownerId}`)
        .setTitle('Assign or Change Callsign')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('member')
                    .setLabel('Discord member ID or mention')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('number')
                    .setLabel('Callsign number')
                    .setPlaceholder('For example, 072')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(3)
                    .setRequired(true)
            )
        );
}

function createAdminReleaseModal(ownerId) {
    return new ModalBuilder()
        .setCustomId(`${ISP_CALLSIGN_PREFIX}admin_release_modal:${ownerId}`)
        .setTitle('Release Callsign')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('member')
                    .setLabel('Discord member ID or mention')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
}

function parseUserId(value) {
    return String(value || '').match(/\d{17,20}/)?.[0] || null;
}

async function assignMember(interaction, member, number, replaceExisting) {
    const section = getMemberCallsignSection(member);
    if (!section) return { notice: 'That member is not eligible for an ISP callsign.' };

    const identity = {
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        baseNickname: stripManagedCallsign(member.displayName),
    };
    const result = await assignCallsign(
        interaction.guildId,
        identity,
        number,
        section.id,
        interaction.user.id,
        { replaceExisting }
    );

    if (result.status === 'invalid') {
        return { notice: 'Enter a valid callsign number from 001 through 250.' };
    }
    if (result.status === 'outside_section') {
        return {
            notice: `That number is outside the **${section.name}** range (${formatCallsign(section.minimum)}–${formatCallsign(section.maximum)}).`,
        };
    }
    if (result.status === 'taken') {
        return {
            notice: `\`${formatCallsign(number)}\` is already assigned to <@${result.assignment.userId}>.`,
        };
    }
    if (result.status === 'already_assigned') {
        return {
            notice: `You already have \`${result.assignment.callsign}\`. Office of Director can change it if needed.`,
        };
    }

    const warning = await syncCallsignNickname(member, result.assignment);
    await sendCallsignLog(interaction.guild, {
        title:
            result.status === 'changed'
                ? 'ISP Callsign Changed'
                : 'ISP Callsign Assigned',
        memberId: member.id,
        actorId: interaction.user.id,
        assignment: result.assignment,
        previous: result.previous,
        warning,
    });

    return {
        notice: `✅ ${member} is now **${result.assignment.callsign}**.${warning ? `\n⚠️ ${warning}` : ''}`,
        assignment: result.assignment,
    };
}

async function assignLowestForMember(interaction, member) {
    const section = getMemberCallsignSection(member);
    if (!section) return { notice: 'Your ISP rank is not eligible for a callsign.' };

    const identity = {
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        baseNickname: stripManagedCallsign(member.displayName),
    };
    const result = await assignLowestFreeCallsign(
        interaction.guildId,
        identity,
        section.id,
        interaction.user.id
    );
    if (result.status === 'section_full') {
        return { notice: `The **${section.name}** callsign range is currently full.` };
    }
    if (!['assigned', 'changed', 'unchanged'].includes(result.status)) {
        return {
            notice:
                result.status === 'already_assigned'
                    ? `You already have \`${result.assignment.callsign}\`.`
                    : 'The callsign could not be assigned.',
        };
    }

    const warning = await syncCallsignNickname(member, result.assignment);
    await sendCallsignLog(interaction.guild, {
        title: 'ISP Callsign Assigned',
        memberId: member.id,
        actorId: interaction.user.id,
        assignment: result.assignment,
        previous: result.previous,
        warning,
    });
    return {
        notice: `✅ Your callsign is now **${result.assignment.callsign}**.${warning ? `\n⚠️ ${warning}` : ''}`,
        assignment: result.assignment,
    };
}

async function handleFindModal(interaction) {
    const rawNumber = interaction.fields.getTextInputValue('number');
    const number = normalizeCallsignNumber(rawNumber);
    const assignment = number === null
        ? null
        : await findCallsignAssignment(interaction.guildId, number);
    const embed = new EmbedBuilder()
        .setColor(brands.palette.lightBlue)
        .setTitle('Callsign Search')
        .setDescription(
            number === null
                ? 'Enter a valid number from 001 through 250.'
                : assignment
                  ? `\`${assignment.callsign}\` belongs to <@${assignment.userId}>.`
                  : `\`${formatCallsign(number)}\` is currently available.`
        )
        .setFooter({ text: brands.isp.footer });

    await interaction.editReply({
        content: '',
        embeds: [embed],
        components: [createBackRow(interaction.user.id)],
        allowedMentions: { parse: [] },
    });
}

async function handleAdminAssignModal(interaction) {
    if (!isCallsignAdministrator(interaction)) {
        await interaction.editReply('Only the Office of Director can assign another member.');
        return;
    }

    const userId = parseUserId(interaction.fields.getTextInputValue('member'));
    const number = interaction.fields.getTextInputValue('number');
    const member = userId
        ? await fetchGuildMember(interaction.guild, userId)
        : null;
    if (!member) {
        await interaction.editReply('I could not find that member in the ISP server.');
        return;
    }

    const result = await assignMember(interaction, member, number, true);
    const panel = await createCallsignPanelPayload(interaction);
    await interaction.editReply({ content: result.notice, ...panel });
}

async function handleAdminReleaseModal(interaction) {
    if (!isCallsignAdministrator(interaction)) {
        await interaction.editReply('Only the Office of Director can release another member.');
        return;
    }

    const userId = parseUserId(interaction.fields.getTextInputValue('member'));
    const member = userId
        ? await fetchGuildMember(interaction.guild, userId)
        : null;
    if (!userId) {
        await interaction.editReply('Enter a valid Discord user ID or mention.');
        return;
    }

    const result = await releaseCallsign(
        interaction.guildId,
        userId,
        interaction.user.id
    );
    if (result.status === 'not_assigned') {
        await interaction.editReply('That member does not have an assigned callsign.');
        return;
    }

    const warning = member
        ? await restoreCallsignNickname(member, result.assignment)
        : 'The member left the server, so their nickname could not be restored.';
    await sendCallsignLog(interaction.guild, {
        title: 'ISP Callsign Released',
        memberId: userId,
        actorId: interaction.user.id,
        assignment: null,
        previous: result.assignment,
        warning,
    });
    const panel = await createCallsignPanelPayload(interaction);
    await interaction.editReply({
        content: `✅ Released **${result.assignment.callsign}** from <@${userId}>.${warning ? `\n⚠️ ${warning}` : ''}`,
        ...panel,
    });
}

async function handleIspCallsignInteraction(interaction) {
    if (!interaction.customId?.startsWith(ISP_CALLSIGN_PREFIX)) return;

    if (
        interaction.guildId !== callsignConfig.guildId ||
        interaction.channelId !== callsignConfig.commandChannelId
    ) {
        await interaction.reply({
            content: `Use callsign controls in <#${callsignConfig.commandChannelId}>.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const [action, ownerId, argument] = interaction.customId
        .slice(ISP_CALLSIGN_PREFIX.length)
        .split(':');
    if (ownerId !== interaction.user.id) {
        await interaction.reply({
            content: 'This private callsign panel belongs to another member.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (!isIspMember(interaction.member)) {
        await interaction.reply({
            content: 'You must be an ISP member to use the callsign system.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (action === 'request_number') {
        await interaction.showModal(createNumberModal(ownerId));
        return;
    }
    if (action === 'find') {
        await interaction.showModal(createNumberModal(ownerId, true));
        return;
    }
    if (action === 'admin_assign') {
        if (!isCallsignAdministrator(interaction)) {
            await interaction.reply({
                content: 'Only the Office of Director can use this control.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.showModal(createAdminAssignModal(ownerId));
        return;
    }
    if (action === 'admin_release') {
        if (!isCallsignAdministrator(interaction)) {
            await interaction.reply({
                content: 'Only the Office of Director can use this control.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.showModal(createAdminReleaseModal(ownerId));
        return;
    }

    if (interaction.isModalSubmit?.()) {
        await interaction.deferUpdate();
        if (action === 'find_modal') {
            await handleFindModal(interaction);
            return;
        }
        if (action === 'admin_assign_modal') {
            await handleAdminAssignModal(interaction);
            return;
        }
        if (action === 'admin_release_modal') {
            await handleAdminReleaseModal(interaction);
            return;
        }
        if (action === 'number_modal') {
            const result = await assignMember(
                interaction,
                interaction.member,
                interaction.fields.getTextInputValue('number'),
                false
            );
            const panel = await createCallsignPanelPayload(interaction);
            await interaction.editReply({ content: result.notice, ...panel });
        }
        return;
    }

    await interaction.deferUpdate();
    if (action === 'mine') {
        await interaction.editReply(await createMinePayload(interaction));
        return;
    }
    if (action === 'request') {
        await interaction.editReply(await createRequestPayload(interaction));
        return;
    }
    if (action === 'list') {
        await interaction.editReply(
            await createDirectoryPayload(interaction, argument)
        );
        return;
    }
    if (action === 'request_lowest') {
        const result = await assignLowestForMember(
            interaction,
            interaction.member
        );
        const panel = await createCallsignPanelPayload(interaction);
        await interaction.editReply({ content: result.notice, ...panel });
        return;
    }

    await interaction.editReply(
        await createCallsignPanelPayload(interaction)
    );
}

module.exports = {
    ISP_CALLSIGN_PREFIX,
    assignMember,
    buildManagedNickname,
    createCallsignPanelPayload,
    createDirectoryPayload,
    createMinePayload,
    createRequestPayload,
    getMemberCallsignSection,
    handleIspCallsignInteraction,
    isCallsignAdministrator,
    restoreCallsignNickname,
    stripManagedCallsign,
    syncCallsignNickname,
};

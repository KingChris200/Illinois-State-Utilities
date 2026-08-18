const {
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} = require('discord.js');

const brands = require('../../config/branding');
const shiftConfig = require('../../config/ispShift');
const {
    addInfraction,
    adjustUserTime,
    clearInfractions,
    clearPromotionCooldown,
    excuseUser,
    formatDuration,
    getActiveCooldowns,
    getActiveInfractions,
    getGuildState,
    getOnlineUsers,
    getPromotionCandidates,
    getShiftSnapshot,
    revokeExcuse,
    setLoggingEnabled,
    setPromotionCooldown,
} = require('../../utils/ispShiftStore');
const {
    buildManagePayload,
    createEndAllConfirmation,
    createLeaderboardEmbed,
    createOnlineEmbed,
    createUserAdminEmbed,
    fetchGuildMember,
    getIspRank,
    isIspMember,
    isShiftAdministrator,
    sendShiftLog,
    stopMemberShift,
} = require('../../utils/ispShiftManager');
const {
    createIspShiftDashboardPayload,
    fetchStoredIspShiftDashboardMessage,
    getStoredIspShiftDashboard,
    removeStoredIspShiftDashboard,
    saveIspShiftDashboard,
} = require('../../utils/ispShiftDashboardManager');

const ADMIN_SUBCOMMANDS = new Set([
    'cooldowns',
    'dashboard',
    'excuse',
    'excuse-revoke',
    'lists',
    'logging',
    'promotions',
    'quota-reminder',
]);

function createBaseEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(brands.isp.color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: brands.isp.footer })
        .setTimestamp();
}

function truncateLines(lines, maximum = 3900) {
    const included = [];
    let length = 0;

    for (const line of lines) {
        if (length + line.length + 1 > maximum) break;
        included.push(line);
        length += line.length + 1;
    }
    return included;
}

async function getMemberOption(interaction) {
    const user = interaction.options.getUser('member', true);
    return fetchGuildMember(interaction.guild, user.id);
}

async function replyWithError(interaction, content) {
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [], components: [] });
    } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
}

async function fetchShiftManageChannel(guild) {
    return (
        guild.channels?.cache?.get(shiftConfig.shiftManageChannelId) ||
        (guild.channels?.fetch
            ? await guild.channels
                  .fetch(shiftConfig.shiftManageChannelId)
                  .catch(() => null)
            : null)
    );
}

async function handleShiftDashboard(interaction) {
    const action = interaction.options.getString('action', true);
    const stored = await getStoredIspShiftDashboard(interaction.guildId);
    const existingMessage = await fetchStoredIspShiftDashboardMessage(
        interaction.client,
        stored
    );

    if (action === 'remove') {
        if (!stored) {
            await interaction.editReply(
                'No permanent ISP shift dashboard is currently configured.'
            );
            return;
        }

        await existingMessage?.delete().catch(() => null);
        await removeStoredIspShiftDashboard(interaction.guildId);
        await interaction.editReply('✅ The permanent ISP shift dashboard was removed.');
        return;
    }

    const payload = await createIspShiftDashboardPayload(interaction.guild);

    if (action === 'update') {
        if (!existingMessage) {
            await interaction.editReply(
                'The saved dashboard message could not be found. Run `/shift dashboard` with **Setup Dashboard** to recreate it.'
            );
            return;
        }

        await existingMessage.edit(payload);
        await saveIspShiftDashboard(interaction.guildId, {
            ...stored,
            updatedAt: new Date().toISOString(),
            updatedBy: interaction.user.id,
        });
        await interaction.editReply(
            `✅ The ISP shift dashboard was updated: ${existingMessage.url}`
        );
        return;
    }

    const channel = await fetchShiftManageChannel(interaction.guild);
    if (!channel?.isTextBased?.() || !channel.send) {
        await interaction.editReply(
            `I could not access the configured shift-management channel <#${shiftConfig.shiftManageChannelId}>.`
        );
        return;
    }

    let dashboardMessage = existingMessage;
    if (dashboardMessage?.channelId === channel.id) {
        await dashboardMessage.edit(payload);
    } else {
        dashboardMessage = await channel.send(payload);
        await existingMessage?.delete().catch(() => null);
    }

    await saveIspShiftDashboard(interaction.guildId, {
        channelId: channel.id,
        messageId: dashboardMessage.id,
        postedBy: interaction.user.id,
        updatedBy: interaction.user.id,
        updatedAt: new Date().toISOString(),
    });
    await interaction.editReply(
        `✅ The permanent ISP shift dashboard is ready: ${dashboardMessage.url}`
    );
}

async function handleGlobalAdmin(interaction) {
    const action = interaction.options.getString('action', true);
    const online = await getOnlineUsers(interaction.guildId);
    const guildState = await getGuildState(interaction.guildId);

    if (action === 'overview') {
        const embed = createBaseEmbed(
            'Global Shift Administration',
            'Current Illinois State Police shift-system status.'
        ).addFields(
            {
                name: 'Shift Logging',
                value: guildState.settings.loggingEnabled ? 'Enabled' : 'Disabled',
                inline: true,
            },
            {
                name: 'Officers Online',
                value: String(online.length),
                inline: true,
            },
            {
                name: 'Weekly Quota',
                value: formatDuration(guildState.settings.weeklyQuotaMs),
                inline: true,
            },
            {
                name: 'Management Role',
                value: `<@&${shiftConfig.managementRoleId}>`,
                inline: true,
            },
            {
                name: 'On-Duty Role',
                value: `<@&${shiftConfig.onDutyRoleId}>`,
                inline: true,
            }
        );
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    if (action === 'end_all') {
        await interaction.editReply(
            createEndAllConfirmation(interaction.user.id, online.length)
        );
        return;
    }

    const enabled = action === 'enable_logging';
    const result = await setLoggingEnabled(
        interaction.guildId,
        enabled,
        interaction.user.id
    );
    await sendShiftLog(interaction.guild, {
        title: enabled ? 'Shift Logging Enabled' : 'Shift Logging Disabled',
        description: `<@${interaction.user.id}> changed the global shift-logging status.`,
        userId: interaction.user.id,
        actorId: interaction.user.id,
        administration: true,
        force: true,
    });
    await interaction.editReply(
        `✅ Shift logging is now **${enabled ? 'enabled' : 'disabled'}**${
            result.status === 'unchanged' ? ' (no change was needed)' : ''
        }.`
    );
}

async function handleUserAdmin(interaction) {
    const member = await getMemberOption(interaction);
    if (!member) {
        await replyWithError(interaction, 'That member is no longer in the ISP server.');
        return;
    }

    const action = interaction.options.getString('action', true);
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason')?.trim();

    if (action === 'view') {
        const snapshot = await getShiftSnapshot(interaction.guildId, member.id);
        await interaction.editReply({
            embeds: [createUserAdminEmbed(member, snapshot)],
        });
        return;
    }

    if (action === 'force_end') {
        const result = await stopMemberShift(interaction, member, {
            reason: reason || 'Shift ended by the Office of Director',
        });
        await interaction.editReply(
            result.status === 'stopped'
                ? `✅ Ended ${member}'s shift with **${formatDuration(result.session.durationMs)}** recorded.${result.roleWarning ? `\n⚠️ ${result.roleWarning}` : ''}`
                : `${member} does not have an active shift.`
        );
        return;
    }

    if (['add_time', 'remove_time'].includes(action)) {
        if (!amount) {
            await replyWithError(
                interaction,
                'Provide an `amount` in minutes for this adjustment.'
            );
            return;
        }
        const signedMinutes = action === 'remove_time' ? -amount : amount;
        await adjustUserTime(
            interaction.guildId,
            member.user,
            signedMinutes,
            interaction.user.id,
            reason || 'Office of Director adjustment'
        );
        await sendShiftLog(interaction.guild, {
            title: 'Shift Time Adjusted',
            description: `${signedMinutes > 0 ? 'Added' : 'Removed'} **${formatDuration(Math.abs(signedMinutes) * 60000)}** ${signedMinutes > 0 ? 'to' : 'from'} the officer's current wave total.`,
            userId: member.id,
            actorId: interaction.user.id,
            reason: reason || 'Office of Director adjustment',
            administration: true,
            force: true,
        });
        await interaction.editReply(
            `✅ ${signedMinutes > 0 ? 'Added' : 'Removed'} **${formatDuration(Math.abs(signedMinutes) * 60000)}** ${signedMinutes > 0 ? 'to' : 'from'} ${member}'s current wave.`
        );
        return;
    }

    if (action === 'add_infraction') {
        if (!reason) {
            await replyWithError(
                interaction,
                'A `reason` is required when adding a shift infraction.'
            );
            return;
        }
        const infraction = await addInfraction(
            interaction.guildId,
            member.user,
            interaction.user.id,
            reason
        );
        await sendShiftLog(interaction.guild, {
            title: 'Shift Infraction Added',
            description: `Infraction ID: \`${infraction.id}\``,
            userId: member.id,
            actorId: interaction.user.id,
            reason,
            administration: true,
            force: true,
            color: 0xed4245,
        });
        await interaction.editReply(`✅ Added a shift infraction to ${member}.`);
        return;
    }

    if (action === 'clear_infractions') {
        const cleared = await clearInfractions(
            interaction.guildId,
            member.user,
            interaction.user.id
        );
        await interaction.editReply(
            `✅ Cleared **${cleared}** active shift infraction${cleared === 1 ? '' : 's'} for ${member}.`
        );
        return;
    }

    if (action === 'set_cooldown') {
        const days = amount || shiftConfig.promotionCooldownDays;
        const until = await setPromotionCooldown(
            interaction.guildId,
            member.user,
            days,
            interaction.user.id,
            reason || 'Office of Director decision'
        );
        await interaction.editReply(
            `✅ ${member}'s promotion cooldown is active until <t:${Math.floor(new Date(until).getTime() / 1000)}:F>.`
        );
        return;
    }

    await clearPromotionCooldown(
        interaction.guildId,
        member.user,
        interaction.user.id
    );
    await interaction.editReply(`✅ Cleared ${member}'s promotion cooldown.`);
}

async function handleCooldowns(interaction) {
    const entries = await getActiveCooldowns(interaction.guildId);
    const lines = entries.map(
        (entry) =>
            `<@${entry.userId}> — <t:${Math.floor(new Date(entry.promotionCooldownUntil).getTime() / 1000)}:R>`
    );
    await interaction.editReply({
        embeds: [
            createBaseEmbed(
                `Active Promotion Cooldowns (${entries.length})`,
                lines.length ? truncateLines(lines).join('\n') : 'No promotion cooldowns are active.'
            ),
        ],
    });
}

async function handleExcuse(interaction, revoke = false) {
    const member = await getMemberOption(interaction);
    if (!member) {
        await replyWithError(interaction, 'That member is no longer in the ISP server.');
        return;
    }

    if (revoke) {
        const removed = await revokeExcuse(
            interaction.guildId,
            member.user,
            interaction.user.id
        );
        await interaction.editReply(
            removed
                ? `✅ Revoked ${member}'s excuse for the current shift wave.`
                : `${member} was not excused for the current shift wave.`
        );
        return;
    }

    const reason = interaction.options.getString('reason', true);
    await excuseUser(
        interaction.guildId,
        member.user,
        interaction.user.id,
        reason
    );
    await sendShiftLog(interaction.guild, {
        title: 'Shift Wave Excuse Granted',
        description: 'The officer is excused from the current weekly quota.',
        userId: member.id,
        actorId: interaction.user.id,
        reason,
        administration: true,
        force: true,
    });
    await interaction.editReply(
        `✅ Excused ${member} from the current shift wave.\n**Reason:** ${reason}`
    );
}

async function handleInfractionList(interaction) {
    const entries = await getActiveInfractions(interaction.guildId);
    const lines = entries.flatMap((entry) =>
        entry.activeInfractions.map(
            (infraction) =>
                `<@${entry.userId}> — ${infraction.reason} (\`${infraction.id}\`)`
        )
    );
    await interaction.editReply({
        embeds: [
            createBaseEmbed(
                `Active Shift Infractions (${lines.length})`,
                lines.length ? truncateLines(lines).join('\n') : 'No active shift infractions were found.'
            ),
        ],
    });
}

async function handleLogging(interaction) {
    const enabled = interaction.options.getBoolean('enabled', true);
    const result = await setLoggingEnabled(
        interaction.guildId,
        enabled,
        interaction.user.id
    );
    await sendShiftLog(interaction.guild, {
        title: enabled ? 'Shift Logging Enabled' : 'Shift Logging Disabled',
        description: `<@${interaction.user.id}> changed the global shift-logging status.`,
        userId: interaction.user.id,
        actorId: interaction.user.id,
        administration: true,
        force: true,
    });
    await interaction.editReply(
        `✅ Shift logging is **${enabled ? 'enabled' : 'disabled'}**${
            result.status === 'unchanged' ? ' already' : ''
        }.`
    );
}

async function handlePromotions(interaction) {
    const candidates = await getPromotionCandidates(interaction.guildId);
    const lines = [];

    for (const candidate of candidates.slice(0, 25)) {
        const member = await fetchGuildMember(interaction.guild, candidate.userId);
        if (!member) continue;
        lines.push(
            `${member} — **${getIspRank(member)}** — ${formatDuration(candidate.weeklyDurationMs)}`
        );
    }

    const embed = createBaseEmbed(
        'ISP Promotion Review',
        lines.length
            ? [
                  'The following personnel met the shift-time requirement and have no active shift infractions or promotion cooldowns:',
                  '',
                  ...truncateLines(lines, 3300),
                  '',
                  '**Leadership review is still required. No roles were changed automatically.**',
              ].join('\n')
            : 'No personnel currently meet the automated shift-review conditions.'
    );
    const channel =
        interaction.guild.channels.cache.get(
            shiftConfig.shiftAdministrationChannelId
        ) ||
        (await interaction.guild.channels
            .fetch(shiftConfig.shiftAdministrationChannelId)
            .catch(() => null));

    if (channel?.isTextBased()) {
        const message = await channel.send({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
        await interaction.editReply(
            `✅ Posted the promotion review in ${channel}: ${message.url}`
        );
    } else {
        await interaction.editReply({ embeds: [embed] });
    }
}

async function handleQuotaReminder(interaction) {
    await interaction.guild.members.fetch();
    const members = interaction.guild.members.cache.filter(
        (member) => !member.user.bot && isIspMember(member)
    );
    const guildState = await getGuildState(interaction.guildId);
    const reminders = [];

    for (const member of members.values()) {
        const snapshot = await getShiftSnapshot(interaction.guildId, member.id);
        if (snapshot.excused || snapshot.weeklyDurationMs >= snapshot.weeklyQuotaMs) {
            continue;
        }
        const remaining = snapshot.weeklyQuotaMs - snapshot.weeklyDurationMs;
        const embed = createBaseEmbed(
            'ISP Weekly Shift Reminder',
            [
                `You currently have **${formatDuration(snapshot.weeklyDurationMs)}** recorded this wave.`,
                `You need **${formatDuration(remaining)}** more to meet the **${formatDuration(snapshot.weeklyQuotaMs)}** weekly requirement.`,
                '',
                'Use `/shift manage` in the ISP shift-management channel when you are ready to begin.',
            ].join('\n')
        );
        reminders.push(
            member.send({ embeds: [embed] }).then(
                () => ({ status: 'sent' }),
                () => ({ status: 'failed' })
            )
        );
    }

    const results = await Promise.all(reminders);
    const sent = results.filter((result) => result.status === 'sent').length;
    const failed = results.length - sent;
    await sendShiftLog(interaction.guild, {
        title: 'Weekly Quota Reminders Sent',
        description: `Sent: **${sent}**\nFailed: **${failed}**\nQuota: **${formatDuration(guildState.settings.weeklyQuotaMs)}**`,
        userId: interaction.user.id,
        actorId: interaction.user.id,
        administration: true,
        force: true,
    });
    await interaction.editReply(
        `✅ Sent **${sent}** quota reminder${sent === 1 ? '' : 's'}.${
            failed ? ` **${failed}** member${failed === 1 ? '' : 's'} could not be DMed.` : ''
        }`
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shift')
        .setDescription('Manage Illinois State Police shifts.')
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('manage')
                .setDescription('Open your private shift-management panel.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('leaderboard')
                .setDescription('Show the current weekly shift leaderboard.')
        )
        .addSubcommandGroup((group) =>
            group
                .setName('admin')
                .setDescription('Office of Director shift controls.')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('global')
                        .setDescription('Use a global shift action.')
                        .addStringOption((option) =>
                            option
                                .setName('action')
                                .setDescription('Choose the global action.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'View Overview', value: 'overview' },
                                    { name: 'End All Active Shifts', value: 'end_all' },
                                    { name: 'Enable Shift Logging', value: 'enable_logging' },
                                    { name: 'Disable Shift Logging', value: 'disable_logging' }
                                )
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('user')
                        .setDescription('Use an action for one ISP member.')
                        .addUserOption((option) =>
                            option
                                .setName('member')
                                .setDescription('The ISP member to manage.')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('action')
                                .setDescription('Choose the user action.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'View Shift Record', value: 'view' },
                                    { name: 'Force End Shift', value: 'force_end' },
                                    { name: 'Add Shift Time', value: 'add_time' },
                                    { name: 'Remove Shift Time', value: 'remove_time' },
                                    { name: 'Add Shift Infraction', value: 'add_infraction' },
                                    { name: 'Clear Shift Infractions', value: 'clear_infractions' },
                                    { name: 'Set Promotion Cooldown', value: 'set_cooldown' },
                                    { name: 'Clear Promotion Cooldown', value: 'clear_cooldown' }
                                )
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('amount')
                                .setDescription('Minutes for time changes, or days for a cooldown.')
                                .setMinValue(1)
                                .setMaxValue(1440)
                                .setRequired(false)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('reason')
                                .setDescription('Reason for the administrative action.')
                                .setMaxLength(750)
                                .setRequired(false)
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription(
                    'Set up or maintain the permanent ISP shift dashboard.'
                )
                .addStringOption((option) =>
                    option
                        .setName('action')
                        .setDescription(
                            'Choose what to do with the permanent dashboard.'
                        )
                        .setRequired(true)
                        .addChoices(
                            { name: 'Setup Dashboard', value: 'setup' },
                            { name: 'Update Dashboard', value: 'update' },
                            { name: 'Remove Dashboard', value: 'remove' }
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('cooldowns')
                .setDescription('List active promotion cooldowns.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('excuse')
                .setDescription('Excuse an officer from the current shift wave.')
                .addUserOption((option) =>
                    option
                        .setName('member')
                        .setDescription('The officer to excuse.')
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('reason')
                        .setDescription('Why the officer is excused.')
                        .setMinLength(3)
                        .setMaxLength(750)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('excuse-revoke')
                .setDescription('Revoke an officer’s current shift-wave excuse.')
                .addUserOption((option) =>
                    option
                        .setName('member')
                        .setDescription('The officer whose excuse should be revoked.')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('lists')
                .setDescription('Show the active shift-infraction list.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('logging')
                .setDescription('Enable or disable ISP shift logging.')
                .addBooleanOption((option) =>
                    option
                        .setName('enabled')
                        .setDescription('Whether officers may record shift time.')
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('online')
                .setDescription('Show officers who are currently on shift.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('promotions')
                .setDescription('Post a formatted promotion-review list.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('quota-reminder')
                .setDescription('DM officers who have not met the weekly quota.')
        ),

    async execute(interaction) {
        if (!interaction.inGuild() || interaction.guildId !== shiftConfig.guildId) {
            await interaction.reply({
                content: 'This command is only available in the Illinois State Police server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const group = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();
        const administrator = isShiftAdministrator(
            interaction.member,
            interaction.memberPermissions
        );

        if ((group === 'admin' || ADMIN_SUBCOMMANDS.has(subcommand)) && !administrator) {
            await interaction.reply({
                content: `Only <@&${shiftConfig.managementRoleId}> may use this shift-administration command.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (
            ['manage', 'leaderboard', 'online'].includes(subcommand) &&
            !isIspMember(interaction.member)
        ) {
            await interaction.reply({
                content: 'You must be an Illinois State Police member to use shift commands.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (
            subcommand === 'manage' &&
            interaction.channelId !== shiftConfig.shiftManageChannelId
        ) {
            await interaction.reply({
                content: `Please use your shift manager in <#${shiftConfig.shiftManageChannelId}>.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const publicResponse = ['leaderboard', 'online'].includes(subcommand);
        await interaction.deferReply(
            publicResponse ? {} : { flags: MessageFlags.Ephemeral }
        );

        try {
            if (subcommand === 'manage') {
                await interaction.editReply(await buildManagePayload(interaction));
                return;
            }
            if (subcommand === 'leaderboard') {
                await interaction.editReply({
                    embeds: [await createLeaderboardEmbed(interaction.guild)],
                    allowedMentions: { parse: [] },
                });
                return;
            }
            if (subcommand === 'online') {
                await interaction.editReply({
                    embeds: [await createOnlineEmbed(interaction.guild)],
                    allowedMentions: { parse: [] },
                });
                return;
            }
            if (group === 'admin' && subcommand === 'global') {
                await handleGlobalAdmin(interaction);
                return;
            }
            if (group === 'admin' && subcommand === 'user') {
                await handleUserAdmin(interaction);
                return;
            }
            if (subcommand === 'dashboard') {
                await handleShiftDashboard(interaction);
                return;
            }
            if (subcommand === 'cooldowns') {
                await handleCooldowns(interaction);
                return;
            }
            if (subcommand === 'excuse') {
                await handleExcuse(interaction);
                return;
            }
            if (subcommand === 'excuse-revoke') {
                await handleExcuse(interaction, true);
                return;
            }
            if (subcommand === 'lists') {
                await handleInfractionList(interaction);
                return;
            }
            if (subcommand === 'logging') {
                await handleLogging(interaction);
                return;
            }
            if (subcommand === 'promotions') {
                await handlePromotions(interaction);
                return;
            }
            await handleQuotaReminder(interaction);
        } catch (error) {
            console.error('[ISP SHIFT] Command failed:', error);
            await interaction
                .editReply({
                    content: 'Something went wrong while processing the ISP shift command.',
                    embeds: [],
                    components: [],
                })
                .catch(() => null);
        }
    },
};

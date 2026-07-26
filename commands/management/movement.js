const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
} = require('discord.js');

const {
    CHANNELS,
    RANK_CHOICES,
    TYPE_CHOICES,
    getMovementTypeByLabel,
    getMovements,
    saveMovement,
    createRecordId,
    buildConfirmationEmbed,
    buildLogEmbed,
    buildDmNotificationEmbed,
    applyAutoRank,
} = require('../../utils/movementUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('movement')
        .setDescription(
            'Log a staff movement for an Illinois State Roleplay staff member.'
        )

        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription(
                    'The staff member this movement applies to.'
                )
                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('type')
                .setDescription('The type of staff movement.')
                .addChoices(...TYPE_CHOICES)
                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('reason')
                .setDescription('The reason for this movement.')
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true)
        )

        .addStringOption((option) =>
            option
                .setName('old-rank')
                .setDescription(
                    'The current rank. Required for promotions and demotions.'
                )
                .addChoices(...RANK_CHOICES)
                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('new-rank')
                .setDescription(
                    'The new rank. Required for promotions and demotions.'
                )
                .addChoices(...RANK_CHOICES)
                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('duration')
                .setDescription(
                    'The suspension length, such as "3 days".'
                )
                .setMaxLength(100)
                .setRequired(false)
        )

        .addStringOption((option) =>
            option
                .setName('proof')
                .setDescription(
                    'A link to supporting evidence, if applicable.'
                )
                .setMaxLength(500)
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const staffMember =
                interaction.options.getUser(
                    'staff-member',
                    true
                );

            const typeLabel =
                interaction.options.getString(
                    'type',
                    true
                );

            const reason =
                interaction.options.getString(
                    'reason',
                    true
                );

            const oldRank =
                interaction.options.getString(
                    'old-rank'
                );

            const newRank =
                interaction.options.getString(
                    'new-rank'
                );

            const duration =
                interaction.options.getString(
                    'duration'
                );

            const proof =
                interaction.options.getString(
                    'proof'
                );

            const movementType =
                getMovementTypeByLabel(typeLabel);

            if (!movementType) {
                return interaction.reply({
                    content:
                        'That movement type is not recognized.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            /*
             * Check movement-specific required options.
             */

            const missingOptions = [];

            if (
                movementType.requires.includes(
                    'old-rank'
                ) &&
                !oldRank
            ) {
                missingOptions.push('`old-rank`');
            }

            if (
                movementType.requires.includes(
                    'new-rank'
                ) &&
                !newRank
            ) {
                missingOptions.push('`new-rank`');
            }

            if (
                movementType.requires.includes(
                    'duration'
                ) &&
                !duration
            ) {
                missingOptions.push('`duration`');
            }

            if (missingOptions.length > 0) {
                return interaction.reply({
                    content:
                        `The **${movementType.label}** movement requires: ` +
                        missingOptions.join(', ') +
                        '.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (
                oldRank &&
                newRank &&
                oldRank === newRank
            ) {
                return interaction.reply({
                    content:
                        'The old rank and new rank cannot be the same.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (
                staffMember.id ===
                interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        'You cannot file a staff movement against yourself.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            /*
             * Build confirmation message.
             */

            const confirmationEmbed =
                buildConfirmationEmbed({
                    movementType,
                    staffMember,
                    reason,
                    oldRank,
                    newRank,
                    duration,
                    proof,
                });

            const uniqueId =
                `${interaction.user.id}_${Date.now()}`;

            const confirmButtonId =
                `movement_confirm_${uniqueId}`;

            const cancelButtonId =
                `movement_cancel_${uniqueId}`;

            const confirmationRow =
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(confirmButtonId)
                        .setLabel('Confirm')
                        .setStyle(
                            ButtonStyle.Success
                        ),

                    new ButtonBuilder()
                        .setCustomId(cancelButtonId)
                        .setLabel('Cancel')
                        .setStyle(
                            ButtonStyle.Secondary
                        )
                );

            await interaction.reply({
                embeds: [confirmationEmbed],
                components: [confirmationRow],
                flags: MessageFlags.Ephemeral,
            });

            const confirmationMessage =
                await interaction.fetchReply();

            let buttonInteraction;

            try {
                buttonInteraction =
                    await confirmationMessage
                        .awaitMessageComponent({
                            filter: (component) =>
                                component.user.id ===
                                    interaction.user.id &&
                                [
                                    confirmButtonId,
                                    cancelButtonId,
                                ].includes(
                                    component.customId
                                ),
                            time: 60_000,
                        });
            } catch {
                return interaction.editReply({
                    content:
                        'Confirmation timed out. No movement was logged.',
                    embeds: [],
                    components: [],
                });
            }

            if (
                buttonInteraction.customId ===
                cancelButtonId
            ) {
                return buttonInteraction.update({
                    content:
                        'Movement cancelled. Nothing was logged.',
                    embeds: [],
                    components: [],
                });
            }

            await buttonInteraction.update({
                content: 'Logging movement…',
                embeds: [],
                components: [],
            });

            /*
             * Create and save the movement record.
             */

            const database =
                await getMovements(
                    interaction.guildId
                );

            const recordId =
                createRecordId();

            const record = {
                id: recordId,
                type: movementType.label,
                status: 'active',

                staffMemberId:
                    staffMember.id,

                issuedById:
                    interaction.user.id,

                reason,

                oldRank:
                    oldRank ?? null,

                newRank:
                    newRank ?? null,

                duration:
                    duration ?? null,

                proof:
                    proof ?? null,

                timestamp:
                    Date.now(),

                logChannelId: null,
                logMessageId: null,

                appeal: null,

                revokedById: null,
                revokeReason: null,
                revokedAt: null,
            };

            database.movements.push(record);

            await saveMovement(
                interaction.guildId,
                database
            );

            /*
             * Apply automatic role changes.
             */

            let rankUpdateNote = '';

            if (oldRank && newRank) {
                const rankResult =
                    await applyAutoRank(
                        interaction.guild,
                        staffMember,
                        oldRank,
                        newRank
                    );

                if (!rankResult.applied) {
                    rankUpdateNote =
                        '\n\n⚠️ The movement was logged, but the automatic role update failed: ' +
                        rankResult.error;
                }
            }

            /*
             * Build and send the public log.
             */

            const logEmbed =
                buildLogEmbed({
                    movementType,
                    staffMember,
                    issuedBy:
                        interaction.user,
                    reason,
                    oldRank,
                    newRank,
                    duration,
                    proof,
                    recordId,
                });

            const revokeRow =
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `movement_revoke_${recordId}`
                        )
                        .setLabel('Revoke')
                        .setStyle(
                            ButtonStyle.Danger
                        )
                );

            const destinationChannelId =
                movementType.destination ===
                'promotions'
                    ? CHANNELS.promotions
                    : CHANNELS.infractions;

            const logChannel =
                interaction.guild.channels.cache.get(
                    destinationChannelId
                );

            let logNote = '';

            if (
                logChannel &&
                logChannel.type ===
                    ChannelType.GuildText
            ) {
                try {
                    const logMessage =
                        await logChannel.send({
                            embeds: [logEmbed],
                            components: [
                                revokeRow,
                            ],
                        });

                    record.logChannelId =
                        logChannel.id;

                    record.logMessageId =
                        logMessage.id;

                    await saveMovement(
                        interaction.guildId,
                        database
                    );
                } catch (error) {
                    console.error(
                        'Failed to send movement log:',
                        error
                    );

                    logNote =
                        '\n\n⚠️ The movement was saved, but the log message could not be posted.';
                }
            } else {
                logNote =
                    '\n\n⚠️ The movement was saved, but its destination channel is missing or invalid.';
            }

            /*
             * Send the staff member a DM.
             */

            const dmEmbed =
                buildDmNotificationEmbed({
                    movementType,
                    reason,
                    oldRank,
                    newRank,
                    duration,
                    guildName:
                        interaction.guild.name,
                    recordId,
                });

            const dmComponents = [];

            if (movementType.appealable) {
                dmComponents.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `movement_appeal_${recordId}`
                            )
                            .setLabel(
                                'Submit Appeal'
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            )
                    )
                );
            }

            let dmNote = '';

            try {
                await staffMember.send({
                    embeds: [dmEmbed],
                    components:
                        dmComponents,
                });
            } catch {
                dmNote =
                    '\n\n⚠️ The staff member could not be notified by DM.';
            }

            return interaction.editReply({
                content:
                    `Successfully logged a **${movementType.label}** for ${staffMember}. ` +
                    `Case ID: \`${recordId}\`.` +
                    rankUpdateNote +
                    logNote +
                    dmNote,
                embeds: [],
                components: [],
            });
        } catch (error) {
            console.error(
                'Movement command error:',
                error
            );

            const errorMessage = {
                content:
                    'An error occurred while logging this movement. Please check the bot console.',
                embeds: [],
                components: [],
            };

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return interaction.editReply(
                    errorMessage
                );
            }

            return interaction.reply({
                ...errorMessage,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
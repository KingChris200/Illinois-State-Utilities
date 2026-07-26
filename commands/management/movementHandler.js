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
        .setDescription('Log a staff movement for an Illinois State Roleplay staff member.')
 
        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription('The staff member this movement applies to.')
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
                .setDescription('The staff member’s current rank. Required for promotions/demotions.')
                .addChoices(...RANK_CHOICES)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('new-rank')
                .setDescription('The staff member’s new rank. Required for promotions/demotions.')
                .addChoices(...RANK_CHOICES)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('duration')
                .setDescription('The length of the suspension (e.g. "3 days"). Required for suspensions.')
                .setMaxLength(100)
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('proof')
                .setDescription('A link to supporting evidence for this movement (optional).')
                .setMaxLength(500)
                .setRequired(false)
        ),
 
    async execute(interaction) {
        const staffMember = interaction.options.getUser('staff-member', true);
        const typeLabel = interaction.options.getString('type', true);
        const reason = interaction.options.getString('reason', true);
        const oldRank = interaction.options.getString('old-rank');
        const newRank = interaction.options.getString('new-rank');
        const duration = interaction.options.getString('duration');
        const proof = interaction.options.getString('proof');
 
        const movementType = getMovementTypeByLabel(typeLabel);
 
        if (!movementType) {
            return interaction.reply({
                content: 'That movement type is not recognized. Please pick one from the list.',
                flags: MessageFlags.Ephemeral,
            });
        }
 
        
        const missing = [];
        if (movementType.requires.includes('old-rank') && !oldRank) missing.push('`old-rank`');
        if (movementType.requires.includes('new-rank') && !newRank) missing.push('`new-rank`');
        if (movementType.requires.includes('duration') && !duration) missing.push('`duration`');
 
        if (missing.length > 0) {
            return interaction.reply({
                content: `The **${movementType.label}** movement type requires the following option(s): ${missing.join(', ')}.`,
                flags: MessageFlags.Ephemeral,
            });
        }
 
        if (oldRank && newRank && oldRank === newRank) {
            return interaction.reply({
                content: 'The old rank and new rank cannot be the same.',
                flags: MessageFlags.Ephemeral,
            });
        }
 
        if (staffMember.id === interaction.user.id) {
            return interaction.reply({
                content: 'You cannot file a staff movement against yourself.',
                flags: MessageFlags.Ephemeral,
            });
        }
 
        
        const confirmationEmbed = buildConfirmationEmbed({
            movementType, staffMember, reason, oldRank, newRank, duration, proof,
        });
 
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('movement_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('movement_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
        );
 
        const confirmationMessage = await interaction.reply({
            embeds: [confirmationEmbed],
            components: [confirmRow],
            flags: MessageFlags.Ephemeral,
            withResponse: true,
        });
 
        let buttonInteraction;
        try {
            buttonInteraction = await confirmationMessage.resource.message.awaitMessageComponent({
                filter: (component) => component.user.id === interaction.user.id,
                time: 60_000,
            });
        } catch {
            return interaction.editReply({
                content: 'Confirmation timed out — no movement was logged.',
                embeds: [],
                components: [],
            });
        }
 
        if (buttonInteraction.customId === 'movement_cancel') {
            return buttonInteraction.update({
                content: 'Movement cancelled — nothing was logged.',
                embeds: [],
                components: [],
            });
        }
 
        await buttonInteraction.update({
            content: 'Logging movement…',
            embeds: [],
            components: [],
        });
 
       
        const database = await getMovements(interaction.guildId);
        const recordId = createRecordId();
 
        const record = {
            id: recordId,
            type: movementType.label,
            status: 'active',
            staffMemberId: staffMember.id,
            issuedById: interaction.user.id,
            reason,
            oldRank: oldRank ?? null,
            newRank: newRank ?? null,
            duration: duration ?? null,
            proof: proof ?? null,
            timestamp: Date.now(),
            logChannelId: null,
            logMessageId: null,
            appeal: null,
            revokedById: null,
            revokeReason: null,
            revokedAt: null,
        };
 
        database.movements.push(record);
        await saveMovement(interaction.guildId, database);
 
       
        let rankUpdateNote = '';
        if (oldRank && newRank) {
            const rankResult = await applyAutoRank(interaction.guild, staffMember, oldRank, newRank);
            if (!rankResult.applied) {
                rankUpdateNote = `\n\n⚠️ Case logged, but the automatic role update failed: ${rankResult.error}`;
            }
        }

        const logEmbed = buildLogEmbed({
            movementType, staffMember, issuedBy: interaction.user, reason, oldRank, newRank, duration, proof, recordId,
        });
 
        const revokeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`movement_revoke_${recordId}`)
                .setLabel('Revoke')
                .setStyle(ButtonStyle.Danger),
        );
 
        const destinationChannelId = movementType.destination === 'promotions'
            ? CHANNELS.promotions
            : CHANNELS.infractions;
 
        const logChannel = interaction.guild.channels.cache.get(destinationChannelId);
 
        if (logChannel && logChannel.type === ChannelType.GuildText) {
            const logMessage = await logChannel.send({ embeds: [logEmbed], components: [revokeRow] });
            record.logChannelId = logChannel.id;
            record.logMessageId = logMessage.id;
            await saveMovement(interaction.guildId, database);
        }
 
      
        const dmEmbed = buildDmNotificationEmbed({
            movementType, reason, oldRank, newRank, duration, guildName: interaction.guild.name, recordId,
        });
 
        const dmComponents = [];
        if (movementType.appealable) {
            dmComponents.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`movement_appeal_${recordId}`)
                        .setLabel('Submit Appeal')
                        .setStyle(ButtonStyle.Primary),
                ),
            );
        }
 
        try {
            await staffMember.send({ embeds: [dmEmbed], components: dmComponents });
        } catch {
    
        }
 
        return interaction.editReply({
            content: `Successfully logged a **${movementType.label}** for ${staffMember} (Case ID: \`${recordId}\`).${rankUpdateNote}`,
        });
    },
};
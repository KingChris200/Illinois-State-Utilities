const {
    MessageFlags,
    SlashCommandBuilder,
} = require('discord.js');

const {
    ISRP_CHANNELS,
    MAIN_SERVER_ID,
} = require('../../config/serverConfigs');
const {
    createStaffFeedbackModal,
    getFeedbackCooldown,
    isEligibleStaffMember,
} = require('../../utils/staffFeedbackManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('feedback')
        .setDescription('Leave feedback for an Illinois State Roleplay staff member.')
        .setDMPermission(false)
        .addUserOption((option) =>
            option
                .setName('staff-member')
                .setDescription('The staff member who assisted you.')
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName('rating')
                .setDescription('Rate your experience from one to five stars.')
                .setRequired(true)
                .addChoices(
                    { name: '⭐ 1 Star', value: 1 },
                    { name: '⭐⭐ 2 Stars', value: 2 },
                    { name: '⭐⭐⭐ 3 Stars', value: 3 },
                    { name: '⭐⭐⭐⭐ 4 Stars', value: 4 },
                    { name: '⭐⭐⭐⭐⭐ 5 Stars', value: 5 }
                )
        ),

    async execute(interaction) {
        if (!interaction.inGuild() || interaction.guildId !== MAIN_SERVER_ID) {
            await interaction.reply({
                content: 'This command is only available in Illinois State Roleplay.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.channelId !== ISRP_CHANNELS.commands) {
            await interaction.reply({
                content: `Use \`/feedback\` in <#${ISRP_CHANNELS.commands}>.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const targetUser = interaction.options.getUser('staff-member', true);
        const rating = interaction.options.getInteger('rating', true);

        if (targetUser.id === interaction.user.id) {
            await interaction.reply({
                content: 'You cannot submit feedback about yourself.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const targetMember = await interaction.guild.members
            .fetch(targetUser.id)
            .catch(() => null);

        if (!isEligibleStaffMember(targetMember)) {
            await interaction.reply({
                content: 'Choose a current Illinois State Roleplay staff member.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const cooldownExpiresAt = await getFeedbackCooldown(
            interaction.guildId,
            interaction.user.id,
            targetUser.id
        );

        if (cooldownExpiresAt) {
            await interaction.reply({
                content: `You can leave feedback for this staff member again <t:${Math.ceil(cooldownExpiresAt / 1000)}:R>.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.showModal(
            createStaffFeedbackModal({
                reviewerId: interaction.user.id,
                targetId: targetUser.id,
                rating,
            })
        );
    },
};

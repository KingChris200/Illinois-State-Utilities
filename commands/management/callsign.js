const {
    MessageFlags,
    SlashCommandBuilder,
} = require('discord.js');

const callsignConfig = require('../../config/ispCallsigns');
const {
    isIspMember,
} = require('../../utils/ispShiftManager');
const {
    createCallsignPanelPayload,
} = require('../../utils/ispCallsignManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('callsign')
        .setDescription('Open the ISP callsign management panel.')
        .setDMPermission(false),

    async execute(interaction) {
        if (!interaction.inGuild() || interaction.guildId !== callsignConfig.guildId) {
            await interaction.reply({
                content: 'This command is only available in the Illinois State Police server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (interaction.channelId !== callsignConfig.commandChannelId) {
            await interaction.reply({
                content: `Use \`/callsign\` in <#${callsignConfig.commandChannelId}>.`,
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

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await interaction.editReply(
                await createCallsignPanelPayload(interaction)
            );
        } catch (error) {
            console.error('Error executing /callsign:', error);
            await interaction.editReply({
                content: 'The callsign panel could not be opened. Please try again.',
                embeds: [],
                components: [],
            });
        }
    },
};

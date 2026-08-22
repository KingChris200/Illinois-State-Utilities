const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');

const {
    executeSessionAnnouncement,
} = require('../../utils/sessionAnnouncementManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sessionlow')
        .setDescription('Ask members to join the current session.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    execute(interaction) {
        return executeSessionAnnouncement(interaction, 'low');
    },
};

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');

const {
    executeSessionAnnouncement,
} = require('../../utils/sessionAnnouncementManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sessionfull')
        .setDescription('Let members know the session has enough players.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    execute(interaction) {
        return executeSessionAnnouncement(interaction, 'full');
    },
};

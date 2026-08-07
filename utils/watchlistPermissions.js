const { PermissionFlagsBits } = require('discord.js');
const {
    memberCanReviewMovements,
} = require('../config/serverConfigs');

function canManageWatchlist(interaction) {
    const member = interaction.member;

    if (
        interaction.guild?.ownerId === interaction.user?.id ||
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        ) ||
        member?.permissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return true;
    }

    try {
        return memberCanReviewMovements(
            member,
            interaction.guildId
        );
    } catch {
        return false;
    }
}

module.exports = {
    canManageWatchlist,
};

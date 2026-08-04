const { PermissionFlagsBits } = require('discord.js');

function memberCanUseCommand(member, command, config) {
    if (command.staffOnly === false) {
        return true;
    }

    if (
        member?.permissions?.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    const allowedRoleIds =
        command.permissionLevel === 'senior'
            ? config.seniorRoleIds
            : config.allowedRoleIds;

    return allowedRoleIds.some((roleId) =>
        member?.roles?.cache?.has(roleId)
    );
}

module.exports = {
    memberCanUseCommand,
};

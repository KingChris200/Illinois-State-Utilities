const {
    PermissionFlagsBits,
} = require('discord.js');

const {
    getServerConfig,
    getGuildRanks,
    findGuildRank,
    getGuildRankIndex,
} = require('../config/serverConfigs');

/**
 * Fetch a GuildMember safely.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 * @returns {Promise<import('discord.js').GuildMember|null>}
 */
async function fetchGuildMember(guild, userId) {
    if (!guild || !userId) {
        return null;
    }

    try {
        return await guild.members.fetch(userId);
    } catch {
        return null;
    }
}

/**
 * Fetch a configured Discord role.
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @returns {Promise<import('discord.js').Role|null>}
 */
async function fetchGuildRole(guild, roleId) {
    if (!guild || !roleId) {
        return null;
    }

    const cachedRole =
        guild.roles.cache.get(roleId);

    if (cachedRole) {
        return cachedRole;
    }

    try {
        return await guild.roles.fetch(roleId);
    } catch {
        return null;
    }
}

/**
 * Convert an internal rank-manager failure into a clean message.
 *
 * @param {object} result
 * @returns {string}
 */
function getRankChangeErrorMessage(result) {
    const messages = {
        unsupported_guild:
            'Illinois State Utilities is not configured to manage ranks in this server.',

        invalid_member:
            'I could not find that staff member inside this server.',

        bot_member:
            'Discord bots cannot receive staff rank changes.',

        guild_owner:
            'The server owner cannot be automatically ranked by a bot.',

        bot_member_missing:
            'I could not access my own Discord member information.',

        missing_manage_roles:
            'I need the **Manage Roles** permission before I can automatically update staff ranks.',

        member_not_manageable:
            'I cannot manage that member. Their highest role may be above or equal to my highest role.',

        previous_rank_not_configured:
            'The previous rank is not configured for this server.',

        new_rank_not_configured:
            'The new rank is not configured for this server.',

        same_rank:
            'The previous rank and new rank cannot be the same.',

        invalid_promotion:
            'The selected new rank is not higher than the previous rank.',

        invalid_demotion:
            'The selected new rank is not lower than the previous rank.',

        previous_role_missing:
            'The configured Discord role for the previous rank could not be found.',

        new_role_missing:
            'The configured Discord role for the new rank could not be found.',

        previous_role_managed:
            'The previous rank is controlled by another integration and cannot be removed manually.',

        new_role_managed:
            'The new rank is controlled by another integration and cannot be assigned manually.',

        previous_role_too_high:
            'My highest Discord role must be positioned above the previous rank role.',

        new_role_too_high:
            'My highest Discord role must be positioned above the new rank role.',

        member_missing_previous_role:
            'That member does not currently have the selected previous-rank role.',

        member_already_has_new_role:
            'That member already has the selected new-rank role.',

        failed_to_add_new_role:
            'Discord prevented me from assigning the new rank role.',

        failed_to_remove_previous_role:
            'The new role was assigned, but Discord prevented me from removing the previous role.',

        rollback_failed:
            'The rank change partially failed and could not be fully reversed. Management should review the member’s roles immediately.',

        unknown_error:
            'An unexpected error occurred while changing the member’s rank.',
    };

    return (
        messages[result?.reason] ||
        messages.unknown_error
    );
}

/**
 * Detect the member's highest configured rank from their live Discord roles.
 * The saved staff profile is intentionally not used because it may be missing
 * or older than the member's actual role assignment.
 *
 * @param {string} guildId
 * @param {import('discord.js').GuildMember} member
 * @returns {{name: string, roleId: string, index: number}|null}
 */
function detectMemberRank(guildId, member) {
    const roleCache = member?.roles?.cache;

    if (!roleCache || typeof roleCache.has !== 'function') {
        return null;
    }

    const ranks = getGuildRanks(guildId);

    for (let index = ranks.length - 1; index >= 0; index -= 1) {
        const rank = ranks[index];

        if (roleCache.has(rank.roleId)) {
            return {
                ...rank,
                index,
            };
        }
    }

    return null;
}

/**
 * Automatically replace one configured rank role with another.
 *
 * Rank arrays must be ordered from lowest to highest.
 *
 * @param {object} options
 * @param {import('discord.js').Guild} options.guild
 * @param {import('discord.js').GuildMember|string} options.member
 * @param {string|null} [options.previousRank]
 * @param {string} options.newRank
 * @param {'promotion'|'demotion'|'movement'} [options.actionType]
 * @param {string} [options.reason]
 *
 * @returns {Promise<object>}
 */
async function applyRankChange({
    guild,
    member,
    previousRank,
    newRank,
    actionType = 'movement',
    reason = 'Staff rank change',
}) {
    try {
        if (!guild) {
            return {
                success: false,
                reason: 'unsupported_guild',
            };
        }

        const serverConfig =
            getServerConfig(guild.id);

        if (!serverConfig) {
            return {
                success: false,
                reason: 'unsupported_guild',
            };
        }

        const guildMember =
            typeof member === 'string'
                ? await fetchGuildMember(
                      guild,
                      member
                  )
                : member;

        if (!guildMember) {
            return {
                success: false,
                reason: 'invalid_member',
            };
        }

        if (guildMember.user?.bot) {
            return {
                success: false,
                reason: 'bot_member',
            };
        }

        if (
            guildMember.id ===
            guild.ownerId
        ) {
            return {
                success: false,
                reason: 'guild_owner',
            };
        }

        const botMember =
            guild.members.me ||
            (await fetchGuildMember(
                guild,
                guild.client.user.id
            ));

        if (!botMember) {
            return {
                success: false,
                reason: 'bot_member_missing',
            };
        }

        if (
            !botMember.permissions.has(
                PermissionFlagsBits.ManageRoles
            )
        ) {
            return {
                success: false,
                reason: 'missing_manage_roles',
            };
        }

        if (!guildMember.manageable) {
            return {
                success: false,
                reason: 'member_not_manageable',
            };
        }

        const isInitialAssignment =
            actionType === 'promotion' &&
            !String(previousRank || '').trim();
        const previousRankConfig =
            isInitialAssignment
                ? null
                : findGuildRank(
                      guild.id,
                      previousRank
                  );

        if (!isInitialAssignment && !previousRankConfig) {
            return {
                success: false,
                reason:
                    'previous_rank_not_configured',
            };
        }

        const newRankConfig =
            findGuildRank(
                guild.id,
                newRank
            );

        if (!newRankConfig) {
            return {
                success: false,
                reason:
                    'new_rank_not_configured',
            };
        }

        if (
            previousRankConfig &&
            previousRankConfig.name ===
            newRankConfig.name
        ) {
            return {
                success: false,
                reason: 'same_rank',
            };
        }

        const previousRankIndex = previousRankConfig
            ? getGuildRankIndex(
                  guild.id,
                  previousRankConfig.name
              )
            : -1;

        const newRankIndex =
            getGuildRankIndex(
                guild.id,
                newRankConfig.name
            );

        if (
            actionType === 'promotion' &&
            newRankIndex <= previousRankIndex
        ) {
            return {
                success: false,
                reason: 'invalid_promotion',
            };
        }

        if (
            actionType === 'demotion' &&
            newRankIndex >= previousRankIndex
        ) {
            return {
                success: false,
                reason: 'invalid_demotion',
            };
        }

        const previousRole = previousRankConfig
            ? await fetchGuildRole(
                  guild,
                  previousRankConfig.roleId
              )
            : null;

        if (previousRankConfig && !previousRole) {
            return {
                success: false,
                reason:
                    'previous_role_missing',
                roleId:
                    previousRankConfig.roleId,
            };
        }

        const newRole =
            await fetchGuildRole(
                guild,
                newRankConfig.roleId
            );

        if (!newRole) {
            return {
                success: false,
                reason: 'new_role_missing',
                roleId:
                    newRankConfig.roleId,
            };
        }

        if (previousRole?.managed) {
            return {
                success: false,
                reason:
                    'previous_role_managed',
            };
        }

        if (newRole.managed) {
            return {
                success: false,
                reason: 'new_role_managed',
            };
        }

        if (
            previousRole &&
            botMember.roles.highest.position <=
            previousRole.position
        ) {
            return {
                success: false,
                reason:
                    'previous_role_too_high',
                role: previousRole,
            };
        }

        if (
            botMember.roles.highest.position <=
            newRole.position
        ) {
            return {
                success: false,
                reason: 'new_role_too_high',
                role: newRole,
            };
        }

        if (
            previousRole &&
            !guildMember.roles.cache.has(
                previousRole.id
            )
        ) {
            return {
                success: false,
                reason:
                    'member_missing_previous_role',
                previousRole,
            };
        }

        if (
            guildMember.roles.cache.has(
                newRole.id
            )
        ) {
            return {
                success: false,
                reason:
                    'member_already_has_new_role',
                newRole,
            };
        }

        /*
         * Add the new role first.
         *
         * This prevents the member from temporarily having no staff
         * rank if Discord accepts the addition but is slow afterward.
         */
        try {
            await guildMember.roles.add(
                newRole,
                `${actionType}: ${reason}`
            );
        } catch (error) {
            console.error(
                'Failed to assign new rank role:',
                error
            );

            return {
                success: false,
                reason:
                    'failed_to_add_new_role',
                error,
                previousRole,
                newRole,
            };
        }

        /*
         * Remove the previous role after the new role is assigned.
         */
        try {
            if (previousRole) {
                await guildMember.roles.remove(
                    previousRole,
                    `${actionType}: ${reason}`
                );
            }
        } catch (error) {
            console.error(
                'Failed to remove previous rank role:',
                error
            );

            /*
             * Roll back the newly added role so the member is not
             * accidentally left holding two rank roles.
             */
            try {
                await guildMember.roles.remove(
                    newRole,
                    'Automatic rollback after failed rank change'
                );
            } catch (rollbackError) {
                console.error(
                    'Rank-change rollback failed:',
                    rollbackError
                );

                return {
                    success: false,
                    reason: 'rollback_failed',
                    error,
                    rollbackError,
                    previousRole,
                    newRole,
                };
            }

            return {
                success: false,
                reason:
                    'failed_to_remove_previous_role',
                error,
                previousRole,
                newRole,
            };
        }

        return {
            success: true,

            guildId: guild.id,
            serverKey: serverConfig.key,

            member: guildMember,

            actionType,

            previousRank:
                previousRankConfig?.name || null,

            newRank:
                newRankConfig.name,

            removedRole: previousRole,
            addedRole: newRole,

            initialAssignment:
                isInitialAssignment,

            previousRankIndex,
            newRankIndex,
        };
    } catch (error) {
        console.error(
            'Unexpected rank manager error:',
            error
        );

        return {
            success: false,
            reason: 'unknown_error',
            error,
        };
    }
}

/**
 * Reverse a previously completed rank change.
 *
 * Example:
 *
 * Promotion:
 * Manager → Senior Manager
 *
 * Reversal:
 * Senior Manager → Manager
 *
 * @param {object} options
 * @returns {Promise<object>}
 */
async function reverseRankChange({
    guild,
    member,
    previousRank,
    newRank,
    reason = 'Movement revoked',
}) {
    return applyRankChange({
        guild,
        member,

        previousRank: newRank,
        newRank: previousRank,

        actionType: 'movement',
        reason,
    });
}

module.exports = {
    applyRankChange,
    detectMemberRank,
    reverseRankChange,
    getRankChangeErrorMessage,
};

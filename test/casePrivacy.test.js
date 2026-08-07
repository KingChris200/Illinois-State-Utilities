const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const caseCommand = require('../commands/cases/case');
const {
    canManageCases,
    validateCaseAccess,
} = require('../commands/cases/casecomponents');
const {
    MAIN_SERVER_ID,
    SERVER_CONFIGS,
} = require('../config/serverConfigs');

function createInteraction({ permissions = [], roleIds = [], owner = false } = {}) {
    const replies = [];
    const deferred = [];
    const edits = [];
    const userId = 'case-reviewer';

    return {
        interaction: {
            guildId: MAIN_SERVER_ID,
            guild: {
                ownerId: owner ? userId : 'different-owner',
            },
            user: { id: userId },
            memberPermissions: {
                has: (permission) => permissions.includes(permission),
            },
            member: {
                roles: {
                    cache: {
                        some: (callback) =>
                            roleIds.some((id) => callback({ id })),
                    },
                },
            },
            inGuild: () => true,
            reply: async (payload) => replies.push(payload),
            deferReply: async (payload) => deferred.push(payload),
            editReply: async (payload) => edits.push(payload),
            deferred: false,
            replied: false,
        },
        replies,
        deferred,
        edits,
    };
}

test('/case never offers a public visibility option', () => {
    const command = caseCommand.data.toJSON();

    for (const subcommand of command.options) {
        assert.equal(
            (subcommand.options || []).some(
                (option) => option.name === 'visibility'
            ),
            false,
            `/case ${subcommand.name} exposes case visibility.`
        );
    }
});

test('Manage Messages alone cannot access private case records', () => {
    const { interaction } = createInteraction({
        permissions: [PermissionFlagsBits.ManageMessages],
    });

    assert.equal(canManageCases(interaction), false);
});

test('configured reviewers, administrators, and the owner can manage cases', () => {
    const reviewerRoleId = SERVER_CONFIGS[MAIN_SERVER_ID].reviewerRoleIds[0];

    assert.equal(
        canManageCases(createInteraction({ roleIds: [reviewerRoleId] }).interaction),
        true
    );
    assert.equal(
        canManageCases(
            createInteraction({
                permissions: [PermissionFlagsBits.Administrator],
            }).interaction
        ),
        true
    );
    assert.equal(canManageCases(createInteraction({ owner: true }).interaction), true);
});

test('case responses are always deferred privately', async () => {
    const { interaction, deferred } = createInteraction({
        permissions: [PermissionFlagsBits.ManageGuild],
    });

    await validateCaseAccess(interaction);

    assert.equal(deferred.length, 1);
    assert.equal(deferred[0].flags, MessageFlags.Ephemeral);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');

const {
    memberCanUseCommand,
} = require('../utils/prefixCommandPermissions');

function createMember(roleIds = [], administrator = false) {
    return {
        permissions: {
            has: (permission) =>
                permission === PermissionFlagsBits.Administrator &&
                administrator,
        },
        roles: {
            cache: {
                has: (roleId) => roleIds.includes(roleId),
            },
        },
    };
}

const config = {
    allowedRoleIds: ['staff'],
    seniorRoleIds: ['senior'],
};

test('regular staff commands accept configured staff roles', () => {
    assert.equal(
        memberCanUseCommand(
            createMember(['staff']),
            {},
            config
        ),
        true
    );
});

test('senior commands reject regular staff roles', () => {
    assert.equal(
        memberCanUseCommand(
            createMember(['staff']),
            { permissionLevel: 'senior' },
            config
        ),
        false
    );
});

test('senior commands accept senior roles and administrators', () => {
    assert.equal(
        memberCanUseCommand(
            createMember(['senior']),
            { permissionLevel: 'senior' },
            config
        ),
        true
    );
    assert.equal(
        memberCanUseCommand(
            createMember([], true),
            { permissionLevel: 'senior' },
            config
        ),
        true
    );
});

test('public commands remain available without roles', () => {
    assert.equal(
        memberCanUseCommand(
            createMember(),
            { staffOnly: false },
            config
        ),
        true
    );
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    PermissionFlagsBits,
} = require('discord.js');

test('all server workflows are hidden from Discord direct messages', () => {
    const commands = loadCommandData();

    for (const command of commands) {
        if (command.name === 'about') {
            continue;
        }

        assert.equal(
            command.dm_permission,
            false,
            `/${command.name} must be server-only`
        );
    }
});

test('setup and config require Manage Server by default', () => {
    const commands = loadCommandData();
    const expectedPermission =
        PermissionFlagsBits.ManageGuild.toString();

    for (const commandName of ['setup', 'config']) {
        const command = commands.find(
            (candidate) =>
                candidate.name === commandName
        );

        assert.equal(
            command.default_member_permissions,
            expectedPermission
        );
    }
});

function loadCommandData() {
    const commandsDirectory = path.join(
        __dirname,
        '..',
        'commands'
    );
    const commands = [];

    for (const directory of fs.readdirSync(commandsDirectory)) {
        const directoryPath = path.join(
            commandsDirectory,
            directory
        );

        if (!fs.statSync(directoryPath).isDirectory()) {
            continue;
        }

        for (const file of fs.readdirSync(directoryPath)) {
            if (!file.endsWith('.js')) {
                continue;
            }

            const command = require(
                path.join(directoryPath, file)
            );

            if (command.data?.toJSON) {
                commands.push(command.data.toJSON());
            }
        }
    }

    return commands;
}

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    isInternalCommandModule,
    normalizeCommandModulePath,
} = require('../config/internalCommandModules');

const commandsDirectory = path.join(__dirname, '..', 'commands');

function discoverCommandModules() {
    return fs
        .readdirSync(commandsDirectory, {
            withFileTypes: true,
        })
        .filter((entry) => entry.isDirectory())
        .flatMap((folder) =>
            fs
                .readdirSync(path.join(commandsDirectory, folder.name))
                .filter((file) => file.endsWith('.js'))
                .map((file) => `${folder.name}/${file}`)
        );
}

test('internal command paths are normalized consistently', () => {
    assert.equal(
        normalizeCommandModulePath('cases\\casecomponents.js'),
        'cases/casecomponents.js'
    );
    assert.equal(
        isInternalCommandModule('cases\\casecomponents.js'),
        true
    );
    assert.equal(
        isInternalCommandModule('cases/casecomponents.js'),
        true
    );
});

test('every deployable command has valid command data and an executor', () => {
    const commandNames = new Set();

    for (const relativePath of discoverCommandModules()) {
        if (isInternalCommandModule(relativePath)) {
            continue;
        }

        const command = require(path.join(commandsDirectory, relativePath));

        assert.equal(
            typeof command.data?.toJSON,
            'function',
            `${relativePath} is missing slash-command data.`
        );
        assert.equal(
            typeof command.execute,
            'function',
            `${relativePath} is missing an execute function.`
        );

        const commandName = command.data.toJSON().name;
        assert.ok(commandName, `${relativePath} has no command name.`);
        assert.equal(
            commandNames.has(commandName),
            false,
            `Duplicate slash-command name: /${commandName}`
        );
        commandNames.add(commandName);
    }

    assert.ok(commandNames.size > 0);
});

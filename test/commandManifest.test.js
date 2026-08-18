const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isInternalCommandModule,
    normalizeCommandModulePath,
} = require('../config/internalCommandModules');
const {
    discoverCommandFiles,
    isValidCommandModule,
    loadCommandModule,
} = require('../utils/commandDiscovery');

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
    const discovery = discoverCommandFiles();

    assert.equal(discovery.exists, true);
    assert.ok(discovery.internalFiles.length > 0);

    for (const record of discovery.commandFiles) {
        const command = loadCommandModule(
            record.filePath,
            { clearCache: false }
        );

        assert.equal(
            isValidCommandModule(command),
            true,
            `${record.relativeFilePath} is not a valid slash command.`
        );

        const commandName = command.data.toJSON().name;
        assert.ok(
            commandName,
            `${record.relativeFilePath} has no command name.`
        );
        assert.equal(
            commandNames.has(commandName),
            false,
            `Duplicate slash-command name: /${commandName}`
        );
        commandNames.add(commandName);
    }

    assert.ok(commandNames.size > 0);
});

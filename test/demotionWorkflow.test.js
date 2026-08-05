const test = require('node:test');
const assert = require('node:assert/strict');

const demoteCommand = require('../commands/management/demote');
const {
    MAIN_SERVER_ID,
    getGuildRankIndex,
} = require('../config/serverConfigs');

test('demote uses live rank autocomplete and safe options', () => {
    const command = demoteCommand.data.toJSON();
    const optionNames = command.options.map(
        (option) => option.name
    );
    const previousRank = command.options.find(
        (option) => option.name === 'previous-rank'
    );
    const newRank = command.options.find(
        (option) => option.name === 'new-rank'
    );

    assert.deepEqual(optionNames, [
        'staff-member',
        'previous-rank',
        'new-rank',
        'reason',
        'evidence',
        'notes',
    ]);
    assert.equal(previousRank.autocomplete, true);
    assert.equal(newRank.autocomplete, true);
    assert.equal(optionNames.includes('channel'), false);
    assert.equal(optionNames.includes('ping'), false);
});

test('new-rank autocomplete only suggests lower ranks', async () => {
    let choices = null;
    const previousRank = 'Senior Manager';
    const previousIndex = getGuildRankIndex(
        MAIN_SERVER_ID,
        previousRank
    );

    await demoteCommand.autocomplete({
        inGuild: () => true,
        guildId: MAIN_SERVER_ID,
        options: {
            getFocused: () => ({
                name: 'new-rank',
                value: '',
            }),
            getString: () => previousRank,
        },
        respond: async (response) => {
            choices = response;
        },
    });

    assert.ok(choices.length > 0);
    assert.ok(
        choices.every(
            (choice) =>
                getGuildRankIndex(
                    MAIN_SERVER_ID,
                    choice.value
                ) < previousIndex
        )
    );
});

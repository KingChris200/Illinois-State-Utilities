const test = require('node:test');
const assert = require('node:assert/strict');

const interactionEvent = require('../events/interactionCreate');
const infractionCommand = require('../commands/management/infraction');
const {
    MAIN_SERVER_ID,
} = require('../config/serverConfigs');

test('central interaction handler routes autocomplete events', async () => {
    let routed = false;

    await interactionEvent.execute({
        isAutocomplete: () => true,
        commandName: 'example',
        client: {
            commands: new Map([
                [
                    'example',
                    {
                        autocomplete: async () => {
                            routed = true;
                        },
                    },
                ],
            ]),
        },
    });

    assert.equal(routed, true);
});

test('infraction rank option uses live autocomplete', async () => {
    const command = infractionCommand.data.toJSON();
    const rankOption = command.options.find(
        (option) => option.name === 'current-rank'
    );

    assert.equal(rankOption.autocomplete, true);

    let choices = null;

    await infractionCommand.autocomplete({
        inGuild: () => true,
        guildId: MAIN_SERVER_ID,
        options: {
            getFocused: () => ({
                name: 'current-rank',
                value: 'trial',
            }),
        },
        respond: async (response) => {
            choices = response;
        },
    });

    assert.ok(choices.length > 0);
    assert.equal(choices[0].value, 'Trial Moderator');
});

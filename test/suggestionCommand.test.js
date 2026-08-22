const test = require('node:test');
const assert = require('node:assert/strict');

const suggestionCommand = require('../commands/requests/suggest');

test('/suggest stays minimal and requires one idea', () => {
    const data = suggestionCommand.data.toJSON();

    assert.equal(data.name, 'suggest');
    assert.equal(data.options.length, 1);
    assert.equal(data.options[0].name, 'idea');
    assert.equal(data.options[0].required, true);
});

test('suggestions channel is optional', () => {
    const previousValue = process.env.SUGGESTIONS_CHANNEL_ID;
    delete process.env.SUGGESTIONS_CHANNEL_ID;

    assert.equal(suggestionCommand.getSuggestionChannelId(), '');

    if (previousValue === undefined) {
        delete process.env.SUGGESTIONS_CHANNEL_ID;
    } else {
        process.env.SUGGESTIONS_CHANNEL_ID = previousValue;
    }
});

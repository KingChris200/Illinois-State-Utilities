const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');

const {
    appendResponseStatus,
    createReasonModal,
    createWatchlistAlertComponents,
    disableAlertAction,
    handleWatchlistAlertButton,
    handleWatchlistAlertModal,
} = require('../utils/watchlistAlertInteractionManager');
const createEmbed = require('../utils/createEmbed');

test('automatic watchlist alerts expose six protected controls', () => {
    const rows = createWatchlistAlertComponents(
        'watch-example'
    ).map((row) => row.toJSON());
    const buttons = rows.flatMap((row) => row.components);

    assert.equal(rows.length, 2);
    assert.deepEqual(
        buttons.map((button) => button.label),
        [
            'Acknowledge',
            'Full Record',
            'Live Profile',
            'False Match',
            'Resolve Entry',
            'Refresh',
        ]
    );
    assert.equal(
        buttons.every((button) =>
            button.custom_id.startsWith('watchlist_alert:')
        ),
        true
    );
});

test('watchlist alert controls can disable one action or the complete panel', () => {
    const components = createWatchlistAlertComponents(
        'watch-example'
    );
    const message = { components };
    const acknowledged = disableAlertAction(
        message,
        'acknowledge'
    ).flatMap((row) => row.toJSON().components);
    const closed = disableAlertAction(
        message,
        null,
        true
    ).flatMap((row) => row.toJSON().components);

    assert.equal(acknowledged[0].disabled, true);
    assert.equal(
        acknowledged.slice(1).every((button) => !button.disabled),
        true
    );
    assert.equal(
        closed.every((button) => button.disabled),
        true
    );
});

test('alert response status is added without replacing original context', () => {
    const original = createEmbed(
        'Private Watchlist Alert',
        'isrp'
    ).addFields({
        name: 'Original Context',
        value: 'Preserved',
    });
    const updated = appendResponseStatus(
        original,
        'Acknowledged by management'
    ).toJSON();

    assert.equal(updated.fields[0].name, 'Original Context');
    assert.match(
        updated.fields.find(
            (field) => field.name === 'Alert Response'
        ).value,
        /Acknowledged/
    );
});

test('false-match and resolution controls require written reasons', () => {
    for (const action of ['false_match', 'resolve']) {
        const modal = createReasonModal(
            action,
            'watch-example',
            'Review Entry',
            'Provide a reason'
        ).toJSON();
        const input = modal.components[0].components[0];

        assert.match(modal.custom_id, new RegExp(action));
        assert.equal(input.required, true);
        assert.equal(input.min_length, 3);
    }
});

test('unauthorized members cannot use alert buttons or forms', async () => {
    const replies = [];
    const interaction = restrictedInteraction((payload) => {
        replies.push(payload);
    });

    await handleWatchlistAlertButton({
        ...interaction,
        customId:
            'watchlist_alert:view:watch-example',
    });
    await handleWatchlistAlertModal({
        ...interaction,
        customId:
            'watchlist_alert_modal:resolve:watch-example',
    });

    assert.equal(replies.length, 2);
    assert.equal(
        replies.every(
            (payload) =>
                payload.flags === MessageFlags.Ephemeral
        ),
        true
    );
    assert.equal(
        replies.every((payload) =>
            /restricted/i.test(payload.content)
        ),
        true
    );
});

function restrictedInteraction(reply) {
    return {
        guildId: 'unsupported-guild',
        guild: { ownerId: 'owner-id' },
        user: { id: 'member-id' },
        member: {
            permissions: { has: () => false },
            roles: {
                cache: { some: () => false },
            },
        },
        reply,
    };
}

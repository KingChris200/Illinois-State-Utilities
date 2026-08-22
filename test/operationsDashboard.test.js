const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');

const {
    DASHBOARD_TTL_MS,
    buildOperationsView,
    createOperationsButtons,
    createOperationsDashboard,
    handleOperationsButton,
    removeOperationsDashboard,
} = require('../utils/operationsDashboardManager');

const config = {
    mockMode: true,
    dryRun: true,
};
const client = {
    user: { tag: 'Illinois State Utilities#0001' },
    ws: { ping: 42 },
};

test('operations dashboard opens on a complete overview', async () => {
    await withMockMode(async () => {
        const dashboard = await createOperationsDashboard({
            executorId: 'staff-id',
            executorMention: '<@staff-id>',
            client,
            config,
        });
        const embed = dashboard.embed.toJSON();
        const row = dashboard.components.toJSON();

        assert.equal(
            embed.title,
            'ER:LC Server Status'
        );
        assert.equal(row.components.length, 5);
        assert.equal(
            row.components.find((button) =>
                button.custom_id.includes(':overview:')
            ).disabled,
            true
        );
        assert.ok(DASHBOARD_TTL_MS >= 60_000);

        removeOperationsDashboard(dashboard.id);
    });
});

test('operations controls reject everyone except the requester', async () => {
    await withMockMode(async () => {
        const dashboard = await createOperationsDashboard({
            executorId: 'staff-id',
            executorMention: '<@staff-id>',
            client,
            config,
        });
        const callsButton = findButton(
            dashboard.components,
            ':calls:'
        );
        let reply;

        await handleOperationsButton({
            customId: callsButton.custom_id,
            user: { id: 'different-user' },
            reply: async (payload) => {
                reply = payload;
            },
        });

        assert.equal(
            reply.flags,
            MessageFlags.Ephemeral
        );
        assert.match(reply.content, /Only the staff member/);
        removeOperationsDashboard(dashboard.id);
    });
});

test('operations controls switch views and refresh safely', async () => {
    await withMockMode(async () => {
        const dashboard = await createOperationsDashboard({
            executorId: 'staff-id',
            executorMention: '<@staff-id>',
            client,
            config,
        });
        const callsButton = findButton(
            dashboard.components,
            ':calls:'
        );
        let deferred = false;
        let edited;

        await handleOperationsButton({
            customId: callsButton.custom_id,
            user: { id: 'staff-id' },
            deferUpdate: async () => {
                deferred = true;
            },
            editReply: async (payload) => {
                edited = payload;
            },
        });

        assert.equal(deferred, true);
        assert.equal(
            edited.embeds[0].toJSON().title,
            'Moderator Calls'
        );
        assert.equal(edited.components.length, 1);

        const refreshButton = findButton(
            edited.components[0],
            ':refresh:'
        );
        await handleOperationsButton({
            customId: refreshButton.custom_id,
            user: { id: 'staff-id' },
            deferUpdate: async () => null,
            editReply: async (payload) => {
                edited = payload;
            },
        });
        assert.equal(
            edited.embeds[0].toJSON().title,
            'Moderator Calls'
        );

        removeOperationsDashboard(dashboard.id);
    });
});

test('expired operations controls can all be disabled', () => {
    const row = createOperationsButtons(
        '00000000-0000-0000-0000-000000000000',
        'activity',
        true
    ).toJSON();

    assert.equal(
        row.components.every((button) => button.disabled),
        true
    );
});

test('activity and health dashboard views render in mock mode', async () => {
    await withMockMode(async () => {
        const dashboard = {
            executorMention: '<@staff-id>',
            expiresAt: Date.now() + DASHBOARD_TTL_MS,
            client,
            config,
        };
        const activity = await buildOperationsView(
            dashboard,
            'activity'
        );
        const health = await buildOperationsView(
            dashboard,
            'health'
        );

        assert.match(activity.toJSON().title, /Activity/);
        assert.equal(health.toJSON().title, 'Bot Status');
        assert.match(health.toJSON().description, /working/);
    });
});

function findButton(row, pattern) {
    return row
        .toJSON()
        .components.find((button) =>
            button.custom_id.includes(pattern)
        );
}

async function withMockMode(callback) {
    const previousMockMode = process.env.ERLC_MOCK_MODE;
    process.env.ERLC_MOCK_MODE = 'true';

    try {
        await callback();
    } finally {
        if (previousMockMode === undefined) {
            delete process.env.ERLC_MOCK_MODE;
        } else {
            process.env.ERLC_MOCK_MODE = previousMockMode;
        }
    }
}

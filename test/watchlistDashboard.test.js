const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');

const {
    buildWatchlistDashboardView,
    createWatchlistDashboard,
    createWatchlistDashboardButtons,
    handleWatchlistDashboardButton,
    removeWatchlistDashboard,
    summarizeWatchlistRecords,
} = require('../utils/watchlistDashboardManager');

function records(now = Date.now()) {
    const recent = new Date(now - 60_000).toISOString();
    const old = new Date(
        now - 45 * 24 * 60 * 60 * 1000
    ).toISOString();

    return [
        {
            id: 'watch-critical',
            robloxUserId: '111111111',
            robloxUsername: 'CriticalPlayer',
            severity: 'critical',
            status: 'active',
            reason: 'Critical management review context.',
            evidence: null,
            createdAt: old,
            updatedAt: old,
            lastAcknowledgedAt: null,
            auditLog: [
                {
                    action: 'entry_created',
                    actorId: '123456789012345678',
                    createdAt: old,
                },
            ],
        },
        {
            id: 'watch-medium',
            robloxUserId: '222222222',
            robloxUsername: 'MediumPlayer',
            severity: 'medium',
            status: 'active',
            reason: 'Routine monitoring context.',
            evidence: 'case-22',
            createdAt: recent,
            updatedAt: recent,
            lastAcknowledgedAt: recent,
            auditLog: [
                {
                    action: 'alert_acknowledged',
                    actorId: '123456789012345678',
                    createdAt: recent,
                },
                {
                    action: 'match_dismissed',
                    actorId: '123456789012345678',
                    createdAt: recent,
                },
            ],
        },
        {
            id: 'watch-resolved',
            robloxUserId: '333333333',
            robloxUsername: 'ResolvedPlayer',
            severity: 'high',
            status: 'resolved',
            reason: 'Resolved context.',
            evidence: 'case-33',
            createdAt: old,
            updatedAt: recent,
            auditLog: [
                {
                    action: 'entry_resolved',
                    actorId: '123456789012345678',
                    createdAt: recent,
                },
            ],
        },
        {
            id: 'watch-removed',
            robloxUserId: '444444444',
            robloxUsername: 'ArchivedPlayer',
            severity: 'low',
            status: 'removed',
            reason: 'Archived context.',
            createdAt: old,
            updatedAt: recent,
            auditLog: [],
        },
    ];
}

test('watchlist command center summarizes status, response, and review coverage', () => {
    const summary = summarizeWatchlistRecords(
        records(),
        Date.now()
    );

    assert.equal(summary.records.length, 4);
    assert.equal(summary.active.length, 2);
    assert.equal(summary.resolved.length, 1);
    assert.equal(summary.removed.length, 1);
    assert.equal(summary.severityCounts.critical, 1);
    assert.equal(summary.unacknowledged.length, 1);
    assert.equal(summary.missingEvidence.length, 1);
    assert.equal(summary.stale.length, 1);
    assert.equal(summary.falseMatchReviews, 1);
});

test('every watchlist dashboard view renders private management intelligence', async () => {
    const dashboard = {
        guildId: 'guild-1',
        executorMention: '<@manager-id>',
        expiresAt: Date.now() + 180_000,
        providedRecords: records(),
    };

    for (const [view, title] of [
        ['overview', 'Command Center'],
        ['active', 'Active Watchlist'],
        ['activity', 'Recent Watchlist Activity'],
        ['review', 'Review Queue'],
    ]) {
        const embed = (
            await buildWatchlistDashboardView(
                dashboard,
                view
            )
        ).toJSON();

        assert.match(embed.title, new RegExp(title));
        assert.match(
            embed.fields.at(-1).name,
            /Dashboard Session/
        );
    }
});

test('watchlist dashboard opens with five protected controls', async () => {
    const dashboard = await createWatchlistDashboard({
        guildId: 'guild-1',
        executorId: 'manager-id',
        executorMention: '<@manager-id>',
        records: records(),
    });
    const buttons = dashboard.components.toJSON().components;

    assert.equal(buttons.length, 5);
    assert.equal(buttons[0].disabled, true);
    assert.match(
        buttons[4].custom_id,
        /watchlist_dashboard:refresh/
    );
    removeWatchlistDashboard(dashboard.id);
});

test('only the dashboard creator can use its controls', async () => {
    const dashboard = await createWatchlistDashboard({
        guildId: 'guild-1',
        executorId: 'manager-id',
        executorMention: '<@manager-id>',
        records: records(),
    });
    const button = createWatchlistDashboardButtons(
        dashboard.id,
        'overview'
    )
        .toJSON()
        .components.find((component) =>
            component.custom_id.includes(':active:')
        );
    let reply;

    await handleWatchlistDashboardButton({
        customId: button.custom_id,
        user: { id: 'different-manager' },
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /Only the authorized manager/);
    removeWatchlistDashboard(dashboard.id);
});

test('expired watchlist dashboard controls return a private response', async () => {
    let reply;

    await handleWatchlistDashboardButton({
        customId:
            'watchlist_dashboard:overview:00000000-0000-0000-0000-000000000000',
        user: { id: 'manager-id' },
        reply: async (payload) => {
            reply = payload;
        },
    });

    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.match(reply.content, /expired/i);
});

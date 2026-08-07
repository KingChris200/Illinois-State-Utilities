const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');

const watchlistCommand = require(
    '../commands/management/watchlist'
);
const robloxService = require('../services/robloxService');
const {
    WatchlistError,
    addWatchlistEntry,
    findWatchlistEntries,
    getActiveWatchlistEntries,
    getWatchlistEntry,
    normalizeDatabase,
    removeWatchlistEntry,
    resolveWatchlistEntry,
    searchWatchlistEntries,
    updateWatchlistEntry,
} = require('../utils/watchlistManager');
const {
    matchWatchlistPlayers,
} = require('../utils/watchlistMatcher');

function createMemoryStore(initialValue = null) {
    let database = initialValue;

    return {
        readDatabase: async (_name, fallback) =>
            structuredClone(database ?? fallback),
        updateDatabase: async (
            _name,
            updater,
            fallback
        ) => {
            const nextValue = await updater(
                structuredClone(database ?? fallback)
            );
            database = structuredClone(nextValue);
            return structuredClone(database);
        },
        value: () => structuredClone(database),
    };
}

function entryDetails(overrides = {}) {
    return {
        guildId: 'guild-1',
        guildName: 'Illinois State Roleplay',
        robloxUserId: '123456789',
        robloxUsername: 'MockPlayer',
        robloxDisplayName: 'Mock Player',
        severity: 'high',
        reason: 'Repeatedly evaded staff review.',
        evidence: 'case-warning-123',
        notes: 'Monitor future sessions.',
        createdById: 'manager-1',
        createdByUsername: 'ManagerOne',
        ...overrides,
    };
}

function interactionForEmbeds() {
    return {
        guild: {
            name: 'Illinois State Roleplay | Strict',
            iconURL: () =>
                'https://cdn.discordapp.com/icons/1/logo.png',
        },
    };
}

test('/watchlist exposes seven focused management actions', () => {
    const command = watchlistCommand.data.toJSON();

    assert.equal(command.name, 'watchlist');
    assert.deepEqual(
        command.options.map((option) => option.name),
        [
            'add',
            'view',
            'search',
            'scan',
            'update',
            'resolve',
            'remove',
        ]
    );

    const add = command.options[0];
    assert.deepEqual(
        add.options
            .filter((option) => option.required)
            .map((option) => option.name),
        ['roblox-user', 'severity', 'reason']
    );
});

test('watchlist records are server-scoped and block active duplicates', async () => {
    const store = createMemoryStore(
        normalizeDatabase(null)
    );
    const record = await addWatchlistEntry(
        entryDetails(),
        store
    );

    assert.match(record.id, /^watch-/);
    assert.equal(record.status, 'active');
    assert.equal(record.auditLog[0].action, 'entry_created');

    const byUsername = await findWatchlistEntries(
        'guild-1',
        'mockplayer',
        {},
        store
    );
    const otherGuild = await findWatchlistEntries(
        'guild-2',
        'mockplayer',
        {},
        store
    );

    assert.equal(byUsername.length, 1);
    assert.equal(otherGuild.length, 0);

    await assert.rejects(
        addWatchlistEntry(entryDetails(), store),
        (error) =>
            error instanceof WatchlistError &&
            error.code === 'ACTIVE_ENTRY_EXISTS'
    );
});

test('updates, resolutions, and removals preserve audit history', async () => {
    const store = createMemoryStore();
    const created = await addWatchlistEntry(
        entryDetails(),
        store
    );
    const updated = await updateWatchlistEntry(
        'guild-1',
        created.id,
        {
            patch: {
                severity: 'critical',
                notes: null,
            },
            actorId: 'director-1',
            actorUsername: 'DirectorOne',
            changeReason: 'New verified information.',
        },
        store
    );

    assert.equal(updated.severity, 'critical');
    assert.equal(updated.notes, null);
    assert.equal(
        updated.auditLog.at(-1).action,
        'entry_updated'
    );

    const resolved = await resolveWatchlistEntry(
        'guild-1',
        created.id,
        {
            resolution: 'Management review completed.',
            actorId: 'director-1',
            actorUsername: 'DirectorOne',
        },
        store
    );
    const removed = await removeWatchlistEntry(
        'guild-1',
        created.id,
        {
            removalReason: 'Archived after final review.',
            actorId: 'owner-1',
            actorUsername: 'OwnerOne',
        },
        store
    );

    assert.equal(resolved.status, 'resolved');
    assert.equal(removed.status, 'removed');
    assert.equal(
        removed.auditLog.at(-1).action,
        'entry_removed'
    );
    assert.equal(removed.auditLog.length, 4);

    const visible = await findWatchlistEntries(
        'guild-1',
        created.id,
        {},
        store
    );
    const archived = await findWatchlistEntries(
        'guild-1',
        created.id,
        { includeRemoved: true },
        store
    );
    const direct = await getWatchlistEntry(
        'guild-1',
        created.id,
        store
    );

    assert.equal(visible.length, 0);
    assert.equal(archived.length, 1);
    assert.equal(direct.status, 'removed');
});

test('watchlist search combines private filters safely', async () => {
    const store = createMemoryStore();

    await addWatchlistEntry(entryDetails(), store);
    await addWatchlistEntry(
        entryDetails({
            robloxUserId: '987654321',
            robloxUsername: 'SecondPlayer',
            robloxDisplayName: 'Second Player',
            severity: 'low',
            reason: 'Observe vehicle misuse reports.',
        }),
        store
    );

    const results = await searchWatchlistEntries(
        'guild-1',
        {
            query: 'vehicle',
            severity: 'low',
            status: 'active',
        },
        store
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].robloxUsername, 'SecondPlayer');
});

test('active watchlist records can be loaded without a display limit', async () => {
    const store = createMemoryStore();

    for (let index = 0; index < 21; index += 1) {
        await addWatchlistEntry(
            entryDetails({
                robloxUserId: String(100000000 + index),
                robloxUsername: `Player${index}`,
            }),
            store
        );
    }

    const records = await getActiveWatchlistEntries(
        'guild-1',
        store
    );

    assert.equal(records.length, 21);
});

test('live watchlist matching accepts exact identities and rejects partial or conflicting IDs', () => {
    const records = [
        {
            ...entryDetails(),
            id: 'watch-id-match',
            status: 'active',
        },
        {
            ...entryDetails({
                robloxUserId: '222222222',
                robloxUsername: 'FallbackPlayer',
            }),
            id: 'watch-name-match',
            status: 'active',
        },
        {
            ...entryDetails({
                robloxUserId: '333333333',
                robloxUsername: 'ConflictingPlayer',
            }),
            id: 'watch-conflict',
            status: 'active',
        },
        {
            ...entryDetails({
                robloxUserId: '444444444',
                robloxUsername: 'ResolvedPlayer',
            }),
            id: 'watch-resolved',
            status: 'resolved',
        },
    ];
    const matches = matchWatchlistPlayers(records, [
        {
            Player: 'RenamedPlayer:123456789',
            Permission: 'Normal',
        },
        {
            Player: 'FallbackPlayer',
            Permission: 'Server Moderator',
        },
        {
            Player: 'ConflictingPlayer:999999999',
            Permission: 'Normal',
        },
        {
            Player: 'Mock',
            Permission: 'Normal',
        },
        {
            Player: 'ResolvedPlayer:444444444',
            Permission: 'Normal',
        },
    ]);

    assert.deepEqual(
        matches.map(({ record, matchedBy }) => [
            record.id,
            matchedBy,
        ]),
        [
            ['watch-id-match', 'user_id'],
            ['watch-name-match', 'username'],
        ]
    );
});

test('watchlist scan embed stays private and identifies verified matches', () => {
    const record = {
        ...entryDetails(),
        id: 'watch-example',
        status: 'active',
    };
    const embed = watchlistCommand
        .createScanEmbed(
            [
                {
                    record,
                    player: {
                        username: 'MockPlayer',
                        userId: '123456789',
                        permission: 'Server Administrator',
                    },
                    matchedBy: 'user_id',
                },
            ],
            interactionForEmbeds(),
            {
                activeRecordCount: 2,
                onlinePlayerCount: 5,
                isMockMode: true,
            }
        )
        .toJSON();

    assert.match(embed.title, /Live Watchlist Scan/);
    assert.match(embed.description, /1.*verified/i);
    assert.match(embed.fields.at(-1).value, /exact Roblox ID/i);
    assert.match(embed.footer.text, /No public alert was sent/i);
});

test('watchlist embeds clearly label records as private indicators', () => {
    const record = {
        ...entryDetails(),
        id: 'watch-example',
        status: 'active',
        createdAt: '2026-08-06T12:00:00.000Z',
        updatedAt: '2026-08-06T12:00:00.000Z',
        auditLog: [],
    };
    const embed = watchlistCommand
        .createWatchlistEmbed(
            record,
            interactionForEmbeds()
        )
        .toJSON();

    assert.match(embed.title, /Private Watchlist/);
    assert.match(embed.description, /not proof of wrongdoing/i);
    assert.match(
        embed.fields.find(
            (field) => field.name === 'Roblox Account'
        ).value,
        /123456789/
    );
    assert.match(embed.footer.text, /Management access only/i);
});

test('/watchlist rejects unauthorized users with an ephemeral response', async () => {
    let deferred;
    let edited;

    await watchlistCommand.execute({
        inGuild: () => true,
        guildId: 'unsupported-guild',
        guild: {
            ownerId: 'owner-1',
        },
        user: {
            id: 'member-1',
        },
        member: {
            permissions: {
                has: () => false,
            },
            roles: {
                cache: {
                    some: () => false,
                },
            },
        },
        deferReply: async (payload) => {
            deferred = payload;
        },
        editReply: async (payload) => {
            edited = payload;
        },
    });

    assert.equal(deferred.flags, MessageFlags.Ephemeral);
    assert.match(edited.content, /restricted/i);
});

test('Roblox resolver supports usernames and numeric IDs', async () => {
    const originalFetch = global.fetch;
    const requests = [];

    global.fetch = async (url) => {
        requests.push(String(url));

        if (String(url).includes('/usernames/users')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    data: [
                        {
                            id: 123,
                            name: 'MockPlayer',
                            displayName: 'Mock Player',
                        },
                    ],
                }),
            };
        }

        return {
            ok: true,
            status: 200,
            json: async () => ({
                id: 456,
                name: 'NumericPlayer',
                displayName: 'Numeric Player',
            }),
        };
    };

    try {
        const byName = await robloxService.resolveUser(
            'MockPlayer'
        );
        const byId = await robloxService.resolveUser('456');

        assert.equal(byName.id, '123');
        assert.equal(byId.name, 'NumericPlayer');
        assert.match(requests[0], /usernames\/users/);
        assert.match(requests[1], /users\/456/);
    } finally {
        global.fetch = originalFetch;
    }
});

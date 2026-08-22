const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const panelsCommand = require('../commands/management/panels');
const {
    createEditPayload,
    getPanelDefinitions,
    refreshPanel,
    repairPanel,
} = require('../utils/panelControlCenter');
const {
    ISP_SERVER_ID,
    MAIN_SERVER_ID,
} = require('../config/serverConfigs');

test('/panels exposes simple status, refresh, and repair controls', () => {
    const command = panelsCommand.data.toJSON();

    assert.equal(command.name, 'panels');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['status', 'refresh', 'repair']
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );

    for (const subcommand of command.options) {
        const panelOption = subcommand.options.find(
            (option) => option.name === 'panel'
        );
        assert.equal(panelOption.required, false);
        assert.equal(panelOption.choices.length, 9);
    }
});

test('panel catalog is separated by Discord server', () => {
    assert.deepEqual(
        getPanelDefinitions(MAIN_SERVER_ID).map(({ id }) => id),
        [
            'dashboard',
            'information',
            'discord-guidelines',
            'in-game-guidelines',
            'assistance',
            'staff-guide',
            'departments',
        ]
    );
    assert.deepEqual(
        getPanelDefinitions(ISP_SERVER_ID).map(({ id }) => id),
        ['isp-information', 'isp-shift-dashboard']
    );
    assert.deepEqual(getPanelDefinitions('unsupported'), []);
});

test('Components V2 refresh clears old attachments without removing components', () => {
    const payload = createEditPayload({
        flags: MessageFlags.IsComponentsV2,
        components: [{ id: 'new-panel' }],
        files: [{ name: 'banner.png' }],
    });

    assert.deepEqual(payload.embeds, []);
    assert.deepEqual(payload.attachments, []);
    assert.deepEqual(payload.components, [{ id: 'new-panel' }]);
});

test('refresh edits only a live saved message', async () => {
    const edits = [];
    const saves = [];
    const message = {
        id: 'message-1',
        channelId: 'channel-1',
        edit: async (payload) => {
            edits.push(payload);
            return message;
        },
    };
    const definition = {
        label: 'Test Panel',
        getStored: async () => ({
            channelId: 'channel-1',
            messageId: 'message-1',
        }),
        fetchMessage: async () => message,
        buildPayload: async () => ({ embeds: [{ title: 'Updated' }] }),
        save: async (guildId, panel) => saves.push({ guildId, panel }),
    };

    const result = await refreshPanel(
        definition,
        {},
        { id: 'guild-1' },
        'user-1'
    );

    assert.equal(result.status, 'refreshed');
    assert.equal(edits.length, 1);
    assert.deepEqual(edits[0].embeds, [{ title: 'Updated' }]);
    assert.equal(saves[0].panel.updatedById, 'user-1');
});

test('repair recreates a missing message in its saved channel', async () => {
    const saves = [];
    const sent = [];
    const channel = {
        id: 'channel-1',
        isTextBased: () => true,
        send: async (payload) => {
            sent.push(payload);
            return { id: 'message-2', channelId: 'channel-1' };
        },
    };
    const definition = {
        label: 'Test Panel',
        getStored: async () => ({
            channelId: 'channel-1',
            messageId: 'deleted-message',
        }),
        fetchMessage: async () => null,
        buildPayload: async () => ({ components: [{ id: 'panel' }] }),
        save: async (guildId, panel) => saves.push({ guildId, panel }),
    };
    const client = {
        channels: {
            cache: new Map([['channel-1', channel]]),
        },
    };

    const result = await repairPanel(
        definition,
        client,
        { id: 'guild-1' },
        'user-1'
    );

    assert.equal(result.status, 'repaired');
    assert.equal(sent.length, 1);
    assert.equal(saves[0].panel.messageId, 'message-2');
});

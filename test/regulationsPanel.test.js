const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const regulationsCommand = require('../commands/management/regulations');
const {
    REGULATIONS_PAGES,
    REGULATIONS_SELECT_ID,
    createRegulationsPagePayload,
    createRegulationsPanelPayload,
} = require('../utils/regulationsPanelManager');
const { MAIN_SERVER_ID } = require('../config/serverConfigs');

const guild = {
    id: MAIN_SERVER_ID,
    name: 'Illinois State Roleplay',
};
const context = {
    assistanceChannelId: '1490730143508070540',
    inGameGuidelinesChannelId: '1490680506952712233',
    discordGuidelinesChannelId: '1490680641904185435',
    proofChannelId: '1490733647915913246',
};

function collectComponents(component) {
    const found = [component];

    for (const child of component.components || []) {
        found.push(...collectComponents(child));
    }
    for (const item of component.items || []) {
        found.push(...collectComponents(item));
    }

    return found;
}

test('Regulations panel is one branded card with one menu', () => {
    const payload = createRegulationsPanelPayload(guild, context);
    const components = collectComponents(payload.components[0].toJSON());
    const menu = components.find(
        (component) => component.custom_id === REGULATIONS_SELECT_ID
    );
    const linkButtons = components.filter(
        (component) => component.style === 5
    );

    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.components.length, 1);
    assert.equal(payload.files[0].name, 'regulations-banner-v1.png');
    assert.equal(menu.options.length, 5);
    assert.deepEqual(
        menu.options.map((option) => option.value),
        REGULATIONS_PAGES.map((page) => page.value)
    );
    assert.equal(linkButtons.length, 4);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('every Regulations selection creates a private Components V2 page', () => {
    for (const page of REGULATIONS_PAGES) {
        const payload = createRegulationsPagePayload(
            guild,
            page.value,
            context
        );

        assert.ok(payload, page.value);
        assert.equal(payload.flags, MessageFlags.IsComponentsV2);
        assert.equal(payload.components.length, 1);
        assert.equal(payload.files[0].name, 'regulations-banner-v1.png');
        assert.deepEqual(payload.allowedMentions, { parse: [] });
    }
});

test('/regulations exposes only persistent panel controls', () => {
    const command = regulationsCommand.data.toJSON();

    assert.equal(command.name, 'regulations');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['setup', 'preview', 'update', 'remove']
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
});

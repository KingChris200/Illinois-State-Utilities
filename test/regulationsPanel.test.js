const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const regulationsCommand = require('../commands/management/regulations');
const {
    REGULATIONS_PAGES,
    REGULATIONS_PANEL_TYPES,
    createRegulationsPagePayload,
    createRegulationsPanelPayload,
    getRegulationsSelectId,
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
    sessionChannelId: '1490731232311378010',
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

for (const panel of REGULATIONS_PANEL_TYPES) {
    test(`${panel.label} is one branded card with one menu`, () => {
        const payload = createRegulationsPanelPayload(
            guild,
            panel.value,
            context
        );
        const components = collectComponents(payload.components[0].toJSON());
        const menu = components.find(
            (component) =>
                component.custom_id === getRegulationsSelectId(panel.value)
        );
        const linkButtons = components.filter(
            (component) => component.style === 5
        );

        assert.equal(payload.flags, MessageFlags.IsComponentsV2);
        assert.equal(payload.components.length, 1);
        assert.equal(payload.files[0].name, 'regulations-banner-v1.png');
        assert.deepEqual(
            menu.options.map((option) => option.value),
            REGULATIONS_PAGES[panel.value].map((page) => page.value)
        );
        assert.equal(linkButtons.length, panel.value === 'discord' ? 3 : 4);
        assert.deepEqual(payload.allowedMentions, { parse: [] });
    });
}

test('every guidelines selection creates a private Components V2 page', () => {
    for (const panel of REGULATIONS_PANEL_TYPES) {
        for (const page of REGULATIONS_PAGES[panel.value]) {
            const payload = createRegulationsPagePayload(
                guild,
                panel.value,
                page.value,
                context
            );

            assert.ok(payload, `${panel.value}:${page.value}`);
            assert.equal(payload.flags, MessageFlags.IsComponentsV2);
            assert.equal(payload.components.length, 1);
            assert.equal(payload.files[0].name, 'regulations-banner-v1.png');
            assert.deepEqual(payload.allowedMentions, { parse: [] });
        }
    }
});

test('restricted items display their rules directly without a link button', () => {
    const payload = createRegulationsPagePayload(
        guild,
        'in_game',
        'restricted',
        context
    );
    const components = collectComponents(payload.components[0].toJSON());
    const text = components
        .map((component) => component.content || '')
        .join('\n');
    const linkButtons = components.filter(
        (component) => component.style === 5
    );

    assert.match(text, /Large and heavy weapons, except sniper rifles/);
    assert.match(text, /Exotic and prestige vehicles/);
    assert.match(text, /All Tesla vehicles/);
    assert.match(text, /All sniper rifles/);
    assert.equal(linkButtons.length, 0);
});

test('/regulations exposes separate persistent panel controls', () => {
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

    for (const subcommand of command.options) {
        const panelOption = subcommand.options.find(
            (option) => option.name === 'panel'
        );

        assert.equal(panelOption.required, true, subcommand.name);
        assert.deepEqual(
            panelOption.choices.map((choice) => choice.value),
            ['discord', 'in_game']
        );
    }
});

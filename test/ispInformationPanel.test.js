const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const informationCommand = require('../commands/management/ispinformation');
const {
    ISP_INFORMATION_PAGES,
    ISP_INFORMATION_SELECT_ID,
    createIspInformationPagePayload,
    createIspInformationPanelPayload,
} = require('../utils/ispInformationPanelManager');
const {
    ISP_CHANNELS,
    ISP_SERVER_ID,
} = require('../config/serverConfigs');

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

test('ISP information panel is one branded card with one menu', () => {
    const payload = createIspInformationPanelPayload();
    const components = collectComponents(payload.components[0].toJSON());
    const menu = components.find(
        (component) => component.custom_id === ISP_INFORMATION_SELECT_ID
    );
    const linkButtons = components.filter(
        (component) => component.style === 5
    );

    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.components.length, 1);
    assert.equal(
        payload.files[0].name,
        'isp-information-banner-v1.png'
    );
    assert.equal(menu.options.length, 5);
    assert.deepEqual(
        menu.options.map((option) => option.value),
        ISP_INFORMATION_PAGES.map((page) => page.value)
    );
    assert.equal(linkButtons.length, 4);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('every ISP information selection creates a private page', () => {
    for (const page of ISP_INFORMATION_PAGES) {
        const payload = createIspInformationPagePayload(page.value);

        assert.ok(payload, page.value);
        assert.equal(payload.flags, MessageFlags.IsComponentsV2);
        assert.equal(payload.components.length, 1);
        assert.equal(
            payload.files[0].name,
            'isp-information-banner-v1.png'
        );
        assert.deepEqual(payload.allowedMentions, { parse: [] });
    }

    assert.equal(createIspInformationPagePayload('missing'), null);
});

test('/isp-information exposes only persistent panel controls', () => {
    const command = informationCommand.data.toJSON();

    assert.equal(command.name, 'isp-information');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['setup', 'preview', 'update', 'remove']
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
    assert.equal(ISP_CHANNELS.deputyCommand, '1527523195408613406');
    assert.equal(ISP_SERVER_ID, '1527511728169025658');
});

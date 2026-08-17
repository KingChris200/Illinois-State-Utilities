const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const informationCommand = require('../commands/management/information');
const {
    INFORMATION_PAGES,
    INFORMATION_SELECT_ID,
    createInformationPagePayload,
    createInformationPanelPayload,
} = require('../utils/informationPanelManager');
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
    primaryChannelId: '1490733409037975654',
    inGameChatChannelId: '1506444257173704704',
    sessionChannelId: '1490731232311378010',
    sessionRoleId: '1377126063926411334',
    serverCode: 'ILLINOISrp',
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

test('Information panel is one branded card with one menu', () => {
    const payload = createInformationPanelPayload(guild, context);
    const components = collectComponents(payload.components[0].toJSON());
    const menu = components.find(
        (component) => component.custom_id === INFORMATION_SELECT_ID
    );
    const linkButtons = components.filter(
        (component) => component.style === 5
    );

    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.components.length, 1);
    assert.equal(payload.files[0].name, 'information-banner-v1.png');
    assert.equal(menu.options.length, 5);
    assert.deepEqual(
        menu.options.map((option) => option.value),
        INFORMATION_PAGES.map((page) => page.value)
    );
    assert.equal(linkButtons.length, 5);
    assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('every Information selection creates a private Components V2 page', () => {
    for (const page of INFORMATION_PAGES) {
        const payload = createInformationPagePayload(
            guild,
            page.value,
            context
        );

        assert.ok(payload, page.value);
        assert.equal(payload.flags, MessageFlags.IsComponentsV2);
        assert.equal(payload.components.length, 1);
        assert.equal(payload.files[0].name, 'information-banner-v1.png');
        assert.deepEqual(payload.allowedMentions, { parse: [] });
    }
});

test('/information exposes only persistent panel controls', () => {
    const command = informationCommand.data.toJSON();

    assert.equal(command.name, 'information');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['setup', 'preview', 'update', 'remove']
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
});

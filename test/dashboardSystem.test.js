const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const dashboardCommand = require('../commands/management/dashboard');
const {
    DASHBOARD_PAGES,
    DASHBOARD_SELECT_ID,
    canAccessStaffResources,
    createDashboardPagePayload,
    createDashboardPanelPayload,
} = require('../utils/dashboardManager');
const { MAIN_SERVER_ID } = require('../config/serverConfigs');

const guild = {
    id: MAIN_SERVER_ID,
    name: 'Illinois State Roleplay',
    iconURL: () => null,
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
    staffGuideChannelId: '1490758446939639848',
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

test('Dashboard is one large minimal card with official links and one menu', () => {
    const payload = createDashboardPanelPayload(guild, context);
    const components = collectComponents(payload.components[0].toJSON());
    const menu = components.find(
        (component) => component.custom_id === DASHBOARD_SELECT_ID
    );
    const linkButtons = components.filter(
        (component) => component.style === 5
    );

    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.components.length, 1);
    assert.equal(payload.files.length, 1);
    assert.equal(payload.files[0].name, 'dashboard-banner-v2.png');
    assert.equal(menu.options.length, 5);
    assert.deepEqual(
        menu.options.map((option) => option.value),
        DASHBOARD_PAGES.map((page) => page.value)
    );
    assert.equal(linkButtons.length, 8);
    const buttonUrls = linkButtons.map((button) => button.url);
    for (const channelId of [
        context.inGameGuidelinesChannelId,
        context.discordGuidelinesChannelId,
        context.assistanceChannelId,
        context.sessionChannelId,
        context.proofChannelId,
        context.primaryChannelId,
        context.inGameChatChannelId,
    ]) {
        assert.ok(
            buttonUrls.includes(
                `https://discord.com/channels/${guild.id}/${channelId}`
            ),
            channelId
        );
    }
});

test('every Dashboard selection produces a private Components V2 page', () => {
    for (const page of DASHBOARD_PAGES) {
        const payload = createDashboardPagePayload(guild, page.value, context);

        assert.ok(payload, page.value);
        assert.equal(payload.flags, MessageFlags.IsComponentsV2);
        assert.equal(payload.components.length, 1);
        assert.equal(payload.files[0].name, 'dashboard-banner-v2.png');
        assert.deepEqual(payload.allowedMentions, { parse: [] });
    }
});

test('Staff Resources require the staff role or management permission', () => {
    const interaction = ({ staff = false, manage = false } = {}) => ({
        guildId: MAIN_SERVER_ID,
        memberPermissions: {
            has: (permission) =>
                manage && permission === PermissionFlagsBits.ManageGuild,
        },
        member: {
            roles: {
                cache: new Map(
                    staff
                        ? [['1490847791940112485', { id: '1490847791940112485' }]]
                        : []
                ),
            },
        },
    });

    assert.equal(canAccessStaffResources(interaction()), false);
    assert.equal(canAccessStaffResources(interaction({ staff: true })), true);
    assert.equal(canAccessStaffResources(interaction({ manage: true })), true);
});

test('/dashboard exposes only the permanent panel controls', () => {
    const command = dashboardCommand.data.toJSON();

    assert.equal(command.name, 'dashboard');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['setup', 'preview', 'update', 'remove']
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
});

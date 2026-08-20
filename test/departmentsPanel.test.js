const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');

const departmentsCommand = require('../commands/management/departments');
const {
    DEPARTMENTS,
    DEPARTMENTS_BANNER_NAME,
    DEPARTMENTS_SELECT_ID,
    createDepartmentPagePayload,
    createDepartmentsPanelPayload,
} = require('../utils/departmentsPanelManager');

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

test('Departments Hub is one minimal card with one seven-option menu', () => {
    const payload = createDepartmentsPanelPayload();
    const components = collectComponents(payload.components[0].toJSON());
    const menu = components.find(
        (component) => component.custom_id === DEPARTMENTS_SELECT_ID
    );

    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.components.length, 1);
    assert.equal(payload.files[0].name, DEPARTMENTS_BANNER_NAME);
    assert.equal(menu.options.length, 7);
    assert.deepEqual(
        menu.options.map((option) => option.value),
        DEPARTMENTS.map((department) => department.value)
    );
    assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('every department opens a private-ready detail page', () => {
    for (const department of DEPARTMENTS) {
        const payload = createDepartmentPagePayload(department.value);
        assert.ok(payload, department.value);
        assert.equal(payload.flags, MessageFlags.IsComponentsV2);
        assert.equal(payload.files[0].name, DEPARTMENTS_BANNER_NAME);
        assert.deepEqual(payload.allowedMentions, { parse: [] });
    }
});

test('official department invites and leaders are preserved', () => {
    assert.equal(DEPARTMENTS.find((entry) => entry.value === 'isp').invite,
        'https://discord.gg/W2ygrZUDBx');
    assert.equal(DEPARTMENTS.find((entry) => entry.value === 'cfd').leader,
        '<@1351721041264644126>');
    assert.equal(DEPARTMENTS.find((entry) => entry.value === 'usms').invite,
        'https://discord.gg/SGw7yncxf');
    assert.equal(DEPARTMENTS.find((entry) => entry.value === 'vsc').invite,
        undefined);
});

test('/departments exposes only persistent panel controls', () => {
    const command = departmentsCommand.data.toJSON();
    assert.equal(command.name, 'departments');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['setup', 'preview', 'update', 'remove']
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
});

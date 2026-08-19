const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');

const originalWorkingDirectory = process.cwd();
process.chdir(os.tmpdir());

const callsignCommand = require('../commands/management/callsign');
const callsignConfig = require('../config/ispCallsigns');
const { ISP_SERVER_ID } = require('../config/serverConfigs');
const { deleteDatabase } = require('../utils/database');
const {
    ISP_CALLSIGN_DATABASE,
    assignCallsign,
    assignLowestFreeCallsign,
    findCallsignAssignment,
    formatCallsign,
    getCallsignForUser,
    getFreeNumbers,
    listCallsignAssignments,
    normalizeCallsignNumber,
    releaseCallsign,
} = require('../utils/ispCallsignStore');
const {
    buildManagedNickname,
    createCallsignPanelPayload,
    getMemberCallsignSection,
    stripManagedCallsign,
} = require('../utils/ispCallsignManager');

process.chdir(originalWorkingDirectory);

function createRoleCache(roleIds) {
    const roles = new Set(roleIds);
    return {
        has: (roleId) => roles.has(roleId),
    };
}

function createMember(userId, roleIds, displayName = 'Officer Example') {
    return {
        id: userId,
        displayName,
        manageable: true,
        roles: { cache: createRoleCache(roleIds) },
        user: {
            id: userId,
            username: `Officer${userId.slice(-3)}`,
            displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
        },
    };
}

test.before(async () => {
    await deleteDatabase(ISP_CALLSIGN_DATABASE);
});

test.after(async () => {
    await deleteDatabase(ISP_CALLSIGN_DATABASE);
});

test('ISP callsign configuration uses the Deputy-Command channel and protected ranges', () => {
    assert.equal(callsignConfig.guildId, ISP_SERVER_ID);
    assert.equal(callsignConfig.commandChannelId, '1527523195408613406');
    assert.equal(callsignConfig.logChannelId, '1527516566818652332');
    assert.equal(callsignConfig.callsignPrefix, 'SP');
    assert.deepEqual(
        callsignConfig.sections.map((section) => [
            section.id,
            section.minimum,
            section.maximum,
        ]),
        [
            ['directorate', 1, 10],
            ['command', 11, 19],
            ['high_rank', 20, 35],
            ['sergeants', 36, 60],
            ['patrol', 61, 250],
        ]
    );
});

test('/callsign stays compact with a single private panel command', () => {
    const command = callsignCommand.data.toJSON();

    assert.equal(command.name, 'callsign');
    assert.equal(command.description, 'Open the ISP callsign management panel.');
    assert.deepEqual(command.options || [], []);
});

test('ISP ranks resolve to the correct protected callsign section', () => {
    const roleFor = (sectionId, index = 0) =>
        callsignConfig.sections.find((section) => section.id === sectionId)
            .roleIds[index];

    assert.equal(
        getMemberCallsignSection(
            createMember('100000000000000001', [roleFor('directorate')])
        ).id,
        'directorate'
    );
    assert.equal(
        getMemberCallsignSection(
            createMember('100000000000000002', [roleFor('command')])
        ).id,
        'command'
    );
    assert.equal(
        getMemberCallsignSection(
            createMember('100000000000000003', [roleFor('high_rank')])
        ).id,
        'high_rank'
    );
    assert.equal(
        getMemberCallsignSection(
            createMember('100000000000000004', [roleFor('sergeants')])
        ).id,
        'sergeants'
    );
    assert.equal(
        getMemberCallsignSection(
            createMember('100000000000000005', [roleFor('patrol')])
        ).id,
        'patrol'
    );
});

test('callsign formatting and nickname cleanup remain predictable', () => {
    assert.equal(normalizeCallsignNumber('072'), 72);
    assert.equal(normalizeCallsignNumber('0'), null);
    assert.equal(normalizeCallsignNumber('251'), null);
    assert.equal(normalizeCallsignNumber('72A'), null);
    assert.equal(formatCallsign(7), 'SP-007');
    assert.equal(stripManagedCallsign('ISP-062 | LF_V12'), 'LF_V12');
    assert.equal(stripManagedCallsign('SP-062 | LF_V12'), 'LF_V12');
    assert.equal(
        buildManagedNickname(
            {
                callsign: 'SP-062',
                baseNickname: 'LF_V12',
            },
            { displayName: 'ISP-041 | LF_V12', user: { username: 'LF_V12' } }
        ),
        'SP-062 | LF_V12'
    );
});

test('serialized callsign storage prevents duplicates and supports release', async () => {
    const guildId = 'callsign-test-guild';
    const users = Array.from({ length: 8 }, (_, index) => ({
        id: `2000000000000000${String(index).padStart(2, '0')}`,
        username: `Officer${index}`,
        displayName: `Officer ${index}`,
    }));

    const results = await Promise.all(
        users.map((identity) =>
            assignLowestFreeCallsign(
                guildId,
                identity,
                'patrol',
                identity.id
            )
        )
    );
    assert.ok(results.every((result) => result.status === 'assigned'));

    const assignments = await listCallsignAssignments(guildId);
    assert.equal(assignments.length, users.length);
    assert.equal(new Set(assignments.map((entry) => entry.number)).size, users.length);
    assert.deepEqual(
        assignments.map((entry) => entry.number),
        [61, 62, 63, 64, 65, 66, 67, 68]
    );

    const duplicate = await assignCallsign(
        guildId,
        {
            id: '299999999999999999',
            username: 'Duplicate',
            displayName: 'Duplicate',
        },
        61,
        'patrol',
        '299999999999999999'
    );
    assert.equal(duplicate.status, 'taken');

    const outside = await assignCallsign(
        guildId,
        {
            id: '299999999999999998',
            username: 'Outside',
            displayName: 'Outside',
        },
        20,
        'patrol',
        '299999999999999998'
    );
    assert.equal(outside.status, 'outside_section');

    const found = await findCallsignAssignment(guildId, '062');
    assert.equal(found.number, 62);
    assert.equal((await getCallsignForUser(guildId, found.userId)).number, 62);

    const released = await releaseCallsign(
        guildId,
        found.userId,
        users[0].id
    );
    assert.equal(released.status, 'released');
    assert.equal(await getCallsignForUser(guildId, found.userId), null);
    assert.ok((await getFreeNumbers(guildId, 'patrol')).includes(62));
});

test('private callsign panel exposes four simple member controls', async () => {
    const patrolRoleId = callsignConfig.sections.find(
        (section) => section.id === 'patrol'
    ).roleIds[0];
    const member = createMember(
        '300000000000000001',
        [patrolRoleId],
        'Panel Officer'
    );
    const interaction = {
        guildId: ISP_SERVER_ID,
        member,
        memberPermissions: { has: () => false },
        user: member.user,
    };
    const payload = await createCallsignPanelPayload(interaction, member);
    const embed = payload.embeds[0].toJSON();
    const buttons = payload.components[0].toJSON().components;

    assert.equal(embed.title, 'ISP Callsign Management');
    assert.deepEqual(
        buttons.map((button) => button.label),
        ['My Callsign', 'Request Callsign', 'Browse / List', 'Find by Callsign']
    );
    assert.ok(
        buttons.every((button) =>
            button.custom_id.startsWith('isp_callsign:')
        )
    );
});

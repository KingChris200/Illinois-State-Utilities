const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const guideCommand = require('../commands/management/guide');
const {
    CHAIN_OF_COMMAND,
    GUIDE_SECTIONS,
    RANK_GUIDES,
    STAFF_GUIDE_DOCUMENT_URL,
} = require('../config/staffGuideContent');
const {
    MAIN_SERVER_ID,
} = require('../config/serverConfigs');
const {
    ACKNOWLEDGE_BUTTON_ID,
    CHAIN_BUTTON_ID,
    MELONLY_INVITE_URL,
    ONBOARDING_BUTTON_ID,
    RANK_SELECT_ID,
    RANK_SELECT_VALUE_PREFIX,
    SECTION_SELECT_ID,
    TEAM_GUIDES,
    TEAM_SELECT_VALUE_PREFIX,
    WHITELISTED_GROUP_URL,
    canAccessStaffGuide,
    createChainPayload,
    createGuidePanelPayload,
    createGuideSectionPayload,
    createIndividualRankPayload,
    createOnboardingPayload,
    createRankGuidePayload,
    createTeamGuidePayload,
    getTeamRanks,
    handleStaffGuideInteraction,
} = require('../utils/staffGuideManager');
const {
    createDefaultComplianceState,
    getCurrentAcknowledgements,
    getCurrentOnboardingCompletions,
    normalizeComplianceState,
} = require('../utils/staffGuideCompliance');

const EXPECTED_CHAIN = [
    'Founder',
    'Assistant Founder',
    'Director',
    'Assistant Director',
    'Head of Staff',
    'Head Staff Supervisor',
    'Staff Supervisor',
    'Trial Staff Supervisor',
    'Senior Management',
    'Management',
    'Trial Management',
    'Internal Affairs Director',
    'Internal Affairs',
    'Trial Internal Affairs',
    'Head Administrator',
    'Senior Administrator',
    'Administrator',
    'Head Moderator',
    'Senior Moderator',
    'Moderator',
    'Trial Moderator',
];

const mockGuild = {
    id: MAIN_SERVER_ID,
    name: 'Illinois State Roleplay',
    ownerId: 'owner-user',
    iconURL: () =>
        'https://cdn.discordapp.com/icons/example.png',
};

test('staff guide uses the exact 21-rank chain of command', () => {
    assert.deepEqual(
        CHAIN_OF_COMMAND,
        EXPECTED_CHAIN
    );
});

test('staff guide separates the chain into seven official divisions', () => {
    assert.deepEqual(
        RANK_GUIDES.map((guide) => guide.id),
        [
            'foundership',
            'directorate',
            'staff_supervision',
            'management',
            'internal_affairs',
            'administration',
            'moderation',
        ]
    );

    assert.deepEqual(
        RANK_GUIDES.flatMap(
            (guide) => guide.ranks
        ),
        EXPECTED_CHAIN
    );
});

test('staff guide exposes all 15 handbook sections within Discord limits', () => {
    assert.equal(GUIDE_SECTIONS.length, 15);

    for (const section of GUIDE_SECTIONS) {
        assert.ok(section.id.length <= 100);
        assert.ok(section.label.length <= 100);
        assert.ok(section.description.length <= 100);
        assert.ok(section.intro.length <= 4096);
        assert.ok(section.fields.length <= 25);

        for (const field of section.fields) {
            assert.ok(field.name.length <= 256);
            assert.ok(field.value.length <= 1024);
        }
    }
});

test('public guide panel is one large minimal card with one team menu', () => {
    const payload = createGuidePanelPayload(
        mockGuild
    );
    const components = collectComponents(
        payload.components[0].toJSON()
    );
    const menu = components.find(
        (component) =>
            component.custom_id === RANK_SELECT_ID
    );
    const text = components
        .map((component) => component.content || '')
        .join('\n');

    assert.equal(
        payload.flags,
        MessageFlags.IsComponentsV2
    );
    assert.equal(payload.embeds, undefined);
    assert.equal(payload.components.length, 1);
    assert.equal(payload.files.length, 1);
    assert.equal(
        payload.files[0].name,
        'staff-guide-banner-v3.png'
    );
    assert.ok(
        components.some(
            (component) =>
                component.media?.url ===
                'attachment://staff-guide-banner-v3.png'
        )
    );
    assert.ok(text.includes(STAFF_GUIDE_DOCUMENT_URL));
    assert.ok(text.includes(WHITELISTED_GROUP_URL));
    assert.ok(text.includes(MELONLY_INVITE_URL));
    assert.equal(
        components.filter(
            (component) => component.type === 3
        ).length,
        1
    );
    assert.equal(menu.options.length, 4);
    assert.deepEqual(
        menu.options.map((option) => option.label),
        [
            'Moderation Team',
            'Administration Team',
            'High Rank Team',
            'Senior High Rank Team',
        ]
    );
    assert.ok(
        menu.options.every((option) =>
            option.value.startsWith(
                TEAM_SELECT_VALUE_PREFIX
            )
        )
    );
    assert.equal(
        components.some(
            (component) =>
                component.custom_id ===
                ACKNOWLEDGE_BUTTON_ID
        ),
        false
    );
    assert.equal(
        components.some(
            (component) =>
                component.custom_id ===
                ONBOARDING_BUTTON_ID
        ),
        false
    );
    assert.equal(
        components.some(
            (component) =>
                component.custom_id ===
                CHAIN_BUTTON_ID
        ),
        false
    );
    assert.equal(
        components.some(
            (component) =>
                component.custom_id ===
                SECTION_SELECT_ID
        ),
        false
    );
});

test('staff guide uses the approved official resource links', () => {
    assert.equal(
        STAFF_GUIDE_DOCUMENT_URL,
        'https://docs.google.com/document/d/1-HhMjftqUdLhgdmoLhNSrNcpvkcwlo_p2JZ_4ri1C3o/edit?tab=t.3qivgdyxzvm9'
    );
    assert.equal(
        WHITELISTED_GROUP_URL,
        'https://www.roblox.com/communities/623707637/Illinois-State-Roleplay-Strict-Whitelisted#!/about'
    );
    assert.equal(
        MELONLY_INVITE_URL,
        'https://melon.ly/join/FHMKHP'
    );
});

test('team cards follow the matching Discord team role color', () => {
    const roleColor = 0x4a90e2;
    const payload = createTeamGuidePayload(
        `${TEAM_SELECT_VALUE_PREFIX}moderation`,
        {
            ...mockGuild,
            roles: {
                cache: new Map([
                    [
                        'trial-moderator-role',
                        {
                            name: 'ISRP | Moderation Team',
                            color: roleColor,
                        },
                    ],
                ]),
            },
        }
    );
    const container = payload.components[0].toJSON();
    const components = collectComponents(container);

    assert.equal(container.accent_color, roleColor);
    assert.equal(
        components.some(
            (component) =>
                component.custom_id ===
                ACKNOWLEDGE_BUTTON_ID
        ),
        false
    );
});

test('the four team guides cover every official rank exactly once', () => {
    assert.deepEqual(
        TEAM_GUIDES.flatMap((team) =>
            getTeamRanks(team)
        ).sort(
            (left, right) =>
                CHAIN_OF_COMMAND.indexOf(left) -
                CHAIN_OF_COMMAND.indexOf(right)
        ),
        CHAIN_OF_COMMAND
    );
});

test('onboarding checklist includes all required resources and safe completion controls', () => {
    const state = createDefaultComplianceState(
        MAIN_SERVER_ID
    );
    const payload = createOnboardingPayload(
        mockGuild,
        state,
        'staff-user'
    );
    const components = collectComponents(
        payload.components[0].toJSON()
    );

    assert.equal(
        payload.flags,
        MessageFlags.IsComponentsV2
    );
    assert.equal(payload.components.length, 1);
    assert.ok(
        components.some(
            (component) =>
                component.url ===
                WHITELISTED_GROUP_URL
        )
    );
    assert.ok(
        components.some(
            (component) =>
                component.url ===
                MELONLY_INVITE_URL
        )
    );
    assert.equal(
        components.some(
            (component) =>
                component.custom_id ===
                ACKNOWLEDGE_BUTTON_ID
        ),
        true
    );
});

test('guide compliance state preserves versioned acknowledgements and onboarding', () => {
    const normalized = normalizeComplianceState(
        MAIN_SERVER_ID,
        {
            currentVersion: '2.0',
            acknowledgements: {
                '2.0': {
                    one: { userId: 'one' },
                },
            },
            onboardingCompletions: {
                one: {
                    userId: 'one',
                    completedVersion: '2.0',
                },
                old: {
                    userId: 'old',
                    completedVersion: '1.0',
                },
            },
        }
    );

    assert.equal(
        getCurrentAcknowledgements(normalized)
            .length,
        1
    );
    assert.equal(
        getCurrentOnboardingCompletions(
            normalized
        ).length,
        1
    );
});

test('every handbook and rank selection builds a valid private page', () => {
    for (const section of GUIDE_SECTIONS) {
        const payload =
            createGuideSectionPayload(
                section.id,
                mockGuild
            );

        const components = collectComponents(
            payload.components[0].toJSON()
        );
        assert.equal(
            payload.flags,
            MessageFlags.IsComponentsV2
        );
        assert.equal(payload.files.length, 1);
        assert.equal(
            payload.files[0].name,
            'staff-guide-banner-v3.png'
        );
        assert.ok(
            components.some(
                (component) =>
                    component.url?.includes(
                        'docs.google.com'
                    )
            )
        );
        assert.ok(
            components.some(
                (component) =>
                    component.media?.url?.endsWith(
                        'staff-guide-banner-v3.png'
                    )
            )
        );
    }

    for (const guide of RANK_GUIDES) {
        const payload = createRankGuidePayload(
            guide.id,
            mockGuild
        );

        assert.doesNotThrow(() =>
            payload.components[0].toJSON()
        );
        assert.equal(
            payload.flags,
            MessageFlags.IsComponentsV2
        );
    }

    for (const team of TEAM_GUIDES) {
        const payload = createTeamGuidePayload(
            `${TEAM_SELECT_VALUE_PREFIX}${team.id}`,
            mockGuild
        );

        assert.equal(
            payload.flags,
            MessageFlags.IsComponentsV2
        );
        assert.doesNotThrow(() =>
            payload.components[0].toJSON()
        );
    }

    for (
        let index = 0;
        index < CHAIN_OF_COMMAND.length;
        index += 1
    ) {
        const payload = createIndividualRankPayload(
            `${RANK_SELECT_VALUE_PREFIX}${index}`,
            mockGuild
        );

        assert.equal(
            payload.flags,
            MessageFlags.IsComponentsV2
        );
        assert.doesNotThrow(() =>
            payload.components[0].toJSON()
        );
    }

    assert.doesNotThrow(() =>
        createChainPayload(mockGuild)
            .components[0]
            .toJSON()
    );
});

test('staff guide access requires the main server and staff authorization', () => {
    const authorized = {
        guildId: MAIN_SERVER_ID,
        guild: mockGuild,
        user: { id: 'staff-user' },
        member: {
            permissions: {
                has: (permission) =>
                    permission ===
                    PermissionFlagsBits.ManageMessages,
            },
            roles: { cache: new Map() },
        },
    };

    assert.equal(
        canAccessStaffGuide(authorized),
        true
    );
    assert.equal(
        canAccessStaffGuide({
            ...authorized,
            guildId: '111111111111111111',
        }),
        false
    );
    assert.equal(
        canAccessStaffGuide({
            ...authorized,
            member: {
                permissions: { has: () => false },
                roles: { cache: new Map() },
            },
        }),
        false
    );
});

test('staff guide component responses are ephemeral', async () => {
    let response;
    const interaction = {
        customId: CHAIN_BUTTON_ID,
        guildId: MAIN_SERVER_ID,
        guild: mockGuild,
        user: { id: 'staff-user' },
        member: {
            permissions: {
                has: (permission) =>
                    permission ===
                    PermissionFlagsBits.ManageMessages,
            },
            roles: { cache: new Map() },
        },
        reply: async (payload) => {
            response = payload;
        },
    };

    await handleStaffGuideInteraction(
        interaction
    );

    assert.equal(
        response.flags,
        MessageFlags.Ephemeral |
            MessageFlags.IsComponentsV2
    );
    assert.ok(response.components.length > 0);
});

function collectComponents(component) {
    const collected = [component];

    if (Array.isArray(component.components)) {
        for (const child of component.components) {
            collected.push(
                ...collectComponents(child)
            );
        }
    }

    if (Array.isArray(component.items)) {
        collected.push(...component.items);
    }

    if (component.accessory) {
        collected.push(
            ...collectComponents(
                component.accessory
            )
        );
    }

    return collected;
}

test('/guide deploys panel, compliance, and publishing subcommands', () => {
    const command = guideCommand.data.toJSON();

    assert.equal(command.name, 'guide');
    assert.deepEqual(
        command.options.map(
            (option) => option.name
        ),
        [
            'setup',
            'preview',
            'update',
            'remove',
            'acknowledgements',
            'onboarding-status',
            'publish-update',
        ]
    );
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
});

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
} = require('../config/staffGuideContent');
const {
    MAIN_SERVER_ID,
} = require('../config/serverConfigs');
const {
    ACKNOWLEDGE_BUTTON_ID,
    CHAIN_BUTTON_ID,
    MELONLY_PANEL_URL,
    ONBOARDING_BUTTON_ID,
    RANK_SELECT_ID,
    SECTION_SELECT_ID,
    WHITELISTED_GROUP_URL,
    canAccessStaffGuide,
    createChainPayload,
    createGuidePanelPayload,
    createGuideSectionPayload,
    createOnboardingPayload,
    createRankGuidePayload,
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

test('public guide panel contains branded embeds and persistent controls', () => {
    const payload = createGuidePanelPayload(
        mockGuild
    );
    const rows = payload.components.map(
        (row) => row.toJSON()
    );

    assert.equal(payload.embeds.length, 2);
    assert.equal(rows.length, 4);
    assert.ok(
        rows[0].components.some(
            (component) =>
                component.url ===
                WHITELISTED_GROUP_URL
        )
    );
    assert.ok(
        rows[0].components.some(
            (component) =>
                component.url ===
                MELONLY_PANEL_URL
        )
    );
    assert.equal(
        rows[2].components[0].custom_id,
        SECTION_SELECT_ID
    );
    assert.equal(
        rows[2].components[0].options.length,
        15
    );
    assert.equal(
        rows[3].components[0].custom_id,
        RANK_SELECT_ID
    );
    assert.equal(
        rows[3].components[0].options.length,
        7
    );
    assert.ok(
        rows[1].components.some(
            (component) =>
                component.custom_id ===
                CHAIN_BUTTON_ID
        )
    );
    assert.ok(
        rows[1].components.some(
            (component) =>
                component.custom_id ===
                ACKNOWLEDGE_BUTTON_ID
        )
    );
    assert.ok(
        rows[1].components.some(
            (component) =>
                component.custom_id ===
                ONBOARDING_BUTTON_ID
        )
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
    const rows = payload.components.map((row) =>
        row.toJSON()
    );

    assert.equal(payload.embeds.length, 1);
    assert.equal(rows.length, 2);
    assert.ok(
        rows[0].components.some(
            (component) =>
                component.url ===
                WHITELISTED_GROUP_URL
        )
    );
    assert.ok(
        rows[0].components.some(
            (component) =>
                component.url ===
                MELONLY_PANEL_URL
        )
    );
    assert.equal(
        rows[1].components.every(
            (component) => component.style !== 5
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

        assert.equal(payload.embeds.length, 1);
        assert.match(
            payload.components[0]
                .toJSON()
                .components[0].url,
            /docs\.google\.com/
        );
        assert.doesNotThrow(() =>
            payload.embeds[0].toJSON()
        );
    }

    for (const guide of RANK_GUIDES) {
        const payload = createRankGuidePayload(
            guide.id,
            mockGuild
        );

        assert.equal(payload.embeds.length, 1);
        assert.doesNotThrow(() =>
            payload.embeds[0].toJSON()
        );
    }

    assert.doesNotThrow(() =>
        createChainPayload(mockGuild)
            .embeds[0]
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
        MessageFlags.Ephemeral
    );
    assert.equal(response.embeds.length, 1);
});

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

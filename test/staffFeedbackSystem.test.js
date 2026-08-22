const test = require('node:test');
const assert = require('node:assert/strict');

const staffCommand = require('../commands/management/staff');
const {
    createStaffFeedbackEmbed,
    createStaffFeedbackMessagePayload,
    createStaffFeedbackModal,
    formatRating,
    isEligibleStaffMember,
    parseFeedbackModalId,
} = require('../utils/staffFeedbackManager');
const {
    ISRP_CHANNELS,
    MAIN_SERVER_ID,
    MAIN_SERVER_RANKS,
} = require('../config/serverConfigs');

function createMember({
    id = '123456789012345678',
    roleIds = [],
    bot = false,
    displayName = 'Example Member',
} = {}) {
    return {
        id,
        displayName,
        user: {
            id,
            bot,
            username: 'example',
            displayAvatarURL: () => 'https://cdn.example/avatar.png',
        },
        roles: {
            cache: {
                has: (roleId) => roleIds.includes(roleId),
            },
        },
        displayAvatarURL: () => 'https://cdn.example/avatar.png',
    };
}

test('/staff feedback uses the simple staff, rating, and reason workflow', () => {
    const command = staffCommand.data.toJSON();
    const feedback = command.options.find(
        (option) => option.name === 'feedback'
    );

    assert.equal(command.name, 'staff');
    assert.deepEqual(
        feedback.options.map((option) => option.name),
        ['staff', 'rating', 'reason']
    );
    assert.equal(feedback.options[1].choices.length, 5);
    assert.equal(feedback.options[2].required, true);
    assert.equal(feedback.options[2].min_length, 15);
    assert.equal(feedback.options[2].max_length, 1000);
    assert.equal(ISRP_CHANNELS.commands, '1490733534611116204');
    assert.equal(ISRP_CHANNELS.staffFeedback, '1539790036994629792');
});

test('feedback forms bind the reviewer, target, and rating', () => {
    const reviewerId = '111111111111111111';
    const targetId = '222222222222222222';
    const modal = createStaffFeedbackModal({
        reviewerId,
        targetId,
        rating: 5,
    }).toJSON();
    const parsed = parseFeedbackModalId(modal.custom_id);

    assert.deepEqual(parsed, {
        reviewerId,
        targetId,
        rating: 5,
    });
    assert.equal(modal.components.length, 1);
    assert.equal(parseFeedbackModalId('staff_feedback:bad'), null);
});

test('only current staff members are eligible for feedback', () => {
    const rankedMember = createMember({
        roleIds: [MAIN_SERVER_RANKS[0].roleId],
    });
    const regularMember = createMember();
    const botMember = createMember({
        roleIds: [MAIN_SERVER_RANKS[0].roleId],
        bot: true,
    });

    assert.equal(isEligibleStaffMember(rankedMember), true);
    assert.equal(isEligibleStaffMember(regularMember), false);
    assert.equal(isEligibleStaffMember(botMember), false);
});

test('feedback results use a compact branded layout, rank, and safe rating', () => {
    const targetMember = createMember({
        roleIds: [MAIN_SERVER_RANKS[0].roleId],
        displayName: 'Helpful Staff',
    });
    const reviewer = createMember({
        id: '333333333333333333',
        displayName: 'Community Member',
    });
    const guild = {
        id: MAIN_SERVER_ID,
        name: 'Illinois State Roleplay | Strict',
    };
    const embed = createStaffFeedbackEmbed({
        guild,
        reviewer,
        targetMember,
        rating: 5,
        reason: 'They handled my support request clearly and professionally.',
        recordId: 'feedback-test',
    }).toJSON();

    assert.equal(embed.thumbnail.url, 'https://cdn.example/avatar.png');
    assert.equal(embed.author.name, 'Feedback by Community Member');
    assert.equal(embed.author.icon_url, 'https://cdn.example/avatar.png');
    assert.equal(embed.fields[0].name, 'Staff');
    assert.match(embed.fields[0].value, /Trial Moderator/);
    assert.equal(embed.fields[1].name, 'Rating');
    assert.match(embed.fields[1].value, /★★★★★/);
    assert.equal(embed.fields[2].name, 'Reason');
    assert.equal(formatRating(1), '★☆☆☆☆');
    assert.equal(formatRating(5), '★★★★★');
});

test('feedback safely pings only the reviewed staff member', () => {
    const targetMember = createMember({
        id: '222222222222222222',
        roleIds: [MAIN_SERVER_RANKS[0].roleId],
    });
    const reviewer = createMember({
        id: '333333333333333333',
    });
    const payload = createStaffFeedbackMessagePayload({
        guild: { id: MAIN_SERVER_ID },
        reviewer,
        targetMember,
        rating: 5,
        reason: 'They handled the ticket clearly and professionally.',
        recordId: 'feedback-test',
    });

    assert.equal(payload.content, '<@222222222222222222>');
    assert.deepEqual(payload.allowedMentions, {
        parse: [],
        users: ['222222222222222222'],
        roles: [],
    });
});

const test = require('node:test');
const assert = require('node:assert/strict');

const helpCommand = require('../prefixCommands/help');
const loadPrefixCommands = require('../handlers/prefixCommandHandler');

const config = {
    prefix: '?',
    mockMode: true,
    dryRun: true,
    allowedRoleIds: ['staff-role'],
    seniorRoleIds: ['senior-role'],
    defaultCooldownSeconds: 3,
};

function createMessage(roleIds = []) {
    const client = {};
    const replies = [];
    loadPrefixCommands(client);

    return {
        message: {
            client,
            member: {
                permissions: { has: () => false },
                roles: {
                    cache: {
                        has: (roleId) =>
                            roleIds.includes(roleId),
                    },
                },
            },
            reply: async (payload) => replies.push(payload),
        },
        replies,
    };
}

test('general help only shows commands available to the member', async () => {
    const { message, replies } = createMessage();

    await helpCommand.execute({
        message,
        args: [],
        config,
    });

    const embed = replies[0].embeds[0].toJSON();
    const text = embed.fields.map((field) => field.value).join('\n');
    assert.match(text, /\?help/);
    assert.match(text, /\?id/);
    assert.doesNotMatch(text, /\?warn/);
    assert.doesNotMatch(text, /\?logs/);
});

test('senior staff can see detailed logs help', async () => {
    const { message, replies } = createMessage(['senior-role']);

    await helpCommand.execute({
        message,
        args: ['logs'],
        config,
    });

    const embed = replies[0].embeds[0].toJSON();
    assert.equal(embed.title, 'Command Help — ?logs');
    assert.equal(
        embed.fields.find(
            (field) => field.name === 'Permission'
        ).value,
        'Senior staff'
    );
});

test('configured staff see the live intelligence commands', async () => {
    const { message, replies } = createMessage(['staff-role']);

    await helpCommand.execute({
        message,
        args: [],
        config,
    });

    const embed = replies[0].embeds[0].toJSON();
    const intelligence = embed.fields.find(
        (field) => field.name === 'Live Server Intelligence'
    ).value;
    assert.match(intelligence, /\?operations/);
    assert.match(intelligence, /\?modcalls/);
    assert.match(intelligence, /\?joinlogs/);
    assert.match(intelligence, /\?kl/);
    assert.match(intelligence, /\?queue/);
    assert.match(intelligence, /\?vehicles/);
    assert.doesNotMatch(intelligence, /\?killlogs/);
    assert.doesNotMatch(intelligence, /\?logs/);
});

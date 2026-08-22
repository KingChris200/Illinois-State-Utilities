const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const embedCommand = require(
    '../commands/management/embed'
);

function createInteraction({
    message = 'Please review the latest server update.',
    title = null,
    selectedChannel = null,
    guildIcon =
        'https://cdn.discordapp.com/icons/123/server.png',
} = {}) {
    const sent = [];
    const replies = [];
    const currentChannel = {
        id: 'current-channel',
        isTextBased: () => true,
        send: async (payload) => {
            sent.push(payload);
        },
        toString: () => '<#current-channel>',
    };

    const interaction = {
        options: {
            getString: (name) =>
                name === 'message' ? message : title,
            getChannel: () => selectedChannel,
        },
        channel: currentChannel,
        guild: {
            name: 'Illinois State Roleplay | Strict',
            iconURL: () => guildIcon,
        },
        reply: async (payload) => {
            replies.push(payload);
        },
        followUp: async (payload) => {
            replies.push(payload);
        },
        replied: false,
        deferred: false,
    };

    return {
        interaction,
        currentChannel,
        sent,
        replies,
    };
}

test('/embed only asks for message, title, and channel', () => {
    const command = embedCommand.data.toJSON();

    assert.equal(command.name, 'embed');
    assert.deepEqual(
        command.options.map((option) => option.name),
        ['message', 'title', 'channel']
    );
    assert.equal(command.options[0].required, true);
    assert.equal(command.options[1].required, false);
    assert.equal(command.options[2].required, false);
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageMessages.toString()
    );
});

test('/embed posts a branded announcement in the current channel', async () => {
    const {
        interaction,
        sent,
        replies,
    } = createInteraction();

    await embedCommand.execute(interaction);

    assert.equal(sent.length, 1);
    assert.equal(replies.length, 1);
    assert.equal(
        replies[0].flags,
        MessageFlags.Ephemeral
    );
    assert.match(replies[0].content, /posted/i);

    const payload = sent[0];
    const embed = payload.embeds[0].toJSON();

    assert.equal(embed.title, 'Community Announcement');
    assert.equal(
        embed.description,
        'Please review the latest server update.'
    );
    assert.equal(
        embed.author.name,
        'Illinois State Roleplay | Strict'
    );
    assert.equal(embed.thumbnail, undefined);
    assert.equal(embed.author.icon_url, undefined);
    assert.equal(
        embed.image.url,
        'attachment://announcements-banner-v2.png'
    );
    assert.equal(embed.footer.icon_url, undefined);
    assert.ok(embed.timestamp);
    assert.equal(payload.files.length, 1);
    assert.equal(
        payload.files[0].name,
        'announcements-banner-v2.png'
    );
    assert.deepEqual(payload.allowedMentions, {
        parse: [],
        users: [],
        roles: [],
    });
});

test('/embed honors an optional title and destination channel', async () => {
    const destinationPayloads = [];
    const selectedChannel = {
        id: 'announcements',
        isTextBased: () => true,
        send: async (payload) => {
            destinationPayloads.push(payload);
        },
        toString: () => '<#announcements>',
    };
    const { interaction, sent } = createInteraction({
        title: 'Staff Update',
        selectedChannel,
    });

    await embedCommand.execute(interaction);

    assert.equal(sent.length, 0);
    assert.equal(destinationPayloads.length, 1);
    assert.equal(
        destinationPayloads[0].embeds[0].toJSON().title,
        'Staff Update'
    );
});

test('/embed rejects an unusable destination safely', async () => {
    const { interaction, sent, replies } =
        createInteraction({
            selectedChannel: {
                isTextBased: () => false,
            },
        });

    await embedCommand.execute(interaction);

    assert.equal(sent.length, 0);
    assert.equal(replies.length, 1);
    assert.equal(
        replies[0].flags,
        MessageFlags.Ephemeral
    );
    assert.match(replies[0].content, /cannot post embeds/i);
});

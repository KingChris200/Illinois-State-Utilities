const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const brands = require('../config/branding');
const aboutCommand = require('../commands/utility/about');

const expectedAssets = [
    'branding/isrp-logo-clean.jpg',
    'branding/isrp-logo-dark.jpg',
    'branding/isrp-logo-silver.jpg',
    'branding/isrp-wordmark.jpg',
    'branding/isrp-roblox-avatar.jpg',
    'thumbnails/session-started.png',
    'thumbnails/welcome-banner.png',
];

test('brand URLs are durable and every branded asset exists locally', () => {
    for (const relativePath of expectedAssets) {
        assert.equal(
            fs.existsSync(path.join(__dirname, '..', 'assets', relativePath)),
            true,
            `Missing brand asset: assets/${relativePath}`
        );
    }

    for (const url of Object.values(brands.assets)) {
        assert.match(url, /^https:\/\/raw\.githubusercontent\.com\//);
        assert.doesNotMatch(url, /media\.discordapp\.net|[?&](?:ex|hm)=/i);
    }
});

test('/about presents the community wordmark and guild identity', async () => {
    const replies = [];
    const interaction = {
        guild: {
            name: 'Illinois State Roleplay | Strict',
            iconURL: () => 'https://cdn.discordapp.com/icons/123/icon.png',
        },
        client: {
            guilds: { cache: { size: 2 } },
            commands: { size: 35 },
        },
        reply: async (payload) => replies.push(payload),
    };

    await aboutCommand.execute(interaction);

    assert.equal(replies.length, 1);
    assert.equal(replies[0].files.length, 1);
    assert.equal(replies[0].files[0].name, 'isrp-wordmark.jpg');

    const embed = replies[0].embeds[0].toJSON();
    assert.equal(embed.image.url, 'attachment://isrp-wordmark.jpg');
    assert.equal(embed.author.name, 'Illinois State Roleplay | Strict');
    assert.equal(
        embed.thumbnail.url,
        'https://cdn.discordapp.com/icons/123/icon.png'
    );
});

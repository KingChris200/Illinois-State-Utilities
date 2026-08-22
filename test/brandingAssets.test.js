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
    'branding/v2/isrp-mark-white-v2.png',
    'branding/v2/isrp-mark-navy-v2.png',
    'branding/v2/isrp-logo-primary-v2.png',
    'branding/v2/isrp-logo-dark-v2.png',
    'branding/v2/isrp-logo-light-v2.png',
    'branding/v2/isrp-circular-badge-v2.png',
    'branding/v2/isrp-bot-icon-v2.png',
    'branding/v2/isrp-wordmark-white-v2.png',
    'branding/v2/isrp-wordmark-navy-v2.png',
    'branding/v2/isrp-watermark-white-v2.png',
    'branding/v3/isrp-emblem-silver-v3.jpg',
    'branding/v3/isrp-emblem-muted-v3.jpg',
    'branding/v3/isrp-wordmark-light-v3.jpg',
    'branding/v3/isrp-emblem-modern-v3.jpg',
    'branding/v3/isrp-wordmark-dark-v3.jpg',
    'thumbnails/sessions-banner-v3.png',
    'thumbnails/welcome-banner-v3.png',
    'thumbnails/staff-guide-banner-v4.png',
    'thumbnails/assistance-banner-v3.png',
    'thumbnails/announcements-banner-v2.png',
    'thumbnails/about-banner-v2.png',
    'thumbnails/information-banner-v2.png',
    'thumbnails/regulations-banner-v2.png',
    'thumbnails/dashboard-banner-v2.png',
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

test('brand palette uses the minimal white and light-blue system', () => {
    assert.equal(brands.palette.white, '#FFFFFF');
    assert.equal(brands.palette.ice, '#F7FBFF');
    assert.equal(brands.palette.lightBlue, '#B9DCFF');
    assert.equal(brands.isrp.color, brands.palette.lightBlue);
    assert.match(
        brands.assets.logo,
        /branding\/v3\/isrp-emblem-silver-v3\.jpg$/
    );
});

test('/about presents the minimal about banner and guild identity', async () => {
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
    assert.equal(replies[0].files[0].name, 'about-banner-v2.png');

    const embed = replies[0].embeds[0].toJSON();
    assert.equal(embed.image.url, 'attachment://about-banner-v2.png');
    assert.equal(embed.author.name, 'Illinois State Roleplay | Strict');
    assert.equal(embed.thumbnail, undefined);
    assert.equal(embed.author.icon_url, undefined);
    assert.equal(embed.footer.icon_url, undefined);
});

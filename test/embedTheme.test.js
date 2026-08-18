const test = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder } = require('discord.js');

const brands = require('../config/branding');
const createEmbed = require('../utils/createEmbed');
const {
    applyEmbedTheme,
    getDisplayAvatar,
    getGuildIcon,
} = require('../utils/embedTheme');

function createGuild() {
    return {
        name: 'Illinois State Roleplay | Strict',
        iconURL: () =>
            'https://cdn.discordapp.com/icons/123/server.png',
    };
}

test('server-wide embeds use the community name and official brand mark', () => {
    const embed = createEmbed('Server Overview', 'isrp', {
        guild: createGuild(),
    }).toJSON();

    assert.equal(embed.author.name, 'Illinois State Roleplay | Strict');
    assert.equal(
        embed.author.icon_url,
        brands.isrp.logo
    );
    assert.equal(
        embed.thumbnail.url,
        brands.isrp.logo
    );
    assert.equal(embed.footer.icon_url, brands.isrp.logo);
});

test('member-focused embeds prefer the member avatar as their thumbnail', () => {
    const subject = {
        displayAvatarURL: () =>
            'https://cdn.discordapp.com/avatars/456/member.png',
    };
    const embed = createEmbed('Staff Profile', 'isrp', {
        guild: createGuild(),
        subject,
    }).toJSON();

    assert.equal(
        embed.thumbnail.url,
        'https://cdn.discordapp.com/avatars/456/member.png'
    );
    assert.equal(
        embed.author.icon_url,
        brands.isrp.logo
    );
});

test('embed tones provide consistent success, warning, and danger colors', () => {
    const success = createEmbed('Success', 'isrp', {
        tone: 'success',
    }).toJSON();
    const warning = createEmbed('Warning', 'isrp', {
        tone: 'warning',
    }).toJSON();
    const danger = createEmbed('Danger', 'isrp', {
        tone: 'danger',
    }).toJSON();

    assert.equal(success.color, 0x2ecc71);
    assert.equal(warning.color, 0xf1c40f);
    assert.equal(danger.color, 0xe74c3c);
});

test('missing or faulty image providers fall back safely', () => {
    assert.equal(
        getGuildIcon({
            iconURL: () => {
                throw new Error('Unavailable');
            },
        }),
        null
    );
    assert.equal(getDisplayAvatar(null), null);

    const embed = applyEmbedTheme(new EmbedBuilder(), {
        brandName: 'isrp',
        guild: { name: 'Illinois State Roleplay' },
    }).toJSON();

    assert.equal(embed.thumbnail.url, brands.isrp.logo);
    assert.equal(embed.author.name, 'Illinois State Roleplay');
});

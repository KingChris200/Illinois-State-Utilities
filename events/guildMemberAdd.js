const path = require('path');

const {
    Events,
    EmbedBuilder,
    AttachmentBuilder,
} = require('discord.js');

const brands = require('../config/branding');
const {
    getWelcomeConfig,
} = require('../config/welcome');

const WELCOME_BANNER_NAME = 'welcome-banner-v2.png';
const WELCOME_BANNER_PATH = path.join(
    __dirname,
    '../assets/thumbnails/welcome-banner-v2.png'
);
const WELCOME_DEDUPLICATION_MS = 30_000;
const recentWelcomes = new Map();

module.exports = {
    name: Events.GuildMemberAdd,

    async execute(member) {
        if (member.user?.bot) {
            return;
        }

        const welcomeKey = claimWelcome(member);

        if (!welcomeKey) {
            console.log(
                `[WELCOME] member=${member.id} outcome=duplicate_ignored`
            );
            return;
        }

        const { channelId } = getWelcomeConfig();
        const channel = await member.guild.channels
            .fetch(channelId)
            .catch(() => null);

        if (
            !channel ||
            typeof channel.isTextBased !== 'function' ||
            !channel.isTextBased() ||
            typeof channel.send !== 'function'
        ) {
            console.error(
                `[WELCOME] Channel ${channelId} is unavailable.`
            );
            recentWelcomes.delete(welcomeKey);
            return;
        }

        try {
            await channel.send(
                createWelcomePayload(member)
            );

            console.log(
                `[WELCOME] member=${member.id} channel=${channelId} outcome=sent`
            );
        } catch (error) {
            recentWelcomes.delete(welcomeKey);
            console.error(
                `[WELCOME] member=${member.id} channel=${channelId} outcome=failed`,
                error
            );
        }
    },

    createWelcomePayload,
    clearWelcomeDeduplication,
};

function createWelcomePayload(member) {
    const brand = brands.isrp;
    const guildName = member.guild.name || brand.name;
    const memberCount = Math.max(
        Number(member.guild.memberCount) || 1,
        1
    );

    const welcomeEmbed = new EmbedBuilder()
        .setColor(brand.color)
        .setTitle(
            `Welcome to ${brand.name}`
        )
        .setDescription(
            [
                `Hello <@${member.id}>, we're glad to have you — you are our **#${memberCount} member!**`,
                '',
                'Start by reviewing the server rules and information, then complete verification and choose your roles so you never miss a session.',
            ].join('\n')
        )
        .setImage(
            `attachment://${WELCOME_BANNER_NAME}`
        )
        .setThumbnail(brand.logo)
        .setFooter({
            text: `${guildName} • Welcome aboard`,
            iconURL: brand.logo,
        })
        .setTimestamp();

    return {
        content: `👋 Welcome, <@${member.id}>!`,
        embeds: [welcomeEmbed],
        files: [
            new AttachmentBuilder(
                WELCOME_BANNER_PATH,
                {
                    name: WELCOME_BANNER_NAME,
                }
            ),
        ],
        allowedMentions: {
            parse: [],
            users: [member.id],
            roles: [],
        },
    };
}

function claimWelcome(member, now = Date.now()) {
    const key = `${member.guild?.id || 'unknown'}:${member.id}`;
    const previousWelcome = recentWelcomes.get(key);

    if (
        Number.isFinite(previousWelcome) &&
        now - previousWelcome < WELCOME_DEDUPLICATION_MS
    ) {
        return null;
    }

    recentWelcomes.set(key, now);

    if (recentWelcomes.size > 500) {
        for (const [storedKey, timestamp] of recentWelcomes) {
            if (now - timestamp >= WELCOME_DEDUPLICATION_MS) {
                recentWelcomes.delete(storedKey);
            }
        }
    }

    return key;
}

function clearWelcomeDeduplication() {
    recentWelcomes.clear();
}

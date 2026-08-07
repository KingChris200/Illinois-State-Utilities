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

const WELCOME_BANNER_NAME = 'welcome-banner.png';
const WELCOME_BANNER_PATH = path.join(
    __dirname,
    '../assets/thumbnails/welcome-banner.png'
);

module.exports = {
    name: Events.GuildMemberAdd,

    async execute(member) {
        if (member.user?.bot) {
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
            console.error(
                `[WELCOME] member=${member.id} channel=${channelId} outcome=failed`,
                error
            );
        }
    },

    createWelcomePayload,
};

function createWelcomePayload(member) {
    const brand = brands.isrp;
    const guildName = member.guild.name || brand.name;
    const guildIcon = member.guild.iconURL?.({
        extension: 'png',
        size: 256,
    });
    const memberCount = Math.max(
        Number(member.guild.memberCount) || 1,
        1
    );

    const bannerEmbed = new EmbedBuilder()
        .setColor('#EDEFF2')
        .setImage(
            `attachment://${WELCOME_BANNER_NAME}`
        );

    const welcomeEmbed = new EmbedBuilder()
        .setColor(brand.color)
        .setTitle(
            `☆ Welcome to ${brand.name}!`
        )
        .setDescription(
            [
                `Hello <@${member.id}>, we're glad to have you — you are our **#${memberCount} member!**`,
                '',
                'Start by reviewing the server rules and information, then complete verification and choose your roles so you never miss a session.',
            ].join('\n')
        )
        .setFooter({
            text: `${guildName} • Welcome aboard`,
            ...(guildIcon
                ? { iconURL: guildIcon }
                : {}),
        })
        .setTimestamp();

    return {
        embeds: [bannerEmbed, welcomeEmbed],
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

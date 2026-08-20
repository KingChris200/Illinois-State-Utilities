const path = require('node:path');
const {
    ActionRowBuilder,
    AttachmentBuilder,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    escapeMarkdown,
} = require('discord.js');

const brands = require('../config/branding');
const {
    ISRP_CHANNELS,
    MAIN_SERVER_ID,
    getServerConfig,
} = require('../config/serverConfigs');
const {
    createRecordId,
    readDatabase,
    updateDatabase,
} = require('./database');
const { detectMemberRank } = require('./rankManager');

const STAFF_FEEDBACK_DATABASE = 'staff-feedback';
const STAFF_FEEDBACK_PREFIX = 'staff_feedback:';
const STAFF_FEEDBACK_MODAL_PREFIX =
    `${STAFF_FEEDBACK_PREFIX}submit:`;
const STAFF_FEEDBACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STAFF_FEEDBACK_BANNER_NAME =
    'staff-feedback-banner-v1.png';
const STAFF_FEEDBACK_BANNER_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'thumbnails',
    STAFF_FEEDBACK_BANNER_NAME
);

function createStaffFeedbackAttachment() {
    return new AttachmentBuilder(STAFF_FEEDBACK_BANNER_PATH, {
        name: STAFF_FEEDBACK_BANNER_NAME,
    });
}

function createStaffFeedbackModal({ reviewerId, targetId, rating }) {
    return new ModalBuilder()
        .setCustomId(
            `${STAFF_FEEDBACK_MODAL_PREFIX}${reviewerId}:${targetId}:${rating}`
        )
        .setTitle(`Staff Feedback — ${rating}/5`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('feedback_reason')
                    .setLabel('Tell us about your experience')
                    .setPlaceholder(
                        'What did this staff member do well, or what could be improved?'
                    )
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMinLength(15)
                    .setMaxLength(1000)
            )
        );
}

function isEligibleStaffMember(member) {
    if (!member || member.user?.bot) {
        return false;
    }

    if (detectMemberRank(MAIN_SERVER_ID, member)) {
        return true;
    }

    const staffRoleId = getServerConfig(MAIN_SERVER_ID)
        ?.roleGroups?.serverStaffTeam;

    return Boolean(
        staffRoleId && member.roles?.cache?.has(staffRoleId)
    );
}

function formatRating(rating) {
    const safeRating = Math.min(5, Math.max(1, Number(rating) || 1));
    return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
}

function getMemberDisplayName(member) {
    return (
        member?.displayName ||
        member?.user?.globalName ||
        member?.user?.username ||
        'Unknown Member'
    );
}

function getMemberAvatar(member) {
    try {
        return member?.displayAvatarURL?.({
            extension: 'png',
            size: 256,
        }) || member?.user?.displayAvatarURL?.({
            extension: 'png',
            size: 256,
        }) || null;
    } catch {
        return null;
    }
}

function createStaffFeedbackEmbed({
    guild,
    reviewer,
    targetMember,
    rating,
    reason,
    recordId,
}) {
    const rank = detectMemberRank(guild.id, targetMember);
    const avatar = getMemberAvatar(targetMember);
    const safeReason = escapeMarkdown(String(reason).trim());
    const reviewerName = escapeMarkdown(getMemberDisplayName(reviewer));
    const targetName = escapeMarkdown(getMemberDisplayName(targetMember));
    const embed = new EmbedBuilder()
        .setColor(brands.isrp.color)
        .setAuthor({
            name: guild.name,
            iconURL: brands.isrp.logo,
        })
        .setTitle('Staff Feedback')
        .setDescription(
            [
                `## ${targetName}`,
                `**Rating:** ${formatRating(rating)}  \`${rating}/5\``,
                `**Staff Rank:** ${rank?.name || 'Server Staff'}`,
                '',
                '**Member Feedback**',
                ...safeReason.split('\n').map((line) => `> ${line || ' '}`),
            ].join('\n')
        )
        .setImage(`attachment://${STAFF_FEEDBACK_BANNER_NAME}`)
        .setFooter({
            text: `Submitted by ${reviewerName} • ${recordId}`,
            iconURL: brands.isrp.logo,
        })
        .setTimestamp();

    if (avatar) {
        embed.setThumbnail(avatar);
    }

    return embed;
}

async function getFeedbackRecords(guildId) {
    const database = await readDatabase(STAFF_FEEDBACK_DATABASE, {});
    return Array.isArray(database[guildId])
        ? database[guildId]
        : [];
}

async function getFeedbackCooldown(
    guildId,
    reviewerId,
    targetId,
    now = Date.now()
) {
    const records = await getFeedbackRecords(guildId);
    const latestRecord = records
        .filter(
            (record) =>
                record.reviewerId === reviewerId &&
                record.targetId === targetId
        )
        .sort((first, second) => second.createdAt - first.createdAt)[0];

    if (!latestRecord) {
        return null;
    }

    const expiresAt = latestRecord.createdAt +
        STAFF_FEEDBACK_COOLDOWN_MS;

    return expiresAt > now ? expiresAt : null;
}

async function saveFeedbackRecord(guildId, record) {
    await updateDatabase(
        STAFF_FEEDBACK_DATABASE,
        (database) => {
            const records = Array.isArray(database[guildId])
                ? database[guildId]
                : [];

            records.push(record);
            database[guildId] = records.slice(-5000);
            return database;
        },
        {}
    );

    return record;
}

async function fetchFeedbackChannel(client) {
    return (
        client.channels?.cache?.get(ISRP_CHANNELS.staffFeedback) ||
        await client.channels?.fetch?.(ISRP_CHANNELS.staffFeedback)
            .catch(() => null)
    );
}

function parseFeedbackModalId(customId) {
    const expression = new RegExp(
        `^${STAFF_FEEDBACK_MODAL_PREFIX}(\\d{17,20}):(\\d{17,20}):([1-5])$`
    );
    const match = expression.exec(customId || '');

    return match
        ? {
              reviewerId: match[1],
              targetId: match[2],
              rating: Number(match[3]),
          }
        : null;
}

async function handleStaffFeedbackInteraction(interaction) {
    if (!interaction.isModalSubmit?.()) {
        return;
    }

    const request = parseFeedbackModalId(interaction.customId);

    if (!request) {
        return;
    }

    if (
        interaction.guildId !== MAIN_SERVER_ID ||
        interaction.user.id !== request.reviewerId
    ) {
        await interaction.reply({
            content: 'This feedback form does not belong to you.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const reason = interaction.fields
            .getTextInputValue('feedback_reason')
            .trim();
        const targetMember = await interaction.guild.members
            .fetch(request.targetId)
            .catch(() => null);
        const reviewer = interaction.member;

        if (!isEligibleStaffMember(targetMember)) {
            await interaction.editReply(
                'That member is no longer recognized as ISRP staff.'
            );
            return;
        }

        const cooldownExpiresAt = await getFeedbackCooldown(
            interaction.guildId,
            interaction.user.id,
            request.targetId
        );

        if (cooldownExpiresAt) {
            await interaction.editReply(
                `You can leave feedback for this staff member again <t:${Math.ceil(cooldownExpiresAt / 1000)}:R>.`
            );
            return;
        }

        const destination = await fetchFeedbackChannel(interaction.client);

        if (!destination?.isTextBased?.() || !destination.send) {
            await interaction.editReply(
                'The Staff Feedback channel is unavailable. Please tell management.'
            );
            return;
        }

        const recordId = createRecordId('feedback');
        const record = {
            id: recordId,
            guildId: interaction.guildId,
            reviewerId: interaction.user.id,
            targetId: targetMember.id,
            targetRank:
                detectMemberRank(interaction.guildId, targetMember)?.name ||
                'Server Staff',
            rating: request.rating,
            reason,
            channelId: destination.id,
            messageId: null,
            createdAt: Date.now(),
        };
        const message = await destination.send({
            embeds: [
                createStaffFeedbackEmbed({
                    guild: interaction.guild,
                    reviewer,
                    targetMember,
                    rating: request.rating,
                    reason,
                    recordId,
                }),
            ],
            files: [createStaffFeedbackAttachment()],
            allowedMentions: {
                parse: [],
                users: [],
                roles: [],
            },
        });

        record.messageId = message.id;
        await saveFeedbackRecord(interaction.guildId, record);
        await interaction.editReply(
            `✅ Your feedback was posted: ${message.url}`
        );
    } catch (error) {
        console.error('[STAFF FEEDBACK] Submission failed:', error);
        await interaction.editReply(
            'I could not submit that feedback. Please try again.'
        ).catch(() => null);
    }
}

module.exports = {
    STAFF_FEEDBACK_BANNER_NAME,
    STAFF_FEEDBACK_COOLDOWN_MS,
    STAFF_FEEDBACK_DATABASE,
    STAFF_FEEDBACK_MODAL_PREFIX,
    STAFF_FEEDBACK_PREFIX,
    createStaffFeedbackEmbed,
    createStaffFeedbackModal,
    formatRating,
    getFeedbackCooldown,
    getFeedbackRecords,
    handleStaffFeedbackInteraction,
    isEligibleStaffMember,
    parseFeedbackModalId,
    saveFeedbackRecord,
};

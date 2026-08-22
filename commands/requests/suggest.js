const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');

const brands = require('../../config/branding');

function getSuggestionChannelId() {
    return String(process.env.SUGGESTIONS_CHANNEL_ID || '').trim();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggest')
        .setDescription('Share an idea for Illinois State Roleplay.')
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName('idea')
                .setDescription('What would you like us to add or change?')
                .setMinLength(10)
                .setMaxLength(1000)
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: 'Use this command inside Illinois State Roleplay.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const configuredChannelId = getSuggestionChannelId();
        const destination = configuredChannelId
            ? interaction.guild.channels.cache.get(configuredChannelId) ||
              (await interaction.guild.channels
                  .fetch(configuredChannelId)
                  .catch(() => null))
            : interaction.channel;

        if (!destination?.isTextBased()) {
            await interaction.reply({
                content: 'The suggestions channel is not available right now.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const idea = interaction.options.getString('idea', true).trim();
        const embed = new EmbedBuilder()
            .setColor(brands.isrp.color)
            .setTitle('Community Suggestion')
            .setDescription(idea)
            .setFooter({
                text: `Suggested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const message = await destination.send({
                embeds: [embed],
                allowedMentions: { parse: [] },
            });

            await message.react('👍');
            await message.react('👎');

            await interaction.editReply(
                `Your suggestion was posted: ${message.url}`
            );
        } catch (error) {
            console.error('[SUGGESTIONS] Could not post suggestion:', error);
            await interaction.editReply(
                'I could not post that suggestion. Please try again.'
            );
        }
    },

    getSuggestionChannelId,
};

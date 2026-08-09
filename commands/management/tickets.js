const {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require('discord.js');

const brands = require('../../config/branding');
const { getTicketConfig } = require('../../config/tickets');
const {
    countOpenTickets,
    createTicketPanelPayload,
    fetchStoredTicketMessage,
    getStoredTicketPanel,
    saveTicketPanel,
} = require('../../utils/ticketManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription(
            'Manages the permanent ISRP Assistance ticket panel.'
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription(
                    'Posts or refreshes the official Assistance panel.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('preview')
                .setDescription(
                    'Privately previews the Assistance panel.'
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('status')
                .setDescription(
                    'Shows the ticket panel and open-ticket status.'
                )
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            await interaction.reply({
                content: 'This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const config = getTicketConfig(interaction.guildId);

        if (!config) {
            await interaction.reply({
                content:
                    'The Assistance ticket system is not configured for this server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'preview') {
            const panelPayload =
                createTicketPanelPayload(interaction.guild);
            await interaction.reply({
                ...panelPayload,
                flags:
                    MessageFlags.Ephemeral |
                    panelPayload.flags,
            });
            return;
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        if (subcommand === 'status') {
            const panel = await getStoredTicketPanel(
                interaction.guildId
            );
            const panelMessage = await fetchStoredTicketMessage(
                interaction.client,
                panel
            );
            const openTickets = await countOpenTickets(
                interaction.guildId
            );

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(brands.isrp.color)
                        .setTitle('ISRP Assistance System Status')
                        .addFields(
                            {
                                name: 'Panel',
                                value: panelMessage
                                    ? `[Open Panel](${panelMessage.url})`
                                    : 'Not currently posted',
                                inline: true,
                            },
                            {
                                name: 'Open Tickets',
                                value: String(openTickets),
                                inline: true,
                            },
                            {
                                name: 'Assistance Channel',
                                value: `<#${config.assistanceChannelId}>`,
                                inline: true,
                            }
                        )
                        .setTimestamp(),
                ],
                allowedMentions: { parse: [] },
            });
            return;
        }

        const channel =
            interaction.guild.channels.cache.get(
                config.assistanceChannelId
            ) ||
            (await interaction.guild.channels
                .fetch(config.assistanceChannelId)
                .catch(() => null));

        if (!channel?.isTextBased()) {
            await interaction.editReply(
                `I could not access the Assistance channel (<#${config.assistanceChannelId}>).`
            );
            return;
        }

        const currentPanel = await getStoredTicketPanel(
            interaction.guildId
        );
        const currentMessage = await fetchStoredTicketMessage(
            interaction.client,
            currentPanel
        );
        const panelPayload = createTicketPanelPayload(
            interaction.guild
        );
        let panelMessage;
        let outcome;

        if (
            currentMessage &&
            currentPanel.channelId === channel.id
        ) {
            panelMessage = await currentMessage.edit({
                ...panelPayload,
                content: null,
                embeds: [],
                attachments: [],
            });
            outcome = 'updated';
        } else {
            panelMessage = await channel.send(panelPayload);
            outcome = 'posted';
        }

        await saveTicketPanel(interaction.guildId, {
            channelId: channel.id,
            messageId: panelMessage.id,
            updatedById: interaction.user.id,
            updatedAt: new Date().toISOString(),
        });

        await interaction.editReply({
            content:
                `✅ The Assistance ticket panel was ${outcome}: ${panelMessage.url}`,
            allowedMentions: { parse: [] },
        });
    },
};

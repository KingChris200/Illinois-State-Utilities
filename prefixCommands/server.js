const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');

module.exports = {
    name: 'server',
    description: 'Shows the current ER:LC server status.',
    usage: '?server',

    async execute({ message, config }) {
        const server = await erlcService.getServer();
        const currentPlayers =
            server.CurrentPlayers ?? 'Unknown';
        const maxPlayers = server.MaxPlayers ?? 'Unknown';
        const embed = createEmbed(
            'ER:LC Server Overview',
            'isrp'
        )
            .setDescription(
                config.mockMode
                    ? '🧪 **Mock data** — no live ER:LC request was made.'
                    : '🟢 **Live data** from the ER:LC private server.'
            )
            .addFields(
                {
                    name: 'Server Name',
                    value: String(server.Name || 'Unknown'),
                },
                {
                    name: 'Players',
                    value: `**${currentPlayers} / ${maxPlayers}**`,
                    inline: true,
                },
                {
                    name: 'Owner ID',
                    value: `\`${server.OwnerId || 'Unknown'}\``,
                    inline: true,
                },
                {
                    name: 'Join Key',
                    value: `\`${server.JoinKey || 'Unavailable'}\``,
                    inline: true,
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

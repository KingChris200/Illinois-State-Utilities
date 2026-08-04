const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');

function formatPlayer(player, index) {
    const rawPlayer = String(
        player.Player || player.Username || 'Unknown'
    );
    const separatorIndex = rawPlayer.lastIndexOf(':');
    const username =
        separatorIndex > 0
            ? rawPlayer.slice(0, separatorIndex)
            : rawPlayer;
    const userId =
        separatorIndex > 0
            ? rawPlayer.slice(separatorIndex + 1)
            : null;
    const permission = player.Permission || 'Normal';

    return [
        `**${index + 1}. ${username}**`,
        userId ? ` · \`${userId}\`` : '',
        ` — ${permission}`,
    ].join('');
}

module.exports = {
    name: 'players',
    description: 'Lists players currently in the ER:LC server.',
    usage: '?players',

    async execute({ message }) {
        const players = await erlcService.getPlayers();
        const lines = players.slice(0, 40).map(formatPlayer);
        let playerList = lines.join('\n');

        if (!playerList) {
            playerList =
                '*No players are currently in the server.*';
        } else if (playerList.length > 3900) {
            playerList = `${playerList.slice(0, 3890)}\n…`;
        }

        const embed = createEmbed(
            `Server Players — ${players.length}`,
            'isrp'
        )
            .setDescription(playerList)
            .addFields({
                name: 'Data Source',
                value: erlcService.isMockMode()
                    ? '🧪 Mock server data'
                    : '🟢 Live ER:LC API',
                inline: true,
            });

        if (players.length > 40) {
            embed.addFields({
                name: 'Display Limit',
                value: `Showing 40 of ${players.length} players.`,
            });
        }

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

const sessionConfig = require('../config/sessionAutomation');

async function fetchSessionChannel(interaction) {
    const channelId = sessionConfig.channelId;
    const cached =
        interaction.client?.channels?.cache?.get?.(channelId) ||
        interaction.guild?.channels?.cache?.get?.(channelId);
    const channel =
        cached ||
        await interaction.client?.channels?.fetch?.(channelId)
            .catch(() => null) ||
        await interaction.guild?.channels?.fetch?.(channelId)
            .catch(() => null);

    if (
        !channel?.isTextBased?.() ||
        typeof channel.send !== 'function' ||
        (channel.guildId && channel.guildId !== interaction.guildId)
    ) {
        return null;
    }

    return channel;
}

module.exports = {
    fetchSessionChannel,
};

async function logPrefixCommand(message, commandName, outcome) {
    const logLine = [
        '[PREFIX COMMAND]',
        `command=?${commandName}`,
        `user=${message.author.tag} (${message.author.id})`,
        `guild=${message.guild?.name || 'unknown'} (${message.guildId || 'unknown'})`,
        `channel=${message.channelId}`,
        `outcome=${outcome}`,
    ].join(' ');

    console.log(logLine);

    const logChannelId =
        require('../config/prefixCommands').logChannelId;

    if (!logChannelId) {
        return;
    }

    const channel = await message.client.channels
        .fetch(logChannelId)
        .catch(() => null);

    if (!channel?.isTextBased()) {
        return;
    }

    await channel
        .send({
            content: `\`${logLine}\``,
            allowedMentions: { parse: [] },
        })
        .catch(() => null);
}

module.exports = logPrefixCommand;

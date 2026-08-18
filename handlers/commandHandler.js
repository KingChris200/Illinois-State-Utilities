const {
    discoverCommandFiles,
    isValidCommandModule,
    loadCommandModule,
} = require('../utils/commandDiscovery');

module.exports = function loadCommands(client) {
    const discovery = discoverCommandFiles();

    if (!discovery.exists) {
        console.warn('⚠️ Commands folder was not found.');
        return 0;
    }

    let loadedCommandCount = 0;

    for (const record of discovery.commandFiles) {
        try {
            const command = loadCommandModule(
                record.filePath
            );

            if (!isValidCommandModule(command)) {
                console.warn(
                    `⚠️ Skipped ${record.relativeFilePath}: missing valid command data or execute function.`
                );
                continue;
            }

            const commandName = command.data.name;

            if (client.commands.has(commandName)) {
                console.warn(
                    `⚠️ Duplicate command name detected: /${commandName}. ${record.relativeFilePath} was skipped.`
                );
                continue;
            }

            client.commands.set(
                commandName,
                command
            );
            loadedCommandCount += 1;

            console.log(
                `✅ Loaded command: ${commandName}`
            );
        } catch (error) {
            console.error(
                `❌ Failed to load command ${record.relativeFilePath}:`,
                error
            );
        }
    }

    return loadedCommandCount;
};

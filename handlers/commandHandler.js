const fs = require('fs');
const path = require('path');

module.exports = function loadCommands(client) {
    const commandsPath = path.join(__dirname, '..', 'commands');

    if (!fs.existsSync(commandsPath)) {
        console.warn('⚠️ Commands folder was not found.');
        return 0;
    }

    let loadedCommandCount = 0;

    const commandFolders = fs
        .readdirSync(commandsPath)
        .filter((item) => {
            const itemPath = path.join(commandsPath, item);
            return fs.statSync(itemPath).isDirectory();
        });

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);

        const commandFiles = fs
            .readdirSync(folderPath)
            .filter((file) => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            if (
                !command.data ||
                typeof command.data.toJSON !== 'function' ||
                typeof command.execute !== 'function'
            ) {
                console.warn(
                    `⚠️ Skipped ${folder}/${file}: missing data or execute function.`
                );
                continue;
            }

            client.commands.set(command.data.name, command);
            loadedCommandCount++;

            console.log(`✅ Loaded command: ${command.data.name}`);
        }
    }

    return loadedCommandCount;
};
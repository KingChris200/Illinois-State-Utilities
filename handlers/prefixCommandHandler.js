const fs = require('fs');
const path = require('path');

module.exports = function loadPrefixCommands(client) {
    const commandsPath = path.join(
        __dirname,
        '..',
        'prefixCommands'
    );

    client.prefixCommands = new Map();

    if (!fs.existsSync(commandsPath)) {
        return 0;
    }

    let loadedCommandCount = 0;

    for (const file of fs
        .readdirSync(commandsPath)
        .filter((name) => name.endsWith('.js'))) {
        const command = require(path.join(commandsPath, file));

        if (
            !command.name ||
            typeof command.execute !== 'function'
        ) {
            console.warn(
                `Skipped prefix command ${file}: missing name or execute function.`
            );
            continue;
        }

        const names = [command.name, ...(command.aliases || [])];

        for (const name of names) {
            const normalizedName = name.toLowerCase();

            if (client.prefixCommands.has(normalizedName)) {
                console.warn(
                    `Duplicate prefix command detected: ?${normalizedName}.`
                );
                continue;
            }

            client.prefixCommands.set(normalizedName, command);
        }

        loadedCommandCount += 1;
    }

    return loadedCommandCount;
};

const fs = require('fs');
const path = require('path');

/*
 * ============================================================
 * INTERNAL COMMAND MODULES
 * ============================================================
 *
 * These files support larger modular commands but are not
 * standalone Discord slash commands.
 */

const ignoredCommandModules = new Set([
    /*
     * /case internal modules
     */

    'cases/casecomponents.js',
    'cases/caseview.js',
    'cases/caseedit.js',
    'cases/caseclose.js',
    'cases/casereopen.js',
    'cases/casevoid.js',
    'cases/casesearch.js',
    'cases/caselist.js',
    'cases/caseexport.js',

    /*
     * /movement internal modules
     */

    'management/movementHandler.js',
    'management/movementRevoke.js',
]);

module.exports = function loadCommands(
    client
) {
    const commandsPath =
        path.join(
            __dirname,
            '..',
            'commands'
        );

    if (!fs.existsSync(commandsPath)) {
        console.warn(
            '⚠️ Commands folder was not found.'
        );

        return 0;
    }

    let loadedCommandCount = 0;

    const commandFolders =
        fs.readdirSync(commandsPath)
            .filter((item) => {
                const itemPath =
                    path.join(
                        commandsPath,
                        item
                    );

                return fs
                    .statSync(itemPath)
                    .isDirectory();
            });

    for (
        const folder of
        commandFolders
    ) {
        const folderPath =
            path.join(
                commandsPath,
                folder
            );

        const commandFiles =
            fs.readdirSync(folderPath)
                .filter(
                    (file) =>
                        file.endsWith('.js')
                );

        for (
            const file of
            commandFiles
        ) {
            const relativeFilePath =
                `${folder}/${file}`;

            /*
             * Ignore internal modules that are imported by their
             * main slash-command router.
             */

            if (
                ignoredCommandModules.has(
                    relativeFilePath
                )
            ) {
                continue;
            }

            const filePath =
                path.join(
                    folderPath,
                    file
                );

            try {
                delete require.cache[
                    require.resolve(
                        filePath
                    )
                ];

                const command =
                    require(filePath);

                if (
                    !command.data ||
                    typeof command.data.toJSON !==
                        'function' ||
                    typeof command.execute !==
                        'function'
                ) {
                    console.warn(
                        `⚠️ Skipped ${relativeFilePath}: missing valid command data or execute function.`
                    );

                    continue;
                }

                const commandName =
                    command.data.name;

                if (
                    client.commands.has(
                        commandName
                    )
                ) {
                    console.warn(
                        `⚠️ Duplicate command name detected: /${commandName}. ${relativeFilePath} was skipped.`
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
                    `❌ Failed to load command ${relativeFilePath}:`,
                    error
                );
            }
        }
    }

    return loadedCommandCount;
};
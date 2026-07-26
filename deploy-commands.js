require('dotenv').config();

const {
    REST,
    Routes,
} = require('discord.js');

const fs = require('fs');
const path = require('path');

/*
 * ============================================================
 * ENVIRONMENT VALIDATION
 * ============================================================
 */

if (!process.env.DISCORD_TOKEN) {
    console.error(
        '❌ DISCORD_TOKEN is missing from the .env file.'
    );

    process.exit(1);
}

if (!process.env.CLIENT_ID) {
    console.error(
        '❌ CLIENT_ID is missing from the .env file.'
    );

    process.exit(1);
}

/*
 * ============================================================
 * INTERNAL COMMAND MODULES
 * ============================================================
 *
 * These files are helper modules used by larger commands.
 * They are not standalone Discord slash commands and should
 * never be sent to Discord during command deployment.
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

/*
 * ============================================================
 * COMMAND COLLECTION
 * ============================================================
 */

const commands = [];

const registeredCommandNames =
    new Set();

const commandsPath =
    path.join(
        __dirname,
        'commands'
    );

if (!fs.existsSync(commandsPath)) {
    console.error(
        '❌ Commands folder was not found.'
    );

    process.exit(1);
}

const commandFolders =
    fs.readdirSync(commandsPath)
        .filter((folder) => {
            const folderPath =
                path.join(
                    commandsPath,
                    folder
                );

            return fs
                .statSync(folderPath)
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
         * Skip internal modules.
         */

        if (
            ignoredCommandModules.has(
                relativeFilePath
            )
        ) {
            console.log(
                `⏭️ Ignored internal module: ${relativeFilePath}`
            );

            continue;
        }

        const filePath =
            path.join(
                folderPath,
                file
            );

        try {
            /*
             * Clear the require cache so the newest version of
             * every command is used during deployment.
             */

            delete require.cache[
                require.resolve(filePath)
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

            /*
             * Prevent Discord's duplicate-command-name error.
             */

            if (
                registeredCommandNames.has(
                    commandName
                )
            ) {
                console.error(
                    `❌ Duplicate command detected: /${commandName}`
                );

                console.error(
                    `   Duplicate file: ${relativeFilePath}`
                );

                console.error(
                    '   Deployment stopped so Discord does not reject the command list.'
                );

                process.exit(1);
            }

            registeredCommandNames.add(
                commandName
            );

            commands.push(
                command.data.toJSON()
            );

            console.log(
                `✅ Prepared command: /${commandName}`
            );
        } catch (error) {
            console.error(
                `❌ Failed to prepare ${relativeFilePath}:`,
                error
            );

            process.exit(1);
        }
    }
}

/*
 * ============================================================
 * GLOBAL COMMAND DEPLOYMENT
 * ============================================================
 */

const rest =
    new REST({
        version: '10',
    }).setToken(
        process.env.DISCORD_TOKEN
    );

(async () => {
    try {
        console.log('');
        console.log(
            '🌐 Deploying global Illinois State Utilities commands...'
        );
        console.log('');

        await rest.put(
            Routes.applicationCommands(
                process.env.CLIENT_ID
            ),
            {
                body: commands,
            }
        );

        console.log('');
        console.log(
            `✅ Successfully deployed ${commands.length} global command(s)!`
        );

        console.log(
            '📡 Commands are now registered in every server containing the bot.'
        );

        console.log('');
        console.log(
            'ℹ️ Global command updates can sometimes take several minutes to appear in Discord.'
        );
    } catch (error) {
        console.error('');
        console.error(
            '❌ Failed to deploy global commands.'
        );

        console.error(error);

        process.exitCode = 1;
    }
})();
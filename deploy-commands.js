require('dotenv').config();

const {
    REST,
    Routes,
} = require('discord.js');

const {
    discoverCommandFiles,
    isValidCommandModule,
    loadCommandModule,
} = require('./utils/commandDiscovery');

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

/*
 * ============================================================
 * COMMAND COLLECTION
 * ============================================================
 */

const commands = [];

const registeredCommandNames =
    new Set();

const discovery = discoverCommandFiles();

if (!discovery.exists) {
    console.error(
        '❌ Commands folder was not found.'
    );

    process.exit(1);
}

for (const record of discovery.internalFiles) {
    console.log(
        `⏭️ Ignored internal module: ${record.relativeFilePath}`
    );
}

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

        if (
            registeredCommandNames.has(
                commandName
            )
        ) {
            console.error(
                `❌ Duplicate command detected: /${commandName}`
            );
            console.error(
                `   Duplicate file: ${record.relativeFilePath}`
            );
            console.error(
                '   Deployment stopped so Discord does not reject the command list.'
            );
            process.exit(1);
        }

        registeredCommandNames.add(commandName);
        commands.push(command.data.toJSON());

        console.log(
            `✅ Prepared command: /${commandName}`
        );
    } catch (error) {
        console.error(
            `❌ Failed to prepare ${record.relativeFilePath}:`,
            error
        );
        process.exit(1);
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

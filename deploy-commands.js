require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing from the .env file.');
    process.exit(1);
}

if (!process.env.CLIENT_ID) {
    console.error('❌ CLIENT_ID is missing from the .env file.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
    console.error('❌ Commands folder was not found.');
    process.exit(1);
}

const commandFolders = fs
    .readdirSync(commandsPath)
    .filter((folder) => {
        const folderPath = path.join(commandsPath, folder);
        return fs.statSync(folderPath).isDirectory();
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

        commands.push(command.data.toJSON());
        console.log(`✅ Prepared command: /${command.data.name}`);
    }
}

const rest = new REST({ version: '10' }).setToken(
    process.env.DISCORD_TOKEN
);

(async () => {
    try {
        console.log('');
        console.log('🌐 Deploying global Illinois State Utilities commands...');
        console.log('');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            {
                body: commands,
            }
        );

        console.log(
            `✅ Successfully deployed ${commands.length} global command(s)!`
        );
        console.log(
            '📡 These commands will be available in every server containing the bot.'
        );
    } catch (error) {
        console.error('❌ Failed to deploy global commands.');
        console.error(error);
        process.exit(1);
    }
})();
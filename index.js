require('dotenv').config();

const {
    Client,
    Collection,
    GatewayIntentBits,
    ActivityType,
} = require('discord.js');

const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing from the .env file.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ],
});

client.commands = new Collection();

const loadedCommandCount = loadCommands(client);
const loadedEventCount = loadEvents(client);

client.once('clientReady', (readyClient) => {
    console.clear();

    console.log('══════════════════════════════════════════════════════');
    console.log('              ILLINOIS STATE UTILITIES');
    console.log('               MANAGEMENT PLATFORM');
    console.log('══════════════════════════════════════════════════════');
    console.log(`✅ Connected as: ${readyClient.user.tag}`);
    console.log(`🌐 Servers: ${readyClient.guilds.cache.size}`);
    console.log(`📦 Commands Loaded: ${loadedCommandCount}`);
    console.log(`📅 Events Loaded: ${loadedEventCount}`);
    console.log('🟢 Illinois State Utilities is Online!');
    console.log('══════════════════════════════════════════════════════');

    const statuses = [
        {
            name: 'Illinois State Roleplay 🌆',
            type: ActivityType.Watching,
        },
        {
            name: 'Illinois State Police 🚔',
            type: ActivityType.Watching,
        },
        {
            name: 'Supporting the Community 💙',
            type: ActivityType.Playing,
        },
        {
            name: 'Managing Departments 📋',
            type: ActivityType.Watching,
        },
        {
            name: 'Recruit Academy 🎓',
            type: ActivityType.Watching,
        },
        {
            name: 'Keeping Roleplay Organized ⚙️',
            type: ActivityType.Playing,
        },
        {
            name: 'Serving Illinois State Roleplay ⭐',
            type: ActivityType.Watching,
        },
    ];

    let statusIndex = 0;

    function updateStatus() {
        const currentStatus = statuses[statusIndex];

        readyClient.user.setPresence({
            activities: [
                {
                    name: currentStatus.name,
                    type: currentStatus.type,
                },
            ],
            status: 'online',
        });

        statusIndex = (statusIndex + 1) % statuses.length;
    }

    updateStatus();

    setInterval(updateStatus, 30_000);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('❌ Illinois State Utilities failed to log in.');
    console.error(error);
    process.exit(1);
});
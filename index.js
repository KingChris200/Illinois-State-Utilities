require('dotenv').config();

const {
    Client,
    Collection,
    GatewayIntentBits,
} = require('discord.js');

const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');
const {
    startPresenceRotation,
} = require('./services/presenceService');

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing from the .env file.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
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

    startPresenceRotation(readyClient);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('❌ Illinois State Utilities failed to log in.');
    console.error(error);
    process.exit(1);
});

const fs = require('fs');
const path = require('path');
const {
    Events,
    MessageFlags,
} = require('discord.js');

async function executeEvent(event, file, args, client) {
    try {
        await event.execute(...args, client);
    } catch (error) {
        console.error(
            `[EVENT ERROR] ${file} (${event.name}):`,
            error
        );

        if (event.name !== Events.InteractionCreate) {
            return;
        }

        const interaction = args[0];

        if (!interaction) {
            return;
        }

        const response = {
            content:
                '❌ An unexpected error occurred while processing that interaction. Please try again.',
            flags: MessageFlags.Ephemeral,
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response).catch(() => {});
        } else {
            await interaction.reply(response).catch(() => {});
        }
    }
}

module.exports = function loadEvents(client) {
    const eventsPath = path.join(__dirname, '..', 'events');

    if (!fs.existsSync(eventsPath)) {
        console.warn('⚠️ Events folder was not found.');
        return 0;
    }

    const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith('.js'));

    let loadedEventCount = 0;

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (!event.name || typeof event.execute !== 'function') {
            console.warn(
                `⚠️ Skipped ${file}: missing event name or execute function.`
            );
            continue;
        }

        if (event.once) {
            client.once(event.name, (...args) => {
                void executeEvent(event, file, args, client);
            });
        } else {
            client.on(event.name, (...args) => {
                void executeEvent(event, file, args, client);
            });
        }

        loadedEventCount++;

        console.log(`📅 Loaded event: ${event.name}`);
    }

    return loadedEventCount;
};

module.exports.executeEvent = executeEvent;

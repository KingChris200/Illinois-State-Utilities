const fs = require('fs');
const path = require('path');

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
            client.once(event.name, (...args) =>
                event.execute(...args, client)
            );
        } else {
            client.on(event.name, (...args) =>
                event.execute(...args, client)
            );
        }

        loadedEventCount++;

        console.log(`📅 Loaded event: ${event.name}`);
    }

    return loadedEventCount;
};
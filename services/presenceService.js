const {
    PRESENCE_INTERVAL_MS,
    PRESENCE_STATUSES,
} = require('../config/presence');

function startPresenceRotation(
    client,
    {
        statuses = PRESENCE_STATUSES,
        intervalMs = PRESENCE_INTERVAL_MS,
    } = {}
) {
    if (
        typeof client?.user?.setPresence !== 'function'
    ) {
        throw new TypeError(
            'A connected Discord client is required.'
        );
    }

    if (!Array.isArray(statuses) || statuses.length === 0) {
        throw new TypeError(
            'At least one presence status is required.'
        );
    }

    let statusIndex = 0;

    function updatePresence() {
        const currentStatus = statuses[statusIndex];

        client.user.setPresence({
            activities: [
                {
                    name: currentStatus.name,
                    type: currentStatus.type,
                },
            ],
            status: 'online',
        });

        statusIndex =
            (statusIndex + 1) % statuses.length;
    }

    updatePresence();

    const timer = setInterval(
        updatePresence,
        intervalMs
    );
    timer.unref?.();

    return {
        stop() {
            clearInterval(timer);
        },
        updatePresence,
    };
}

module.exports = {
    startPresenceRotation,
};

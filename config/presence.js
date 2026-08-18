const {
    ActivityType,
} = require('discord.js');

const PRESENCE_INTERVAL_MS = 30_000;

const PRESENCE_STATUSES = [
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

module.exports = {
    PRESENCE_INTERVAL_MS,
    PRESENCE_STATUSES,
};

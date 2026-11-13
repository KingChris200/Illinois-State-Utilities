const { MAIN_SERVER_ID } = require('./serverConfigs');

const TICKET_CONFIGS = {
    [MAIN_SERVER_ID]: {
        assistanceChannelId: '1547317873863561296',
        transcriptChannelId: '1490813707289362533',
        categories: [
            {
                id: 'management',
                label: 'Management Support',
                description: 'Leadership matters, purchases, partnerships, and serious concerns.',
                emoji: '🔨',
                parentCategoryId: '1490870524245577899',
                teamRoleId: '1490523581187231795',
            },
            {
                id: 'internal_affairs',
                label: 'Internal Affairs Support',
                description: 'Report staff or appeal moderation and infractions.',
                emoji: '🔧',
                parentCategoryId: '1490870524245577899',
                teamRoleId: '1526344302618218656',
            },
            {
                id: 'partnership',
                label: 'Partnership Support',
                description: 'Request or discuss an official community partnership.',
                emoji: '🤝',
                parentCategoryId: '1490870767632646365',
                teamRoleId: '1490523581187231795',
            },
            {
                id: 'general',
                label: 'General Support',
                description: 'Questions, concerns, suggestions, and community assistance.',
                emoji: '🌴',
                parentCategoryId: '1490870667795763412',
                teamRoleId: '1490523797629960392',
            },
            {
                id: 'in_game_report',
                label: 'In-Game Report Support',
                description: 'Report an in-game player with evidence for staff review.',
                emoji: '🎮',
                parentCategoryId: '1490870667795763412',
                teamRoleId: '1490523797629960392',
                requiresIntake: true,
            },
        ],
    },
};

function getTicketConfig(guildId) {
    return TICKET_CONFIGS[String(guildId)] || null;
}

function getTicketCategory(guildId, categoryId) {
    return (
        getTicketConfig(guildId)?.categories.find(
            (category) => category.id === categoryId
        ) || null
    );
}

module.exports = {
    TICKET_CONFIGS,
    getTicketConfig,
    getTicketCategory,
};

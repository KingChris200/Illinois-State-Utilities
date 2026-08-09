const { MAIN_SERVER_ID } = require('./serverConfigs');

const TICKET_CONFIGS = {
    [MAIN_SERVER_ID]: {
        assistanceChannelId: '1490730143508070540',
        categories: [
            {
                id: 'general',
                label: 'General Support',
                description: 'General questions, member reports, and community assistance.',
                emoji: '🎫',
                parentCategoryId: '1490870667795763412',
                teamRoleId: '1490523797629960392',
            },
            {
                id: 'internal_affairs',
                label: 'Internal Affairs Support',
                description: 'Report staff or appeal moderation and infractions.',
                emoji: '🕵️',
                parentCategoryId: '1490870524245577899',
                teamRoleId: '1526344302618218656',
            },
            {
                id: 'management',
                label: 'Management Support',
                description: 'Leadership matters, partnerships, and serious concerns.',
                emoji: '👑',
                parentCategoryId: '1490870524245577899',
                teamRoleId: '1490523581187231795',
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

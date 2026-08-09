const { MAIN_SERVER_ID } = require('./serverConfigs');

const TICKET_CONFIGS = {
    [MAIN_SERVER_ID]: {
        assistanceChannelId: '1490730143508070540',
        categories: [
            {
                id: 'general',
                label: 'General Assistance',
                description: 'Questions, concerns, or general community support.',
                emoji: '🎫',
                parentCategoryId: '1490870667795763412',
                accessLevel: 'support',
            },
            {
                id: 'management',
                label: 'Management Support',
                description: 'Private assistance from ISRP leadership.',
                emoji: '👑',
                parentCategoryId: '1490870524245577899',
                accessLevel: 'management',
            },
            {
                id: 'partnership',
                label: 'Partnership Support',
                description: 'Partnership inquiries and community relations.',
                emoji: '🤝',
                parentCategoryId: '1490870767632646365',
                accessLevel: 'support',
            },
            {
                id: 'ingame_appeal',
                label: 'In-Game Punishment Appeal',
                description: 'Appeal a warning, kick, ban, or other game action.',
                emoji: '🚓',
                parentCategoryId: '1490870524245577899',
                accessLevel: 'internal_affairs',
            },
            {
                id: 'staff_appeal',
                label: 'Staff Infraction Appeal',
                description: 'Appeal an ISRP staff notice, strike, or infraction.',
                emoji: '📋',
                parentCategoryId: '1490870524245577899',
                accessLevel: 'internal_affairs',
            },
            {
                id: 'report',
                label: 'Member or Staff Report',
                description: 'Privately report a member or staff concern.',
                emoji: '⚠️',
                parentCategoryId: '1490870524245577899',
                accessLevel: 'internal_affairs',
            },
            {
                id: 'internal_affairs',
                label: 'Internal Affairs Support',
                description: 'Staff reports and moderation or infraction appeals.',
                emoji: '🕵️',
                parentCategoryId: '1490870524245577899',
                accessLevel: 'internal_affairs',
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

const {
    handleModerationButton,
} = require('../utils/moderationConfirmationManager');
const {
    handleOperationsButton,
} = require('../utils/operationsDashboardManager');
const {
    handlePlayerIntelligenceButton,
} = require('../utils/playerIntelligenceManager');
const {
    handleWatchlistAlertButton,
    handleWatchlistAlertModal,
} = require('../utils/watchlistAlertInteractionManager');
const {
    handleWatchlistDashboardButton,
} = require('../utils/watchlistDashboardManager');
const {
    handleStaffGuideInteraction,
} = require('../utils/staffGuideManager');
const {
    handleTicketInteraction,
} = require('../utils/ticketManager');
const {
    handleLoaInteraction,
} = require('../utils/loaManager');
const {
    handleDashboardInteraction,
} = require('../utils/dashboardManager');
const {
    handleInformationInteraction,
} = require('../utils/informationPanelManager');
const {
    handleRegulationsInteraction,
} = require('../utils/regulationsPanelManager');
const {
    handleIspShiftInteraction,
} = require('../utils/ispShiftManager');
const {
    handleIspShiftDashboardInteraction,
} = require('../utils/ispShiftDashboardManager');
const {
    handleIspCallsignInteraction,
} = require('../utils/ispCallsignManager');

const componentRoutes = [
    {
        matches: (interaction) =>
            isAnyComponent(interaction) &&
            hasPrefix(interaction, 'isp_callsign:'),
        handle: handleIspCallsignInteraction,
    },
    {
        matches: (interaction) =>
            isAnyComponent(interaction) &&
            hasPrefix(interaction, 'ticket:'),
        handle: handleTicketInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(interaction, 'loa:'),
        handle: handleLoaInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isStringSelectMenu?.() &&
            hasPrefix(interaction, 'regulations:'),
        handle: handleRegulationsInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(
                interaction,
                'isp_shift_dashboard:'
            ),
        handle: handleIspShiftDashboardInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(interaction, 'isp_shift:'),
        handle: handleIspShiftInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isStringSelectMenu?.() &&
            hasPrefix(interaction, 'information:'),
        handle: handleInformationInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isStringSelectMenu?.() &&
            hasPrefix(interaction, 'dashboard:'),
        handle: handleDashboardInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isModalSubmit?.() &&
            hasPrefix(
                interaction,
                'watchlist_alert_modal:'
            ),
        handle: handleWatchlistAlertModal,
    },
    {
        matches: (interaction) =>
            (
                interaction.isStringSelectMenu?.() ||
                interaction.isButton?.()
            ) &&
            hasPrefix(interaction, 'staff_guide:'),
        handle: handleStaffGuideInteraction,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(interaction, 'erlc_mod:'),
        handle: handleModerationButton,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(interaction, 'erlc_ops:'),
        handle: handleOperationsButton,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(interaction, 'erlc_player:'),
        handle: handlePlayerIntelligenceButton,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(interaction, 'watchlist_alert:'),
        handle: handleWatchlistAlertButton,
    },
    {
        matches: (interaction) =>
            interaction.isButton?.() &&
            hasPrefix(
                interaction,
                'watchlist_dashboard:'
            ),
        handle: handleWatchlistDashboardButton,
    },
];

async function routeComponentInteraction(interaction) {
    for (const route of componentRoutes) {
        if (!route.matches(interaction)) {
            continue;
        }

        await route.handle(interaction);
        return true;
    }

    return false;
}

function isAnyComponent(interaction) {
    return Boolean(
        interaction.isModalSubmit?.() ||
        interaction.isStringSelectMenu?.() ||
        interaction.isButton?.()
    );
}

function hasPrefix(interaction, prefix) {
    return interaction.customId?.startsWith(prefix) === true;
}

module.exports = {
    componentRoutes,
    routeComponentInteraction,
};

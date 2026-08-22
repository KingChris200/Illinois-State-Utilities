const { MessageFlags } = require('discord.js');

const { getTicketConfig } = require('../config/tickets');
const {
    ISP_SERVER_ID,
    MAIN_SERVER_ID,
} = require('../config/serverConfigs');
const {
    createDashboardPanelPayload,
    fetchStoredDashboardMessage,
    getDashboardContext,
    getStoredDashboardPanel,
    saveDashboardPanel,
} = require('./dashboardManager');
const {
    createDepartmentsPanelPayload,
    fetchStoredDepartmentsMessage,
    getStoredDepartmentsPanel,
    saveDepartmentsPanel,
} = require('./departmentsPanelManager');
const {
    createInformationPanelPayload,
    fetchStoredInformationMessage,
    getStoredInformationPanel,
    saveInformationPanel,
} = require('./informationPanelManager');
const {
    createIspInformationPanelPayload,
    fetchStoredIspInformationMessage,
    getStoredIspInformationPanel,
    saveIspInformationPanel,
} = require('./ispInformationPanelManager');
const {
    createIspShiftDashboardPayload,
    fetchStoredIspShiftDashboardMessage,
    getStoredIspShiftDashboard,
    saveIspShiftDashboard,
} = require('./ispShiftDashboardManager');
const {
    createRegulationsPanelPayload,
    fetchStoredRegulationsMessage,
    getStoredRegulationsPanel,
    saveRegulationsPanel,
} = require('./regulationsPanelManager');
const { getComplianceState } = require('./staffGuideCompliance');
const {
    createGuidePanelPayload,
    fetchStoredGuideMessage,
    getStoredGuidePanel,
    saveGuidePanel,
} = require('./staffGuideManager');
const {
    createTicketPanelPayload,
    fetchStoredTicketMessage,
    getStoredTicketPanel,
    saveTicketPanel,
} = require('./ticketManager');

const PANEL_CHOICES = [
    { name: 'Dashboard', value: 'dashboard' },
    { name: 'Information', value: 'information' },
    { name: 'Discord Guidelines', value: 'discord-guidelines' },
    { name: 'In-Game Guidelines', value: 'in-game-guidelines' },
    { name: 'Assistance', value: 'assistance' },
    { name: 'Staff Guide', value: 'staff-guide' },
    { name: 'Departments', value: 'departments' },
    { name: 'ISP Information', value: 'isp-information' },
    { name: 'ISP Shift Dashboard', value: 'isp-shift-dashboard' },
];

function createMainPanelDefinitions() {
    const withDashboardContext = (builder) => async (guild) =>
        builder(guild, await getDashboardContext(guild.id));

    const regulations = (panelType, id, label) => ({
        id,
        label,
        setupCommand: `/regulations setup panel:${label}`,
        getStored: (guildId) =>
            getStoredRegulationsPanel(guildId, panelType),
        fetchMessage: fetchStoredRegulationsMessage,
        buildPayload: withDashboardContext((guild, context) =>
            createRegulationsPanelPayload(guild, panelType, context)
        ),
        save: (guildId, panel) =>
            saveRegulationsPanel(guildId, panelType, panel),
    });

    return [
        {
            id: 'dashboard',
            label: 'Dashboard',
            setupCommand: '/dashboard setup',
            getStored: getStoredDashboardPanel,
            fetchMessage: fetchStoredDashboardMessage,
            buildPayload: withDashboardContext(createDashboardPanelPayload),
            save: saveDashboardPanel,
        },
        {
            id: 'information',
            label: 'Information',
            setupCommand: '/information setup',
            getStored: getStoredInformationPanel,
            fetchMessage: fetchStoredInformationMessage,
            buildPayload: withDashboardContext(createInformationPanelPayload),
            save: saveInformationPanel,
        },
        regulations('discord', 'discord-guidelines', 'Discord Guidelines'),
        regulations('in_game', 'in-game-guidelines', 'In-Game Guidelines'),
        {
            id: 'assistance',
            label: 'Assistance',
            setupCommand: '/tickets setup',
            getStored: getStoredTicketPanel,
            fetchMessage: fetchStoredTicketMessage,
            buildPayload: async (guild) => {
                if (!getTicketConfig(guild.id)) {
                    throw new Error('Ticket configuration is unavailable.');
                }
                return createTicketPanelPayload(guild);
            },
            save: saveTicketPanel,
        },
        {
            id: 'staff-guide',
            label: 'Staff Guide',
            setupCommand: '/guide setup',
            getStored: getStoredGuidePanel,
            fetchMessage: fetchStoredGuideMessage,
            buildPayload: async (guild) =>
                createGuidePanelPayload(
                    guild,
                    await getComplianceState(guild.id)
                ),
            save: saveGuidePanel,
        },
        {
            id: 'departments',
            label: 'Departments',
            setupCommand: '/departments setup',
            getStored: getStoredDepartmentsPanel,
            fetchMessage: fetchStoredDepartmentsMessage,
            buildPayload: async () => createDepartmentsPanelPayload(),
            save: saveDepartmentsPanel,
        },
    ];
}

function createIspPanelDefinitions() {
    return [
        {
            id: 'isp-information',
            label: 'ISP Information',
            setupCommand: '/isp-information setup',
            getStored: getStoredIspInformationPanel,
            fetchMessage: fetchStoredIspInformationMessage,
            buildPayload: async () => createIspInformationPanelPayload(),
            save: saveIspInformationPanel,
        },
        {
            id: 'isp-shift-dashboard',
            label: 'ISP Shift Dashboard',
            setupCommand: '/shift dashboard action:Setup Dashboard',
            getStored: getStoredIspShiftDashboard,
            fetchMessage: fetchStoredIspShiftDashboardMessage,
            buildPayload: createIspShiftDashboardPayload,
            save: saveIspShiftDashboard,
        },
    ];
}

function getPanelDefinitions(guildId) {
    if (guildId === MAIN_SERVER_ID) {
        return createMainPanelDefinitions();
    }
    if (guildId === ISP_SERVER_ID) {
        return createIspPanelDefinitions();
    }
    return [];
}

function createEditPayload(payload) {
    const editPayload = {
        ...payload,
        content: payload.content ?? null,
        attachments: [],
    };

    if (
        payload.flags &&
        (payload.flags & MessageFlags.IsComponentsV2) ===
            MessageFlags.IsComponentsV2
    ) {
        editPayload.embeds = [];
    }

    return editPayload;
}

async function inspectPanel(definition, client, guildId) {
    const panel = await definition.getStored(guildId);
    if (!panel) {
        return { definition, status: 'not_configured', panel: null };
    }

    const message = await definition.fetchMessage(client, panel);
    return {
        definition,
        status: message ? 'live' : 'missing',
        panel,
        message,
    };
}

async function refreshPanel(definition, client, guild, userId) {
    const inspection = await inspectPanel(definition, client, guild.id);
    if (inspection.status !== 'live') {
        return inspection;
    }

    const payload = await definition.buildPayload(guild);
    const message = await inspection.message.edit(
        createEditPayload(payload)
    );
    await definition.save(guild.id, {
        ...inspection.panel,
        channelId: message.channelId,
        messageId: message.id,
        updatedById: userId,
        updatedAt: new Date().toISOString(),
    });

    return {
        definition,
        status: 'refreshed',
        panel: inspection.panel,
        message,
    };
}

async function repairPanel(definition, client, guild, userId) {
    const inspection = await inspectPanel(definition, client, guild.id);
    if (inspection.status === 'live') {
        return { ...inspection, status: 'already_live' };
    }
    if (inspection.status === 'not_configured') {
        return inspection;
    }

    const channel =
        client.channels?.cache?.get(inspection.panel.channelId) ||
        (await client.channels
            ?.fetch?.(inspection.panel.channelId)
            .catch(() => null));

    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
        return { ...inspection, status: 'channel_unavailable' };
    }

    const payload = await definition.buildPayload(guild);
    const message = await channel.send(payload);
    await definition.save(guild.id, {
        ...inspection.panel,
        channelId: channel.id,
        messageId: message.id,
        updatedById: userId,
        updatedAt: new Date().toISOString(),
    });

    return {
        definition,
        status: 'repaired',
        panel: inspection.panel,
        message,
    };
}

async function runPanelOperation({
    action,
    client,
    guild,
    panelId = null,
    userId,
}) {
    const definitions = getPanelDefinitions(guild.id).filter(
        (definition) => !panelId || definition.id === panelId
    );
    const results = [];

    for (const definition of definitions) {
        try {
            if (action === 'status') {
                results.push(
                    await inspectPanel(definition, client, guild.id)
                );
            } else if (action === 'refresh') {
                results.push(
                    await refreshPanel(definition, client, guild, userId)
                );
            } else if (action === 'repair') {
                results.push(
                    await repairPanel(definition, client, guild, userId)
                );
            }
        } catch (error) {
            console.error(
                `[PANEL CONTROL] ${action} failed for ${definition.id}:`,
                error
            );
            results.push({ definition, status: 'failed', error });
        }
    }

    return results;
}

module.exports = {
    PANEL_CHOICES,
    createEditPayload,
    getPanelDefinitions,
    inspectPanel,
    refreshPanel,
    repairPanel,
    runPanelOperation,
};

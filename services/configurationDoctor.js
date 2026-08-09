const fs = require('node:fs/promises');
const {
    GatewayIntentBits,
    PermissionFlagsBits,
} = require('discord.js');

const {
    MAIN_SERVER_ID,
} = require('../config/serverConfigs');
const {
    DATA_DIRECTORY,
    getDataBackupStatus,
} = require('./dataBackupService');
const {
    fetchStoredGuideMessage,
    getStoredGuidePanel,
} = require('../utils/staffGuideManager');

function environmentEnabled(name) {
    return String(process.env[name] || '')
        .trim()
        .toLowerCase() === 'true';
}

function createCheck(name, status, detail) {
    return { name, status, detail };
}

async function runConfigurationDoctor({
    client,
    guild,
}) {
    const checks = [];

    checks.push(
        createCheck(
            'Discord Connection',
            client?.user ? 'pass' : 'fail',
            client?.user
                ? `Online as ${client.user.tag || client.user.username || 'the configured bot'}.`
                : 'The Discord client is not ready.'
        )
    );

    const intents = client?.options?.intents;
    const hasMembers = Boolean(
        intents?.has?.(
            GatewayIntentBits.GuildMembers
        )
    );
    const hasMessageContent = Boolean(
        intents?.has?.(
            GatewayIntentBits.MessageContent
        )
    );

    checks.push(
        createCheck(
            'Required Gateway Intents',
            hasMembers && hasMessageContent
                ? 'pass'
                : 'fail',
            hasMembers && hasMessageContent
                ? 'Server Members and Message Content intents are loaded.'
                : 'Enable both Server Members and Message Content intents in code and the Discord Developer Portal.'
        )
    );

    checks.push(checkErlcReadiness());

    const channelDefinitions = [
        {
            name: 'Session Channel',
            id:
                process.env.ERLC_SESSION_CHANNEL_ID ||
                '1490731232311378010',
            required: true,
        },
        {
            name: 'Welcome Channel',
            id:
                process.env.WELCOME_CHANNEL_ID ||
                '1490733409037975654',
            required: true,
        },
        {
            name: 'Watchlist Alert Channel',
            id: process.env.WATCHLIST_ALERT_CHANNEL_ID,
            required: environmentEnabled(
                'WATCHLIST_ALERTS_ENABLED'
            ),
        },
        {
            name: 'Smart Alert Channel',
            id: process.env.ERLC_SMART_ALERT_CHANNEL_ID,
            required: environmentEnabled(
                'ERLC_SMART_ALERTS_ENABLED'
            ),
        },
        {
            name: 'Command Log Channel',
            id: process.env.ERLC_COMMAND_LOG_CHANNEL_ID,
            required: false,
        },
        {
            name: 'Moderation Log Channel',
            id:
                process.env
                    .ERLC_MODERATION_LOG_CHANNEL_ID,
            required: false,
        },
    ];

    for (const definition of channelDefinitions) {
        if (!definition.id && !definition.required) {
            continue;
        }

        checks.push(
            await checkChannel(
                guild,
                definition
            )
        );
    }

    checks.push(
        await checkStaffGuide(client, guild)
    );
    checks.push(await checkBackups());
    checks.push(await checkDataDirectory());

    const summary = {
        pass: checks.filter(
            (check) => check.status === 'pass'
        ).length,
        warning: checks.filter(
            (check) => check.status === 'warning'
        ).length,
        fail: checks.filter(
            (check) => check.status === 'fail'
        ).length,
    };

    return {
        guildId: guild?.id || MAIN_SERVER_ID,
        checkedAt: new Date().toISOString(),
        checks,
        summary,
        overallStatus:
            summary.fail > 0
                ? 'fail'
                : summary.warning > 0
                  ? 'warning'
                  : 'pass',
    };
}

function checkErlcReadiness() {
    const mockMode = environmentEnabled(
        'ERLC_MOCK_MODE'
    );
    const dryRun = environmentEnabled(
        'ERLC_DRY_RUN'
    );
    const hasKey = Boolean(
        String(
            process.env.ERLC_SERVER_KEY || ''
        ).trim()
    );

    if (mockMode) {
        return createCheck(
            'ER:LC Operations',
            'warning',
            'Mock mode is active. Commands use safe sample data and do not represent the live server.'
        );
    }

    if (dryRun) {
        return createCheck(
            'ER:LC Operations',
            'warning',
            'Dry-run mode is active. Remote actions are previewed but not sent.'
        );
    }

    return createCheck(
        'ER:LC Operations',
        hasKey ? 'pass' : 'fail',
        hasKey
            ? 'Live mode is selected and an API key is configured.'
            : 'Live mode is selected, but ERLC_SERVER_KEY is missing.'
    );
}

async function checkChannel(guild, definition) {
    const id = String(definition.id || '').trim();

    if (!/^\d{17,20}$/.test(id)) {
        return createCheck(
            definition.name,
            definition.required ? 'fail' : 'warning',
            definition.required
                ? 'The feature is enabled, but its channel ID is missing or invalid.'
                : 'The optional channel ID is invalid.'
        );
    }

    const channel =
        guild?.channels?.cache?.get(id) ||
        (await guild?.channels
            ?.fetch?.(id)
            .catch(() => null));

    if (!channel) {
        return createCheck(
            definition.name,
            'fail',
            `Configured channel <#${id}> could not be found.`
        );
    }

    const botMember = guild?.members?.me;
    const permissions =
        channel.permissionsFor?.(botMember);
    const canUse =
        !permissions ||
        (permissions.has(
            PermissionFlagsBits.ViewChannel
        ) &&
            permissions.has(
                PermissionFlagsBits.SendMessages
            ) &&
            permissions.has(
                PermissionFlagsBits.EmbedLinks
            ));

    return createCheck(
        definition.name,
        canUse ? 'pass' : 'fail',
        canUse
            ? `Ready in <#${id}>.`
            : `I need View Channel, Send Messages, and Embed Links in <#${id}>.`
    );
}

async function checkStaffGuide(client, guild) {
    const panel = await getStoredGuidePanel(
        guild?.id || MAIN_SERVER_ID
    );

    if (!panel) {
        return createCheck(
            'Permanent Staff Guide',
            'warning',
            'No saved panel was found. Run /guide setup when you are ready.'
        );
    }

    const message = await fetchStoredGuideMessage(
        client,
        panel
    );

    return createCheck(
        'Permanent Staff Guide',
        message ? 'pass' : 'fail',
        message
            ? `Panel is active in <#${panel.channelId}>.`
            : 'The saved panel message is missing or inaccessible. Run /guide setup to recreate it.'
    );
}

async function checkBackups() {
    try {
        const status =
            await getDataBackupStatus();

        if (!status.enabled) {
            return createCheck(
                'Automatic Data Backups',
                'warning',
                'Automatic backups are disabled in .env.'
            );
        }

        return createCheck(
            'Automatic Data Backups',
            status.running ? 'pass' : 'warning',
            status.running
                ? `Running with ${status.storedBackupCount} stored snapshot(s).`
                : 'Enabled, but the scheduler is not running yet. Restart the bot.'
        );
    } catch (error) {
        return createCheck(
            'Automatic Data Backups',
            'fail',
            'The backup directory could not be inspected.'
        );
    }
}

async function checkDataDirectory() {
    try {
        await fs.access(
            DATA_DIRECTORY,
            fs.constants.R_OK | fs.constants.W_OK
        );

        return createCheck(
            'Live Data Directory',
            'pass',
            'The bot can read and write its private data directory.'
        );
    } catch (error) {
        return createCheck(
            'Live Data Directory',
            error.code === 'ENOENT'
                ? 'warning'
                : 'fail',
            error.code === 'ENOENT'
                ? 'No data directory exists yet; it will be created with the first saved record.'
                : 'The bot cannot read or write its private data directory.'
        );
    }
}

module.exports = {
    checkChannel,
    checkErlcReadiness,
    createCheck,
    environmentEnabled,
    runConfigurationDoctor,
};

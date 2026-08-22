const {
    discoverCommandFiles,
    isValidCommandModule,
    loadCommandModule,
} = require('../utils/commandDiscovery');

const RUNTIME_PROTECTED_COMMANDS = new Set([
    'award',
    'case',
    'demote',
    'history',
    'infraction',
    'promote',
    'watchlist',
]);

const MEMBER_OR_MIXED_COMMANDS = new Set([
    'about',
    'callsign',
    'loa',
    'shift',
    'staff',
    'suggest',
]);
const DM_ALLOWED_COMMANDS = new Set(['about']);

function loadDeployableCommands() {
    const discovery = discoverCommandFiles();

    return discovery.commandFiles
        .map((record) => {
            try {
                const command = loadCommandModule(record.filePath);
                return isValidCommandModule(command) ? command : null;
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function auditCommandPermissions(commands = loadDeployableCommands()) {
    const findings = [];
    let discordProtected = 0;
    let runtimeProtected = 0;
    let memberFacing = 0;

    for (const command of commands) {
        const definition = command.data.toJSON();
        const name = definition.name;

        if (
            definition.dm_permission !== false &&
            !DM_ALLOWED_COMMANDS.has(name)
        ) {
            findings.push({
                command: name,
                severity: 'fail',
                detail: 'Server workflow is available in direct messages.',
            });
        }

        if (definition.default_member_permissions) {
            discordProtected += 1;
            continue;
        }

        if (RUNTIME_PROTECTED_COMMANDS.has(name)) {
            runtimeProtected += 1;
            continue;
        }

        if (MEMBER_OR_MIXED_COMMANDS.has(name)) {
            memberFacing += 1;
            continue;
        }

        findings.push({
            command: name,
            severity: 'fail',
            detail:
                'No Discord permission or reviewed runtime access policy is registered.',
        });
    }

    const loadedNames = new Set(
        commands.map((command) => command.data.toJSON().name)
    );

    for (const name of RUNTIME_PROTECTED_COMMANDS) {
        if (!loadedNames.has(name)) {
            findings.push({
                command: name,
                severity: 'warning',
                detail: 'A protected command listed in policy is not loaded.',
            });
        }
    }

    return {
        checkedCommands: commands.length,
        discordProtected,
        runtimeProtected,
        memberFacing,
        findings,
        status: findings.some((finding) => finding.severity === 'fail')
            ? 'fail'
            : findings.length > 0
              ? 'warning'
              : 'pass',
    };
}

module.exports = {
    MEMBER_OR_MIXED_COMMANDS,
    DM_ALLOWED_COMMANDS,
    RUNTIME_PROTECTED_COMMANDS,
    auditCommandPermissions,
    loadDeployableCommands,
};

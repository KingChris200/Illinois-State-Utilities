const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_BACKUP_INTERVAL_MS = 21_600_000;
const MINIMUM_BACKUP_INTERVAL_MS = 300_000;
const DEFAULT_BACKUP_RETENTION = 14;

const DATA_DIRECTORY = path.resolve(
    process.cwd(),
    'data'
);
const BACKUP_DIRECTORY = path.resolve(
    process.cwd(),
    'backups'
);

let backupTimer = null;
let runtimeState = {
    enabled: null,
    running: false,
    lastBackupAt: null,
    lastStatus: 'not_started',
    lastFileCount: 0,
    lastError: null,
};

function parseBoolean(value, fallback) {
    if (value === undefined || value === null) {
        return fallback;
    }

    return String(value).trim().toLowerCase() ===
        'true';
}

function parseBoundedInteger(
    value,
    fallback,
    minimum,
    maximum
) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(
        maximum,
        Math.max(minimum, parsed)
    );
}

function getDataBackupConfiguration() {
    return {
        enabled: parseBoolean(
            process.env.DATA_BACKUPS_ENABLED,
            true
        ),
        intervalMs: parseBoundedInteger(
            process.env.DATA_BACKUP_INTERVAL_MS,
            DEFAULT_BACKUP_INTERVAL_MS,
            MINIMUM_BACKUP_INTERVAL_MS,
            604_800_000
        ),
        retention: parseBoundedInteger(
            process.env.DATA_BACKUP_RETENTION,
            DEFAULT_BACKUP_RETENTION,
            1,
            100
        ),
        sourceDirectory: DATA_DIRECTORY,
        backupDirectory: BACKUP_DIRECTORY,
    };
}

function createBackupDirectoryName(date = new Date()) {
    return `backup-${date
        .toISOString()
        .replace(/[:.]/g, '-')}`;
}

async function listJsonFiles(directory) {
    try {
        const entries = await fs.readdir(
            directory,
            { withFileTypes: true }
        );

        return entries
            .filter(
                (entry) =>
                    entry.isFile() &&
                    entry.name
                        .toLowerCase()
                        .endsWith('.json')
            )
            .map((entry) => entry.name)
            .sort();
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }

        throw error;
    }
}

async function createDataBackup(options = {}) {
    const configuration =
        getDataBackupConfiguration();
    const sourceDirectory = path.resolve(
        options.sourceDirectory ||
            configuration.sourceDirectory
    );
    const backupDirectory = path.resolve(
        options.backupDirectory ||
            configuration.backupDirectory
    );
    const retention =
        options.retention ||
        configuration.retention;
    const files = await listJsonFiles(
        sourceDirectory
    );

    if (files.length === 0) {
        const result = {
            status: 'no_data',
            createdAt: new Date().toISOString(),
            fileCount: 0,
            files: [],
            backupPath: null,
        };

        updateRuntimeState(result);
        return result;
    }

    await fs.mkdir(backupDirectory, {
        recursive: true,
    });

    const createdAt = new Date();
    const snapshotDirectory = path.join(
        backupDirectory,
        createBackupDirectoryName(createdAt)
    );
    await fs.mkdir(snapshotDirectory, {
        recursive: false,
    });

    for (const fileName of files) {
        await fs.copyFile(
            path.join(sourceDirectory, fileName),
            path.join(snapshotDirectory, fileName)
        );
    }

    const manifest = {
        createdAt: createdAt.toISOString(),
        fileCount: files.length,
        files,
    };

    await fs.writeFile(
        path.join(snapshotDirectory, 'manifest.json'),
        JSON.stringify(manifest, null, 4),
        'utf8'
    );

    const removedBackups = await pruneDataBackups({
        backupDirectory,
        retention,
    });
    const result = {
        status: 'created',
        ...manifest,
        backupPath: snapshotDirectory,
        removedBackups,
    };

    updateRuntimeState(result);
    return result;
}

async function listBackupDirectories(
    backupDirectory = BACKUP_DIRECTORY
) {
    const resolvedDirectory = path.resolve(
        backupDirectory
    );

    try {
        const entries = await fs.readdir(
            resolvedDirectory,
            { withFileTypes: true }
        );

        return entries
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    /^backup-\d{4}-\d{2}-\d{2}T/.test(
                        entry.name
                    )
            )
            .map((entry) => entry.name)
            .sort()
            .reverse();
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }

        throw error;
    }
}

async function pruneDataBackups({
    backupDirectory = BACKUP_DIRECTORY,
    retention = DEFAULT_BACKUP_RETENTION,
} = {}) {
    const resolvedDirectory = path.resolve(
        backupDirectory
    );
    const safeRetention = parseBoundedInteger(
        retention,
        DEFAULT_BACKUP_RETENTION,
        1,
        100
    );
    const directories =
        await listBackupDirectories(
            resolvedDirectory
        );
    const expired = directories.slice(
        safeRetention
    );

    for (const directoryName of expired) {
        const target = path.resolve(
            resolvedDirectory,
            directoryName
        );
        const expectedPrefix =
            `${resolvedDirectory}${path.sep}`;

        if (
            !target.startsWith(expectedPrefix) ||
            !/^backup-\d{4}-\d{2}-\d{2}T/.test(
                directoryName
            )
        ) {
            throw new Error(
                'Refused to prune an unsafe backup path.'
            );
        }

        await fs.rm(target, {
            recursive: true,
            force: false,
        });
    }

    return expired;
}

function updateRuntimeState(result) {
    runtimeState = {
        ...runtimeState,
        lastBackupAt: result.createdAt,
        lastStatus: result.status,
        lastFileCount: result.fileCount,
        lastError: null,
    };
}

async function runScheduledBackup() {
    try {
        return await createDataBackup();
    } catch (error) {
        runtimeState = {
            ...runtimeState,
            lastStatus: 'failed',
            lastError: error.message,
        };

        console.error(
            '[DATA BACKUP] Scheduled backup failed:',
            error
        );

        return {
            status: 'failed',
            error: error.message,
        };
    }
}

async function startDataBackupService() {
    const configuration =
        getDataBackupConfiguration();

    runtimeState = {
        ...runtimeState,
        enabled: configuration.enabled,
    };

    if (!configuration.enabled) {
        return {
            state: 'disabled',
            configuration,
        };
    }

    if (backupTimer) {
        return {
            state: 'already_running',
            configuration,
        };
    }

    runtimeState.running = true;
    const initialResult =
        await runScheduledBackup();

    backupTimer = setInterval(
        runScheduledBackup,
        configuration.intervalMs
    );
    backupTimer.unref?.();

    return {
        state: 'running',
        configuration,
        initialResult,
    };
}

function stopDataBackupService() {
    if (backupTimer) {
        clearInterval(backupTimer);
        backupTimer = null;
    }

    runtimeState.running = false;
}

async function getDataBackupStatus() {
    const configuration =
        getDataBackupConfiguration();
    const backups = await listBackupDirectories(
        configuration.backupDirectory
    );

    return {
        ...runtimeState,
        enabled: configuration.enabled,
        configuration,
        storedBackupCount: backups.length,
        latestBackupName: backups[0] || null,
    };
}

module.exports = {
    BACKUP_DIRECTORY,
    DATA_DIRECTORY,
    DEFAULT_BACKUP_INTERVAL_MS,
    DEFAULT_BACKUP_RETENTION,
    MINIMUM_BACKUP_INTERVAL_MS,
    createBackupDirectoryName,
    createDataBackup,
    getDataBackupConfiguration,
    getDataBackupStatus,
    listBackupDirectories,
    pruneDataBackups,
    startDataBackupService,
    stopDataBackupService,
};

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const os = require('node:os');
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
let backupOperationQueue = Promise.resolve();
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

function hashBuffer(buffer) {
    return crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');
}

function createDataBackup(options = {}) {
    const operation = backupOperationQueue
        .catch(() => undefined)
        .then(() =>
            performDataBackup(options)
        );

    backupOperationQueue = operation;
    return operation;
}

async function performDataBackup(options = {}) {
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
    const temporaryDirectory =
        `${snapshotDirectory}.tmp-${process.pid}`;
    await fs.mkdir(temporaryDirectory, {
        recursive: false,
    });

    try {
        const checksums = {};

        for (const fileName of files) {
            const sourcePath = path.join(sourceDirectory, fileName);
            await fs.copyFile(
                sourcePath,
                path.join(
                    temporaryDirectory,
                    fileName
                )
            );
            checksums[fileName] = hashBuffer(
                await fs.readFile(sourcePath)
            );
        }

        const manifest = {
            createdAt: createdAt.toISOString(),
            fileCount: files.length,
            files,
            checksums,
        };

        await fs.writeFile(
            path.join(
                temporaryDirectory,
                'manifest.json'
            ),
            JSON.stringify(manifest, null, 4),
            'utf8'
        );

        await fs.rename(
            temporaryDirectory,
            snapshotDirectory
        );

        const removedBackups =
            await pruneDataBackups({
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
    } catch (error) {
        await fs.rm(temporaryDirectory, {
            recursive: true,
            force: true,
        }).catch(() => undefined);
        throw error;
    }
}

function assertSafeSnapshotPath(backupPath, backupDirectory) {
    const root = path.resolve(backupDirectory);
    const target = path.resolve(backupPath);

    if (
        !target.startsWith(`${root}${path.sep}`) ||
        !/^backup-\d{4}-\d{2}-\d{2}T/.test(path.basename(target))
    ) {
        throw new Error('Refused to inspect an unsafe backup path.');
    }

    return target;
}

async function verifyDataBackup({
    backupPath,
    backupDirectory = BACKUP_DIRECTORY,
    simulateRestore = true,
} = {}) {
    const target = assertSafeSnapshotPath(backupPath, backupDirectory);
    const manifest = JSON.parse(
        await fs.readFile(path.join(target, 'manifest.json'), 'utf8')
    );
    const files = Array.isArray(manifest.files) ? manifest.files : [];

    if (manifest.fileCount !== files.length || files.length === 0) {
        throw new Error('The backup manifest is incomplete.');
    }

    const restoreDirectory = simulateRestore
        ? await fs.mkdtemp(path.join(os.tmpdir(), 'isrp-restore-test-'))
        : null;

    try {
        for (const fileName of files) {
            if (
                path.basename(fileName) !== fileName ||
                !fileName.toLowerCase().endsWith('.json')
            ) {
                throw new Error('The backup manifest contains an unsafe file.');
            }

            const sourcePath = path.join(target, fileName);
            const contents = await fs.readFile(sourcePath);
            JSON.parse(contents.toString('utf8'));

            if (
                manifest.checksums?.[fileName] &&
                manifest.checksums[fileName] !== hashBuffer(contents)
            ) {
                throw new Error(`Checksum mismatch for ${fileName}.`);
            }

            if (restoreDirectory) {
                const restoredPath = path.join(restoreDirectory, fileName);
                await fs.copyFile(sourcePath, restoredPath);
                JSON.parse(await fs.readFile(restoredPath, 'utf8'));
            }
        }

        return {
            status: 'verified',
            backupName: path.basename(target),
            createdAt: manifest.createdAt || null,
            fileCount: files.length,
            simulatedRestore: Boolean(restoreDirectory),
        };
    } finally {
        if (restoreDirectory) {
            await fs.rm(restoreDirectory, {
                recursive: true,
                force: true,
            });
        }
    }
}

async function verifyLatestDataBackup(options = {}) {
    const configuration = getDataBackupConfiguration();
    const backupDirectory = path.resolve(
        options.backupDirectory || configuration.backupDirectory
    );
    const backups = await listBackupDirectories(backupDirectory);

    if (backups.length === 0) {
        return {
            status: 'no_backup',
            fileCount: 0,
            simulatedRestore: false,
        };
    }

    return verifyDataBackup({
        backupPath: path.join(backupDirectory, backups[0]),
        backupDirectory,
        simulateRestore: options.simulateRestore !== false,
    });
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
    verifyDataBackup,
    verifyLatestDataBackup,
};

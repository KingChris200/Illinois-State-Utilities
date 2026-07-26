const fs = require('node:fs/promises');
const path = require('node:path');

/*
 * ============================================================
 * DATABASE DIRECTORY
 * ============================================================
 */

const DATA_DIRECTORY = path.join(
    process.cwd(),
    'data'
);

/*
 * ============================================================
 * DATABASE PATH
 * ============================================================
 */

/**
 * Converts a database name into a safe JSON filename.
 *
 * Example:
 * getDatabasePath('staff-records')
 *
 * Result:
 * data/staff-records.json
 */
function getDatabasePath(databaseName) {
    if (
        typeof databaseName !== 'string' ||
        databaseName.trim().length === 0
    ) {
        throw new TypeError(
            'A valid database name must be provided.'
        );
    }

    const safeDatabaseName = databaseName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-');

    return path.join(
        DATA_DIRECTORY,
        `${safeDatabaseName}.json`
    );
}

/*
 * ============================================================
 * DIRECTORY CREATION
 * ============================================================
 */

/**
 * Makes sure the data directory exists before accessing files.
 */
async function ensureDataDirectory() {
    await fs.mkdir(
        DATA_DIRECTORY,
        {
            recursive: true,
        }
    );
}

/*
 * ============================================================
 * CLONING
 * ============================================================
 */

/**
 * Safely clones default database values.
 */
function cloneValue(value) {
    if (value === undefined) {
        return {};
    }

    if (
        typeof structuredClone ===
        'function'
    ) {
        return structuredClone(value);
    }

    return JSON.parse(
        JSON.stringify(value)
    );
}

/*
 * ============================================================
 * DATABASE READING
 * ============================================================
 */

/**
 * Reads a JSON database.
 *
 * If the database does not exist, the supplied default value is
 * returned instead.
 */
async function readDatabase(
    databaseName,
    defaultValue = {}
) {
    await ensureDataDirectory();

    const databasePath =
        getDatabasePath(databaseName);

    try {
        const fileContents =
            await fs.readFile(
                databasePath,
                'utf8'
            );

        if (!fileContents.trim()) {
            return cloneValue(
                defaultValue
            );
        }

        return JSON.parse(
            fileContents
        );
    } catch (error) {
        if (error.code === 'ENOENT') {
            return cloneValue(
                defaultValue
            );
        }

        if (
            error instanceof SyntaxError
        ) {
            throw new Error(
                `The database "${databaseName}" contains invalid JSON.`
            );
        }

        throw error;
    }
}

/*
 * ============================================================
 * DATABASE WRITING
 * ============================================================
 */

/**
 * Writes data to a JSON database.
 *
 * Data is written to a temporary file first to reduce the chance
 * of database corruption.
 */
async function writeDatabase(
    databaseName,
    data
) {
    await ensureDataDirectory();

    const databasePath =
        getDatabasePath(databaseName);

    const temporaryPath =
        `${databasePath}.tmp`;

    const serializedData =
        JSON.stringify(
            data,
            null,
            4
        );

    await fs.writeFile(
        temporaryPath,
        serializedData,
        'utf8'
    );

    try {
        await fs.rename(
            temporaryPath,
            databasePath
        );
    } catch (error) {
        /*
         * Windows may refuse to rename over an existing file.
         * Delete the previous file and retry when necessary.
         */

        if (
            error.code === 'EEXIST' ||
            error.code === 'EPERM'
        ) {
            try {
                await fs.unlink(
                    databasePath
                );
            } catch (
                unlinkError
            ) {
                if (
                    unlinkError.code !==
                    'ENOENT'
                ) {
                    throw unlinkError;
                }
            }

            await fs.rename(
                temporaryPath,
                databasePath
            );
        } else {
            throw error;
        }
    }

    return data;
}

/*
 * ============================================================
 * DATABASE UPDATES
 * ============================================================
 */

/**
 * Updates a database safely.
 *
 * This function supports both formats used throughout the bot:
 *
 * 1. Updater function:
 *
 * updateDatabase(
 *     'staff-records',
 *     (database) => {
 *         database.records.push(record);
 *         return database;
 *     }
 * );
 *
 * 2. Complete replacement object:
 *
 * updateDatabase(
 *     'staff-records',
 *     database
 * );
 *
 * Supporting both formats prevents older and newer commands from
 * conflicting with one another.
 */
async function updateDatabase(
    databaseName,
    updaterOrData,
    defaultValue = {}
) {
    /*
     * Format 1:
     * The caller provided an updater callback.
     */

    if (
        typeof updaterOrData ===
        'function'
    ) {
        const currentData =
            await readDatabase(
                databaseName,
                defaultValue
            );

        const updatedData =
            await updaterOrData(
                currentData
            );

        if (
            updatedData ===
            undefined
        ) {
            throw new Error(
                `The updater for "${databaseName}" returned undefined.`
            );
        }

        await writeDatabase(
            databaseName,
            updatedData
        );

        return updatedData;
    }

    /*
     * Format 2:
     * The caller provided the complete database object directly.
     *
     * This is the format currently used by saveMovement().
     */

    if (
        updaterOrData === null ||
        typeof updaterOrData !==
            'object'
    ) {
        throw new TypeError(
            'The database update must be an updater function, object, or array.'
        );
    }

    await writeDatabase(
        databaseName,
        updaterOrData
    );

    return updaterOrData;
}

/*
 * ============================================================
 * DATABASE DELETION
 * ============================================================
 */

/**
 * Deletes an entire database file.
 *
 * Returns true when a file was deleted.
 * Returns false when the file did not exist.
 */
async function deleteDatabase(
    databaseName
) {
    const databasePath =
        getDatabasePath(databaseName);

    try {
        await fs.unlink(
            databasePath
        );

        return true;
    } catch (error) {
        if (
            error.code === 'ENOENT'
        ) {
            return false;
        }

        throw error;
    }
}

/*
 * ============================================================
 * DATABASE EXISTENCE
 * ============================================================
 */

/**
 * Checks whether a database file currently exists.
 */
async function databaseExists(
    databaseName
) {
    const databasePath =
        getDatabasePath(databaseName);

    try {
        await fs.access(
            databasePath
        );

        return true;
    } catch (error) {
        if (
            error.code === 'ENOENT'
        ) {
            return false;
        }

        throw error;
    }
}

/*
 * ============================================================
 * RECORD IDS
 * ============================================================
 */

/**
 * Creates a unique record ID.
 *
 * Example:
 * movement-1721623456789-a8k2mz
 */
function createRecordId(
    prefix = 'record'
) {
    const safePrefix =
        String(prefix)
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9-_]/g,
                '-'
            ) || 'record';

    const timestamp =
        Date.now();

    const randomSection =
        Math.random()
            .toString(36)
            .slice(2, 8);

    return (
        `${safePrefix}-` +
        `${timestamp}-` +
        `${randomSection}`
    );
}

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    DATA_DIRECTORY,

    getDatabasePath,
    ensureDataDirectory,

    readDatabase,
    writeDatabase,
    updateDatabase,

    deleteDatabase,
    databaseExists,

    createRecordId,
};
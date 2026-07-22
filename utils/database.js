const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_DIRECTORY = path.join(process.cwd(), 'data');

/**
 * Converts a database name into a safe JSON file path.
 *
 * Example:
 * getDatabasePath('staff-records')
 * becomes:
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

/**
 * Makes sure the data folder exists.
 */
async function ensureDataDirectory() {
    await fs.mkdir(DATA_DIRECTORY, {
        recursive: true,
    });
}

/**
 * Reads a JSON database.
 *
 * If the database does not exist yet, the supplied default value
 * is returned instead.
 */
async function readDatabase(
    databaseName,
    defaultValue = {}
) {
    await ensureDataDirectory();

    const databasePath = getDatabasePath(databaseName);

    try {
        const fileContents = await fs.readFile(
            databasePath,
            'utf8'
        );

        if (!fileContents.trim()) {
            return structuredClone(defaultValue);
        }

        return JSON.parse(fileContents);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return structuredClone(defaultValue);
        }

        if (error instanceof SyntaxError) {
            throw new Error(
                `The database "${databaseName}" contains invalid JSON.`
            );
        }

        throw error;
    }
}

/**
 * Saves information to a JSON database.
 */
async function writeDatabase(databaseName, data) {
    await ensureDataDirectory();

    const databasePath = getDatabasePath(databaseName);
    const temporaryPath = `${databasePath}.tmp`;

    const serializedData = JSON.stringify(
        data,
        null,
        4
    );

    /*
     * Write to a temporary file first.
     * This helps reduce the risk of corrupting the main file if
     * the process stops while data is being saved.
     */
    await fs.writeFile(
        temporaryPath,
        serializedData,
        'utf8'
    );

    await fs.rename(
        temporaryPath,
        databasePath
    );

    return data;
}

/**
 * Updates a database safely.
 *
 * The callback receives the current database contents.
 * Whatever the callback returns becomes the new saved data.
 */
async function updateDatabase(
    databaseName,
    updater,
    defaultValue = {}
) {
    if (typeof updater !== 'function') {
        throw new TypeError(
            'The database updater must be a function.'
        );
    }

    const currentData = await readDatabase(
        databaseName,
        defaultValue
    );

    const updatedData = await updater(currentData);

    if (updatedData === undefined) {
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

/**
 * Deletes a complete database file.
 *
 * This should only be used for resets or development tools.
 */
async function deleteDatabase(databaseName) {
    const databasePath = getDatabasePath(databaseName);

    try {
        await fs.unlink(databasePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }

        throw error;
    }
}

/**
 * Checks whether a database already exists.
 */
async function databaseExists(databaseName) {
    const databasePath = getDatabasePath(databaseName);

    try {
        await fs.access(databasePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }

        throw error;
    }
}

/**
 * Creates a unique record ID.
 *
 * Example:
 * promotion-1721623456789-a8k2mz
 */
function createRecordId(prefix = 'record') {
    const safePrefix = String(prefix)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-');

    const timestamp = Date.now();

    const randomSection = Math.random()
        .toString(36)
        .slice(2, 8);

    return `${safePrefix}-${timestamp}-${randomSection}`;
}

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
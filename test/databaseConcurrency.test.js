const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');

/*
 * Keep concurrency-test files in the operating system's temporary
 * directory so the suite never touches the bot's real data folder.
 */
const originalWorkingDirectory = process.cwd();
process.chdir(os.tmpdir());

const {
    deleteDatabase,
    readDatabase,
    updateDatabase,
    writeDatabase,
} = require('../utils/database');

process.chdir(originalWorkingDirectory);

function uniqueDatabaseName(label) {
    return `test-${label}-${process.pid}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

test('concurrent database updates cannot overwrite one another', async () => {
    const databaseName = uniqueDatabaseName('concurrency');

    try {
        await writeDatabase(databaseName, { count: 0 });

        await Promise.all(
            Array.from({ length: 25 }, () =>
                updateDatabase(
                    databaseName,
                    async (database) => {
                        await Promise.resolve();
                        database.count += 1;
                        return database;
                    },
                    { count: 0 }
                )
            )
        );

        const database = await readDatabase(databaseName, { count: 0 });
        assert.equal(database.count, 25);
    } finally {
        await deleteDatabase(databaseName);
    }
});

test('a failed update does not permanently block later updates', async () => {
    const databaseName = uniqueDatabaseName('recovery');

    try {
        await writeDatabase(databaseName, { healthy: false });

        await assert.rejects(
            updateDatabase(databaseName, () => {
                throw new Error('Expected test failure');
            })
        );

        await updateDatabase(databaseName, (database) => {
            database.healthy = true;
            return database;
        });

        const database = await readDatabase(databaseName);
        assert.equal(database.healthy, true);
    } finally {
        await deleteDatabase(databaseName);
    }
});

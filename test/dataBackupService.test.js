const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
    createDataBackup,
    listBackupDirectories,
    pruneDataBackups,
} = require('../services/dataBackupService');

test('data backups copy JSON records with a manifest', async () => {
    const root = await fs.mkdtemp(
        path.join(os.tmpdir(), 'isrp-backup-test-')
    );
    const sourceDirectory = path.join(root, 'data');
    const backupDirectory = path.join(
        root,
        'backups'
    );

    try {
        await fs.mkdir(sourceDirectory);
        await fs.writeFile(
            path.join(sourceDirectory, 'cases.json'),
            '{"records":[]}',
            'utf8'
        );
        await fs.writeFile(
            path.join(sourceDirectory, 'ignored.txt'),
            'not private bot JSON',
            'utf8'
        );

        const result = await createDataBackup({
            sourceDirectory,
            backupDirectory,
            retention: 5,
        });

        assert.equal(result.status, 'created');
        assert.equal(result.fileCount, 1);
        assert.deepEqual(result.files, [
            'cases.json',
        ]);

        const copied = await fs.readFile(
            path.join(
                result.backupPath,
                'cases.json'
            ),
            'utf8'
        );
        const manifest = JSON.parse(
            await fs.readFile(
                path.join(
                    result.backupPath,
                    'manifest.json'
                ),
                'utf8'
            )
        );

        assert.equal(copied, '{"records":[]}');
        assert.equal(manifest.fileCount, 1);
    } finally {
        await fs.rm(root, {
            recursive: true,
            force: true,
        });
    }
});

test('backup retention removes only expired snapshot directories', async () => {
    const root = await fs.mkdtemp(
        path.join(os.tmpdir(), 'isrp-retention-test-')
    );
    const names = [
        'backup-2026-08-01T00-00-00-000Z',
        'backup-2026-08-02T00-00-00-000Z',
        'backup-2026-08-03T00-00-00-000Z',
    ];

    try {
        for (const name of names) {
            await fs.mkdir(path.join(root, name));
        }
        await fs.mkdir(
            path.join(root, 'do-not-remove')
        );

        const removed = await pruneDataBackups({
            backupDirectory: root,
            retention: 2,
        });
        const remaining =
            await listBackupDirectories(root);

        assert.deepEqual(removed, [names[0]]);
        assert.deepEqual(remaining, [
            names[2],
            names[1],
        ]);
        await assert.doesNotReject(
            fs.access(
                path.join(root, 'do-not-remove')
            )
        );
    } finally {
        await fs.rm(root, {
            recursive: true,
            force: true,
        });
    }
});

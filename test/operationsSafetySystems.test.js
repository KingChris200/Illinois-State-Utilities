const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PermissionFlagsBits,
} = require('discord.js');

const backupCommand = require('../commands/management/backup');
const doctorCommand = require('../commands/management/doctor');
const {
    checkChannel,
    checkErlcReadiness,
} = require('../services/configurationDoctor');

test('ER:LC doctor reports safe mock readiness without exposing credentials', () => {
    const previousMock =
        process.env.ERLC_MOCK_MODE;
    const previousDry =
        process.env.ERLC_DRY_RUN;
    const previousKey =
        process.env.ERLC_SERVER_KEY;

    try {
        process.env.ERLC_MOCK_MODE = 'true';
        process.env.ERLC_DRY_RUN = 'false';
        process.env.ERLC_SERVER_KEY =
            'secret-value-that-must-not-appear';

        const check = checkErlcReadiness();

        assert.equal(check.status, 'warning');
        assert.match(check.detail, /mock mode/i);
        assert.doesNotMatch(
            check.detail,
            /secret-value/
        );
    } finally {
        restoreEnvironment(
            'ERLC_MOCK_MODE',
            previousMock
        );
        restoreEnvironment(
            'ERLC_DRY_RUN',
            previousDry
        );
        restoreEnvironment(
            'ERLC_SERVER_KEY',
            previousKey
        );
    }
});

test('configuration doctor detects missing channel permissions', async () => {
    const channelId = '123456789012345678';
    const channel = {
        permissionsFor: () => ({
            has: (permission) =>
                permission !==
                PermissionFlagsBits.EmbedLinks,
        }),
    };
    const guild = {
        members: { me: { id: 'bot' } },
        channels: {
            cache: new Map([
                [channelId, channel],
            ]),
        },
    };

    const check = await checkChannel(guild, {
        name: 'Test Channel',
        id: channelId,
        required: true,
    });

    assert.equal(check.status, 'fail');
    assert.match(check.detail, /Embed Links/);
});

test('backup and doctor slash commands remain private management tools', () => {
    const backup = backupCommand.data.toJSON();
    const doctor = doctorCommand.data.toJSON();

    assert.equal(
        backup.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
    assert.deepEqual(
        backup.options.map(
            (option) => option.name
        ),
        ['status', 'create']
    );
    assert.equal(
        doctor.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    );
});

function restoreEnvironment(name, value) {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

const fs = require('node:fs');
const path = require('node:path');

const {
    isInternalCommandModule,
} = require('../config/internalCommandModules');

const DEFAULT_COMMANDS_PATH = path.join(
    __dirname,
    '..',
    'commands'
);

function discoverCommandFiles(
    commandsPath = DEFAULT_COMMANDS_PATH
) {
    if (!fs.existsSync(commandsPath)) {
        return {
            commandsPath,
            exists: false,
            commandFiles: [],
            internalFiles: [],
        };
    }

    const commandFiles = [];
    const internalFiles = [];
    const commandFolders = fs
        .readdirSync(commandsPath)
        .filter((item) =>
            fs
                .statSync(
                    path.join(commandsPath, item)
                )
                .isDirectory()
        )
        .sort();

    for (const folder of commandFolders) {
        const folderPath = path.join(
            commandsPath,
            folder
        );
        const files = fs
            .readdirSync(folderPath)
            .filter((file) => file.endsWith('.js'))
            .sort();

        for (const file of files) {
            const relativeFilePath =
                `${folder}/${file}`;
            const record = {
                filePath: path.join(folderPath, file),
                relativeFilePath,
            };

            if (
                isInternalCommandModule(
                    relativeFilePath
                )
            ) {
                internalFiles.push(record);
            } else {
                commandFiles.push(record);
            }
        }
    }

    return {
        commandsPath,
        exists: true,
        commandFiles,
        internalFiles,
    };
}

function isValidCommandModule(command) {
    return Boolean(
        command?.data &&
        typeof command.data.toJSON === 'function' &&
        typeof command.execute === 'function'
    );
}

function loadCommandModule(
    filePath,
    { clearCache = true } = {}
) {
    if (clearCache) {
        delete require.cache[
            require.resolve(filePath)
        ];
    }

    return require(filePath);
}

module.exports = {
    DEFAULT_COMMANDS_PATH,
    discoverCommandFiles,
    isValidCommandModule,
    loadCommandModule,
};

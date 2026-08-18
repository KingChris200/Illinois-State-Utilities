const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PROJECT_ROOT = path.join(__dirname, '..');
const SOURCE_DIRECTORIES = [
    'commands',
    'config',
    'events',
    'handlers',
    'prefixCommands',
    'services',
    'utils',
];
const ROOT_FILES = [
    'index.js',
    'deploy-commands.js',
];

const sourceFiles = [
    ...ROOT_FILES.map((file) =>
        path.join(PROJECT_ROOT, file)
    ),
    ...SOURCE_DIRECTORIES.flatMap((directory) =>
        findJavaScriptFiles(
            path.join(PROJECT_ROOT, directory)
        )
    ),
];

const failures = [];

for (const filePath of sourceFiles) {
    try {
        const source = fs.readFileSync(
            filePath,
            'utf8'
        );

        new vm.Script(source, {
            filename: filePath,
        });
    } catch (error) {
        failures.push({ filePath, error });
    }
}

if (failures.length > 0) {
    for (const failure of failures) {
        console.error(
            `❌ ${path.relative(PROJECT_ROOT, failure.filePath)}`
        );
        console.error(failure.error.message);
    }

    process.exitCode = 1;
} else {
    console.log(
        `✅ Syntax checked ${sourceFiles.length} source files.`
    );
}

function findJavaScriptFiles(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        return [];
    }

    return fs
        .readdirSync(directoryPath, {
            withFileTypes: true,
        })
        .sort((left, right) =>
            left.name.localeCompare(right.name)
        )
        .flatMap((entry) => {
            const entryPath = path.join(
                directoryPath,
                entry.name
            );

            if (entry.isDirectory()) {
                return findJavaScriptFiles(entryPath);
            }

            return entry.isFile() &&
                entry.name.endsWith('.js')
                ? [entryPath]
                : [];
        });
}

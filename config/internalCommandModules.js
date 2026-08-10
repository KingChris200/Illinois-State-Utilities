const INTERNAL_COMMAND_MODULES = new Set([
    'cases/casecomponents.js',
    'cases/caseview.js',
    'cases/caseedit.js',
    'cases/caseclose.js',
    'cases/casereopen.js',
    'cases/casevoid.js',
    'cases/casesearch.js',
    'cases/caselist.js',
    'cases/caseexport.js',
]);

function normalizeCommandModulePath(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/^\.\//, '');
}

function isInternalCommandModule(relativePath) {
    return INTERNAL_COMMAND_MODULES.has(
        normalizeCommandModulePath(relativePath)
    );
}

module.exports = {
    INTERNAL_COMMAND_MODULES,
    isInternalCommandModule,
    normalizeCommandModulePath,
};

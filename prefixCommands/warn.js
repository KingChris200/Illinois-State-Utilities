const createPlayerActionCommand = require('../utils/createPlayerActionCommand');

module.exports = createPlayerActionCommand({
    name: 'warn',
    actionName: 'Warn',
    description:
        'Requests confirmation to warn an online player.',
    reasonRequired: true,
    includeReasonInCommand: true,
    cooldownSeconds: 5,
});

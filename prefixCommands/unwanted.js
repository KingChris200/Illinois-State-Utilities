const createPlayerActionCommand = require(
    '../utils/createPlayerActionCommand'
);

module.exports = createPlayerActionCommand({
    name: 'unwanted',
    actionName: 'Unwanted',
    description:
        'Requests confirmation to clear an online player’s wanted status.',
    reasonRequired: true,
    cooldownSeconds: 5,
});

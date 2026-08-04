const createPlayerActionCommand = require(
    '../utils/createPlayerActionCommand'
);

module.exports = createPlayerActionCommand({
    name: 'heal',
    actionName: 'Heal',
    description: 'Requests confirmation to heal an online player.',
    cooldownSeconds: 5,
});

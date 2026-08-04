const createPlayerActionCommand = require(
    '../utils/createPlayerActionCommand'
);

module.exports = createPlayerActionCommand({
    name: 'wanted',
    actionName: 'Wanted',
    description:
        'Requests confirmation to mark an online player wanted.',
    reasonRequired: true,
    cooldownSeconds: 5,
});

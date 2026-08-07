const {
    attachOperationsMessage,
    createOperationsDashboard,
    removeOperationsDashboard,
} = require('../utils/operationsDashboardManager');

module.exports = {
    name: 'operations',
    aliases: ['ops'],
    description:
        'Opens the interactive ER:LC operations dashboard.',
    usage: '?operations',
    cooldownSeconds: 10,

    async execute({ message, config }) {
        const dashboard = await createOperationsDashboard({
            executorId: message.author.id,
            executorMention: `${message.author}`,
            client: message.client,
            guild: message.guild,
            config,
        });

        try {
            const dashboardMessage = await message.reply({
                embeds: [dashboard.embed],
                components: [dashboard.components],
                allowedMentions: { parse: [] },
            });
            attachOperationsMessage(
                dashboard.id,
                dashboardMessage
            );
        } catch (error) {
            removeOperationsDashboard(dashboard.id);
            throw error;
        }
    },
};

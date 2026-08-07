const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');
const {
    cleanInlineCode,
    cleanMarkdownText,
    parseActivityCount,
} = require('../utils/erlcActivityUtils');

module.exports = {
    name: 'vehicles',
    description: 'Shows vehicles currently spawned in ER:LC.',
    usage: '?vehicles [1-10]',
    cooldownSeconds: 8,

    async execute({ message, args }) {
        const count = parseActivityCount(args[0]);

        if (count === null) {
            await message.reply('Usage: `?vehicles [1-10]`');
            return;
        }

        const vehicles = await erlcService.getVehicles();
        const visibleVehicles = vehicles.slice(0, count);
        const embed = createEmbed(
            `Active Vehicles — ${vehicles.length}`,
            'isrp'
        ).setDescription(
            vehicles.length
                ? `Showing ${visibleVehicles.length} of ${vehicles.length} currently spawned vehicles.`
                : '*No active vehicles were returned.*'
        );

        if (visibleVehicles.length) {
            embed.addFields(
                ...visibleVehicles.map(formatVehicle)
            );
        }

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

function formatVehicle(vehicle, index) {
    const name = cleanMarkdownText(
        vehicle?.Name || 'Unknown Vehicle',
        80
    );
    const owner = cleanMarkdownText(vehicle?.Owner, 40);
    const plate = cleanInlineCode(vehicle?.Plate, 20);
    const texture = cleanMarkdownText(
        vehicle?.Texture || 'Standard',
        80
    );
    const colorName = cleanMarkdownText(
        vehicle?.ColorName || 'Unknown',
        40
    );
    const colorHex = cleanInlineCode(
        vehicle?.ColorHex || 'Unknown',
        12
    );

    return {
        name: `${index + 1}. ${name}`,
        value: [
            `Owner: **${owner}**`,
            `Plate: \`${plate}\``,
            `Livery: ${texture}`,
            `Color: ${colorName} · \`${colorHex}\``,
        ].join('\n'),
    };
}

module.exports.formatVehicle = formatVehicle;

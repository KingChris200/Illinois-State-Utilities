const erlcService = require('../services/erlcService');
const createEmbed = require('../utils/createEmbed');

const STAFF_GROUPS = [
    ['Admins', 'Server Administrators'],
    ['Mods', 'Moderators'],
    ['Helpers', 'Helpers'],
];

module.exports = {
    name: 'staff',
    description: 'Lists staff currently in the ER:LC server.',
    usage: '?staff',
    cooldownSeconds: 5,

    async execute({ message }) {
        const staff = await erlcService.getStaff();
        const groups = STAFF_GROUPS.map(([key, label]) => ({
            label,
            count: Object.keys(staff[key] || {}).length,
            members: formatStaffGroup(staff[key]),
        }));
        const total = groups.reduce(
            (sum, group) => sum + group.count,
            0
        );
        const embed = createEmbed(
            `In-Game Staff — ${total}`,
            'isrp',
            {
                guild: message.guild,
                client: message.client,
            }
        )
            .setDescription(
                total
                    ? 'Staff currently visible in the ER:LC private server.'
                    : 'No in-game staff are currently visible.'
            )
            .addFields(
                ...groups.map((group) => ({
                    name: `${group.label} — ${group.count}`,
                    value:
                        group.members.join('\n') ||
                        '*None online*',
                })),
                {
                    name: 'Data Source',
                    value: erlcService.isMockMode()
                        ? '🧪 Mock server data'
                        : '🟢 Live ER:LC API',
                    inline: true,
                }
            );

        await message.reply({
            embeds: [embed],
            allowedMentions: { parse: [] },
        });
    },
};

function formatStaffGroup(group) {
    const entries = Object.entries(group || {});
    const lines = entries
        .slice(0, 12)
        .map(
            ([userId, username]) =>
                `• **${cleanText(username, 24)}** · \`${cleanText(userId, 20)}\``
        );

    if (entries.length > lines.length) {
        lines.push(`*…and ${entries.length - lines.length} more*`);
    }

    return lines;
}

function cleanText(value, maximumLength) {
    return String(value || 'Unknown')
        .replace(/[*_~`|>\\]/g, '\\$&')
        .slice(0, maximumLength);
}

module.exports.formatStaffGroup = formatStaffGroup;

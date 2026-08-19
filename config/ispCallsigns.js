const {
    ISP_CHANNELS,
    ISP_SERVER_ID,
    ISP_RANKS,
} = require('./serverConfigs');
const shiftConfig = require('./ispShift');

function roleId(rankName) {
    return ISP_RANKS.find((rank) => rank.name === rankName)?.roleId || null;
}

const sections = [
    {
        id: 'directorate',
        name: 'Directorate',
        minimum: 1,
        maximum: 10,
        roleIds: [
            roleId('ISP | Director'),
            roleId('ISP | First Deputy Director'),
            roleId('ISP | Deputy Director'),
            shiftConfig.managementRoleId,
        ].filter(Boolean),
    },
    {
        id: 'command',
        name: 'Command',
        minimum: 11,
        maximum: 19,
        roleIds: [
            roleId('ISP | Colonel'),
            roleId('ISP | Lieutenant Colonel'),
        ].filter(Boolean),
    },
    {
        id: 'high_rank',
        name: 'High Rank',
        minimum: 20,
        maximum: 35,
        roleIds: [
            roleId('ISP | Major'),
            roleId('ISP | Captain'),
            roleId('ISP | Lieutenant'),
        ].filter(Boolean),
    },
    {
        id: 'sergeants',
        name: 'Sergeants',
        minimum: 36,
        maximum: 60,
        roleIds: [
            roleId('ISP | Master Sergeant'),
            roleId('ISP | Sergeant'),
        ].filter(Boolean),
    },
    {
        id: 'patrol',
        name: 'Patrol',
        minimum: 61,
        maximum: 250,
        roleIds: [
            roleId('ISP | Senior Trooper'),
            roleId('ISP | Trooper'),
            roleId('ISP | Cadet'),
        ].filter(Boolean),
    },
];

module.exports = {
    guildId: ISP_SERVER_ID,
    callsignPrefix: 'ISP',
    managementRoleId: shiftConfig.managementRoleId,
    commandChannelId: ISP_CHANNELS.deputyCommand,
    logChannelId: shiftConfig.shiftLogChannelId,
    sections,
};

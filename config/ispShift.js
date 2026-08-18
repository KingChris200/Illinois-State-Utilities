const { ISP_SERVER_ID } = require('./serverConfigs');

const MINUTE_MS = 60 * 1000;

module.exports = {
    guildId: ISP_SERVER_ID,
    managementRoleId: '1527518424060792872',
    onDutyRoleId: '1539069939468738590',
    onBreakRoleId: '1539074734963294238',
    shiftLogChannelId: '1527524431642104039',
    shiftManageChannelId: '1527524104209567824',
    shiftAdministrationChannelId: '1527524291829174365',

    // One weekly shift wave. Change this single value if ISP policy changes.
    weeklyQuotaMs: 120 * MINUTE_MS,
    promotionCooldownDays: 14,
};

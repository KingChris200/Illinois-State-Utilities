/*
 * ============================================================
 * ILLINOIS STATE UTILITIES
 * MULTI-SERVER CONFIGURATION
 * ============================================================
 *
 * This file allows one bot to operate differently depending
 * on the Discord server where a command is used.
 *
 * Rank arrays must always be ordered:
 *
 * LOWEST RANK → HIGHEST RANK
 *
 * Role IDs remain valid even when the visible Discord role
 * names are changed.
 */

/*
 * The main Illinois State Roleplay server ID has not yet been
 * provided, so it is loaded from the .env file.
 *
 * Add this to your .env:
 *
 * MAIN_SERVER_ID=YOUR_MAIN_SERVER_ID
 */

const MAIN_SERVER_ID =
    process.env.MAIN_SERVER_ID;

const ISP_SERVER_ID =
    '1527511728169025658';

/*
 * ============================================================
 * MAIN SERVER RANKS
 * ============================================================
 */

const MAIN_SERVER_RANKS = [
    {
        name: 'Trial Moderator',
        roleId: '1490524523794268250',
    },
    {
        name: 'Senior Moderator',
        roleId: '1490524339550949580',
    },
    {
        name: 'Community Moderator',
        roleId: '1490524276820807710',
    },

    {
        name: 'Junior Staff Supervisor',
        roleId: '1510594647766990988',
    },
    {
        name: 'Senior Staff Supervisor',
        roleId: '1510602643016388728',
    },
    {
        name: 'Head Staff Supervisor',
        roleId: '1490523702142701811',
    },

    {
        name: 'Junior Manager',
        roleId: '1490885470522183740',
    },
    {
        name: 'Manager',
        roleId: '1510594665852829716',
    },
    {
        name: 'Senior Manager',
        roleId: '1490523518901813339',
    },

    {
        name: 'Junior Internal Affairs',
        roleId: '1526344620844253325',
    },
    {
        name: 'Senior Internal Affairs',
        roleId: '1526344724238307459',
    },
    {
        name: 'Superior Internal Affairs',
        roleId: '1526345126794756156',
    },

    {
        name: 'Assistant Server Director',
        roleId: '1490523390778544291',
    },
    {
        name: 'Deputy Server Director',
        roleId: '1490523081129857196',
    },
    {
        name: 'Server Director',
        roleId: '1491215580223639604',
    },

    {
        name: 'Assistant Owner',
        roleId: '1490522983947698349',
    },
    {
        name: 'Owner',
        roleId: '1490522930608738406',
    },
];

/*
 * ============================================================
 * ISP RANKS
 * ============================================================
 *
 * These names use the new ISP branding.
 *
 * The Discord role IDs will continue working even if you have
 * not finished renaming every role yet.
 */

const ISP_RANKS = [
    {
        name: 'ISP | Cadet',
        roleId: '1527514984408678481',
    },
    {
        name: 'ISP | Trooper',
        roleId: '1527514983670349927',
    },
    {
        name: 'ISP | Senior Trooper',
        roleId: '1527515048375750670',
    },

    {
        name: 'ISP | Sergeant',
        roleId: '1527514685228847255',
    },
    {
        name: 'ISP | Master Sergeant',
        roleId: '1527514686667624548',
    },

    {
        name: 'ISP | Lieutenant',
        roleId: '1527514684385923082',
    },
    {
        name: 'ISP | Captain',
        roleId: '1527514683601584206',
    },
    {
        name: 'ISP | Major',
        roleId: '1527514682896810024',
    },

    {
        name: 'ISP | Lieutenant Colonel',
        roleId: '1527514682166870046',
    },
    {
        name: 'ISP | Colonel',
        roleId: '1527517875882033246',
    },

    {
        name: 'ISP | Deputy Director',
        roleId: '1527514681969999882',
    },
    {
        name: 'ISP | First Deputy Director',
        roleId: '1528212634044989481',
    },
    {
        name: 'ISP | Director',
        roleId: '1527514675443535982',
    },
];

/*
 * ============================================================
 * SERVER CONFIGURATIONS
 * ============================================================
 */

const SERVER_CONFIGS = {
    /*
     * Main Illinois State Roleplay server
     */

    ...(MAIN_SERVER_ID
        ? {
              [MAIN_SERVER_ID]: {
                  key: 'main',

                  serverName:
                      'Illinois State Roleplay',

                  shortName: 'ISRP',

                  departmentName:
                      'Illinois State Roleplay Staff Team',

                  brandColor: 0x2b2d31,

                  ranks: MAIN_SERVER_RANKS,

                  channels: {
                      /*
                       * Replace these later if your existing
                       * /setup configuration should not be used.
                       */

                      promotions: null,
                      demotions: null,
                      infractions: null,
                      movements:
                          '1490759095500800190',
                  },

                  roleGroups: {
                      ownershipTeam:
                          '1520179382407266354',

                      directorTeam:
                          '1490808065514016887',

                      internalAffairsTeam:
                          '1526344302618218656',

                      managementBoard:
                          '1490523581187231795',

                      supervisoryBoard:
                          '1490523797629960392',

                      moderationBoard:
                          '1520521292711854283',

                      serverStaffTeam:
                          '1490847791940112485',

                      trainingAndEducation:
                          '1490884232380420106',
                  },

                  reviewerRoleIds: [
                      '1520179382407266354',
                      '1490522930608738406',
                      '1490522983947698349',

                      '1491215580223639604',
                      '1490523081129857196',
                      '1490523390778544291',
                      '1490808065514016887',

                      '1526345126794756156',
                      '1526344724238307459',
                      '1526344620844253325',
                      '1526344302618218656',

                      '1490523518901813339',
                      '1510594665852829716',
                      '1490885470522183740',
                      '1490523581187231795',

                      '1490523702142701811',
                      '1510602643016388728',
                      '1510594647766990988',
                      '1490523797629960392',
                  ],

                  embedTitles: {
                      promotion:
                          'ISRP | Staff Promotion',

                      demotion:
                          'ISRP | Staff Demotion',

                      movement:
                          'ISRP | Staff Movement',
                  },

                  messages: {
                      promotionOpening:
                          'Congratulations on receiving a staff promotion within Illinois State Roleplay!',

                      promotionClosing:
                          'Thank you for your continued dedication, professionalism, and service to Illinois State Roleplay.',

                      demotionOpening:
                          'A staff rank adjustment has been issued within Illinois State Roleplay.',

                      demotionClosing:
                          'Please review all expectations associated with your newly assigned rank.',
                  },
              },
          }
        : {}),

    /*
     * Illinois State Police server
     */

    [ISP_SERVER_ID]: {
        key: 'isp',

        serverName:
            'Illinois State Police',

        shortName: 'ISP',

        departmentName:
            'Illinois State Police',

        brandColor: 0x17365d,

        ranks: ISP_RANKS,

        channels: {
            promotions:
                '1527521493087682590',

            /*
             * Promotions will use the supplied channel.
             * Until separate channels are supplied, demotions
             * and general movements can use the same channel.
             */

            demotions:
                '1527521493087682590',

            infractions:
                '1527521493087682590',

            movements:
                '1527521493087682590',
        },

        /*
         * Organizational and category roles.
         *
         * These roles are not selectable ranks because they
         * represent teams, offices, divisions, or statuses.
         */

        roleGroups: {
            officeOfDirectors:
                '1527518424060792872',

            officeOfColonels:
                '1527517924066066513',

            highRankingOfficials:
                '1527517572226875452',

            fieldSupervisor:
                '1527517164599251015',

            patrolUnits:
                '1527518708707098737',

            inTraining:
                '1527518789455974480',

            illinoisStatePolice:
                '1528167620845506791',

            civilian:
                '1527520680961118298',

            leaveOfAbsence:
                '1528204753878782025',

            highSpeedUnit:
                '1528183195684704469',

            hsuDirector:
                '1528183256858759208',

            hsuAssistantDirector:
                '1528183377591668887',

            hsuWorker:
                '1528183624439042276',

            hsuDivision:
                '1528183742403969084',
        },

        /*
         * ISP reviewer permissions.
         *
         * These ranks can perform protected movement actions.
         * We can tighten or expand this list later.
         */

        reviewerRoleIds: [
            '1527514675443535982',
            '1528212634044989481',
            '1527514681969999882',

            '1527517875882033246',
            '1527514682166870046',

            '1527514682896810024',
            '1527514683601584206',
        ],

        embedTitles: {
            promotion:
                'ISP | Personnel Promotion',

            demotion:
                'ISP | Personnel Demotion',

            movement:
                'ISP | Personnel Movement',
        },

        messages: {
            promotionOpening:
                'Please join us in congratulating this member on their promotion within the Illinois State Police.',

            promotionClosing:
                'Your continued professionalism, leadership, and dedication to the Illinois State Police are greatly appreciated.',

            demotionOpening:
                'A personnel rank adjustment has been formally issued within the Illinois State Police.',

            demotionClosing:
                'Please review the duties, responsibilities, and expectations associated with your assigned rank.',
        },
    },
};

/*
 * ============================================================
 * CONFIGURATION HELPERS
 * ============================================================
 */

/**
 * Return the complete configuration for a Discord guild.
 *
 * @param {string} guildId Discord guild ID.
 * @returns {object|null}
 */

function getServerConfig(guildId) {
    if (!guildId) {
        return null;
    }

    return SERVER_CONFIGS[guildId] || null;
}

/**
 * Return the configured hierarchy for a guild.
 *
 * @param {string} guildId Discord guild ID.
 * @returns {Array<{name: string, roleId: string}>}
 */

function getGuildRanks(guildId) {
    return getServerConfig(guildId)?.ranks || [];
}

/**
 * Return only the rank names for a guild.
 *
 * @param {string} guildId Discord guild ID.
 * @returns {string[]}
 */

function getGuildRankNames(guildId) {
    return getGuildRanks(guildId).map(
        (rank) => rank.name
    );
}

/**
 * Find a configured rank by its visible name.
 *
 * Rank-name comparisons are case-insensitive.
 *
 * @param {string} guildId Discord guild ID.
 * @param {string} rankName Visible rank name.
 * @returns {{name: string, roleId: string}|null}
 */

function findGuildRank(
    guildId,
    rankName
) {
    if (!rankName) {
        return null;
    }

    const normalizedRankName =
        rankName.trim().toLowerCase();

    return (
        getGuildRanks(guildId).find(
            (rank) =>
                rank.name
                    .toLowerCase() ===
                normalizedRankName
        ) || null
    );
}

/**
 * Return the hierarchy index for a rank.
 *
 * Since ranks are ordered lowest to highest:
 *
 * Higher number = higher rank
 * Lower number = lower rank
 *
 * @param {string} guildId Discord guild ID.
 * @param {string} rankName Visible rank name.
 * @returns {number}
 */

function getGuildRankIndex(
    guildId,
    rankName
) {
    return getGuildRankNames(
        guildId
    ).findIndex(
        (configuredRankName) =>
            configuredRankName.toLowerCase() ===
            String(rankName)
                .trim()
                .toLowerCase()
    );
}

/**
 * Determine whether a guild is supported.
 *
 * @param {string} guildId Discord guild ID.
 * @returns {boolean}
 */

function isSupportedGuild(guildId) {
    return Boolean(
        getServerConfig(guildId)
    );
}

/**
 * Return autocomplete-ready choices for a guild.
 *
 * Discord permits a maximum of 25 autocomplete results.
 *
 * @param {string} guildId Discord guild ID.
 * @param {string} focusedValue Text currently entered by user.
 * @returns {Array<{name: string, value: string}>}
 */

function getRankAutocompleteChoices(
    guildId,
    focusedValue = ''
) {
    const normalizedSearch =
        String(focusedValue)
            .trim()
            .toLowerCase();

    return getGuildRanks(guildId)
        .filter((rank) => {
            if (!normalizedSearch) {
                return true;
            }

            return rank.name
                .toLowerCase()
                .includes(
                    normalizedSearch
                );
        })
        .slice(0, 25)
        .map((rank) => ({
            name: rank.name,
            value: rank.name,
        }));
}

/**
 * Check whether a member has an authorized reviewer role.
 *
 * @param {import('discord.js').GuildMember|null} member
 * @param {string} guildId
 * @returns {boolean}
 */

function memberCanReviewMovements(
    member,
    guildId
) {
    if (!member) {
        return false;
    }

    const serverConfig =
        getServerConfig(guildId);

    if (!serverConfig) {
        return false;
    }

    return member.roles.cache.some(
        (role) =>
            serverConfig.reviewerRoleIds.includes(
                role.id
            )
    );
}

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    MAIN_SERVER_ID,
    ISP_SERVER_ID,

    MAIN_SERVER_RANKS,
    ISP_RANKS,

    SERVER_CONFIGS,

    getServerConfig,
    getGuildRanks,
    getGuildRankNames,
    findGuildRank,
    getGuildRankIndex,
    isSupportedGuild,
    getRankAutocompleteChoices,
    memberCanReviewMovements,
};
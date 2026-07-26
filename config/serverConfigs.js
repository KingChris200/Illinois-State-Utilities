/*
 * ============================================================
 * ILLINOIS STATE UTILITIES
 * MULTI-SERVER CONFIGURATION
 * ============================================================
 *
 * Rank arrays must always be ordered:
 *
 * LOWEST RANK → HIGHEST RANK
 */

/*
 * ============================================================
 * SERVER IDS
 * ============================================================
 */

const MAIN_SERVER_ID =
    '1377060744596771483';

const ISP_SERVER_ID =
    '1527511728169025658';

/*
 * ============================================================
 * ISRP CHANNEL IDS
 * ============================================================
 */

const ISRP_CHANNELS = {
    promotions:
        '1490759034847105196',

    demotions:
        '1490759095500800190',

    infractions:
        '1490759095500800190',

    movements:
        '1490759095500800190',
};

/*
 * ============================================================
 * ISP CHANNEL IDS
 * ============================================================
 */

const ISP_CHANNELS = {
    promotions:
        '1527521493087682590',

    demotions:
        '1527521493087682590',

    infractions:
        '1527521493087682590',

    movements:
        '1527521493087682590',
};

/*
 * ============================================================
 * ISRP STAFF RANKS
 * ============================================================
 *
 * Ordered from lowest to highest.
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
 * ISP PERSONNEL RANKS
 * ============================================================
 *
 * Ordered from lowest to highest.
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
     * ========================================================
     * ILLINOIS STATE ROLEPLAY
     * ========================================================
     */

    [MAIN_SERVER_ID]: {
        key: 'main',

        serverName:
            'Illinois State Roleplay',

        shortName:
            'ISRP',

        departmentName:
            'Illinois State Roleplay Staff Team',

        brandColor:
            0x2b2d31,

        ranks:
            MAIN_SERVER_RANKS,

        channels:
            ISRP_CHANNELS,

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
            /*
             * Ownership
             */

            '1520179382407266354',
            '1490522930608738406',
            '1490522983947698349',

            /*
             * Directorate
             */

            '1491215580223639604',
            '1490523081129857196',
            '1490523390778544291',
            '1490808065514016887',

            /*
             * Internal Affairs
             */

            '1526345126794756156',
            '1526344724238307459',
            '1526344620844253325',
            '1526344302618218656',

            /*
             * Management
             */

            '1490523518901813339',
            '1510594665852829716',
            '1490885470522183740',
            '1490523581187231795',

            /*
             * Staff Supervisory
             */

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

            infraction:
                'ISRP | Staff Infraction',

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

            infractionOpening:
                'A staff disciplinary action has been formally recorded within Illinois State Roleplay.',

            infractionClosing:
                'Please review the reason and expectations associated with this disciplinary action.',
        },
    },

    /*
     * ========================================================
     * ILLINOIS STATE POLICE
     * ========================================================
     */

    [ISP_SERVER_ID]: {
        key: 'isp',

        serverName:
            'Illinois State Police',

        shortName:
            'ISP',

        departmentName:
            'Illinois State Police',

        brandColor:
            0x17365d,

        ranks:
            ISP_RANKS,

        channels:
            ISP_CHANNELS,

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

        reviewerRoleIds: [
            /*
             * ISP Directorate
             */

            '1527514675443535982',
            '1528212634044989481',
            '1527514681969999882',

            /*
             * ISP Command
             */

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

            infraction:
                'ISP | Personnel Infraction',

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

            infractionOpening:
                'A personnel disciplinary action has been formally recorded within the Illinois State Police.',

            infractionClosing:
                'Please review the reason and expectations associated with this disciplinary action.',
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
 * @param {string} guildId
 * @returns {object|null}
 */
function getServerConfig(guildId) {
    if (!guildId) {
        return null;
    }

    return (
        SERVER_CONFIGS[
            String(guildId)
        ] || null
    );
}

/**
 * Return the configured ranks for a guild.
 *
 * @param {string} guildId
 * @returns {Array<{name: string, roleId: string}>}
 */
function getGuildRanks(guildId) {
    return (
        getServerConfig(guildId)
            ?.ranks || []
    );
}

/**
 * Return the configured rank names.
 *
 * @param {string} guildId
 * @returns {string[]}
 */
function getGuildRankNames(guildId) {
    return getGuildRanks(
        guildId
    ).map(
        (rank) => rank.name
    );
}

/**
 * Find a configured rank by name.
 *
 * Rank comparisons are case-insensitive.
 *
 * @param {string} guildId
 * @param {string} rankName
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
        String(rankName)
            .trim()
            .toLowerCase();

    return (
        getGuildRanks(
            guildId
        ).find(
            (rank) =>
                rank.name
                    .toLowerCase() ===
                normalizedRankName
        ) || null
    );
}

/**
 * Return a rank's hierarchy index.
 *
 * @param {string} guildId
 * @param {string} rankName
 * @returns {number}
 */
function getGuildRankIndex(
    guildId,
    rankName
) {
    if (!rankName) {
        return -1;
    }

    const normalizedRankName =
        String(rankName)
            .trim()
            .toLowerCase();

    return getGuildRankNames(
        guildId
    ).findIndex(
        (configuredRankName) =>
            configuredRankName
                .toLowerCase() ===
            normalizedRankName
    );
}

/**
 * Check whether a server is supported.
 *
 * @param {string} guildId
 * @returns {boolean}
 */
function isSupportedGuild(guildId) {
    return Boolean(
        getServerConfig(
            guildId
        )
    );
}

/**
 * Return autocomplete-ready rank choices.
 *
 * Discord allows up to 25 autocomplete results.
 *
 * @param {string} guildId
 * @param {string} focusedValue
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

    return getGuildRanks(
        guildId
    )
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
            name:
                rank.name,

            value:
                rank.name,
        }));
}

/**
 * Check whether a member holds an authorized reviewer role.
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
        getServerConfig(
            guildId
        );

    if (!serverConfig) {
        return false;
    }

    return member.roles.cache.some(
        (role) =>
            serverConfig
                .reviewerRoleIds
                .includes(role.id)
    );
}

/**
 * Return a configured channel ID.
 *
 * Supported types:
 * promotions, demotions, infractions, movements
 *
 * @param {string} guildId
 * @param {string} channelType
 * @returns {string|null}
 */
function getConfiguredChannelId(
    guildId,
    channelType
) {
    const serverConfig =
        getServerConfig(
            guildId
        );

    if (!serverConfig) {
        return null;
    }

    return (
        serverConfig
            .channels
            ?.[channelType] ||
        null
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

    ISRP_CHANNELS,
    ISP_CHANNELS,

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
    getConfiguredChannelId,
};
/*
 * ============================================================
 * ILLINOIS STATE UTILITIES
 * MULTI-SERVER CONFIGURATION
 * ============================================================
 *
 * IMPORTANT:
 *
 * Rank arrays must always be ordered from:
 *
 * LOWEST RANK → HIGHEST RANK
 *
 * The rank manager uses this order to determine whether a
 * requested change is a promotion or demotion.
 */

/*
 * ============================================================
 * SERVER IDS
 * ============================================================
 */

const MAIN_SERVER_ID =
    '1377060744595771483';

const ISP_SERVER_ID =
    '1527511728169025658';

/*
 * ============================================================
 * CHANNEL IDS
 * ============================================================
 */

const ISRP_CHANNELS = {
    commands:
        '1490733534611116204',

    staffFeedback:
        '1539790036994629792',

    inGameGuidelines:
        '1490680506952712233',

    discordGuidelines:
        '1490680641904185435',

    assistance:
        '1490730143508070540',

    proof:
        '1490733647915913246',

    primary:
        '1490733409037975654',

    inGameChat:
        '1506444257173704704',

    promotions:
        '1490759034847105196',

    demotions:
        '1490759095500800190',

    infractions:
        '1490759095500800190',

};

const ISP_CHANNELS = {
    deputyCommand:
        '1527523195408613406',

    callsignLogs:
        '1527516566818652332',

    promotions:
        '1527521493087682590',

    demotions:
        '1527521493087682590',

    infractions:
        '1527521493087682590',


    shiftLogs:
        '1527524431642104039',

    shiftManage:
        '1527524104209567824',

    shiftAdministration:
        '1527524291829174365',
};

/*
 * ============================================================
 * ISRP RANKS
 * ============================================================
 *
 * Lowest rank to highest rank.
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
 * Lowest rank to highest rank.
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

            onDuty:
                '1539069939468738590',

            onBreak:
                '1539074734963294238',

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
             * Directorate
             */

            '1527514675443535982',
            '1528212634044989481',
            '1527514681969999882',

            /*
             * Command
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
 * NORMALIZATION HELPERS
 * ============================================================
 */

/**
 * Normalize text for rank searching.
 *
 * This removes punctuation, symbols, and repeated spaces.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

/**
 * Return the initials of a rank.
 *
 * Example:
 *
 * Assistant Server Director → asd
 *
 * @param {string} rankName
 * @returns {string}
 */
function getRankInitials(rankName) {
    return normalizeSearchText(rankName)
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0] || '')
        .join('');
}

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
 * Return the configured rank objects for a guild.
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
 * Return only the configured rank names.
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
 * Find a configured rank by its exact visible name.
 *
 * The comparison is case-insensitive and ignores extra spaces.
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
        normalizeSearchText(rankName);

    return (
        getGuildRanks(
            guildId
        ).find(
            (rank) =>
                normalizeSearchText(
                    rank.name
                ) ===
                normalizedRankName
        ) || null
    );
}

/**
 * Return the hierarchy index for a configured rank.
 *
 * Higher index means a higher rank.
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
        normalizeSearchText(rankName);

    return getGuildRankNames(
        guildId
    ).findIndex(
        (configuredRankName) =>
            normalizeSearchText(
                configuredRankName
            ) ===
            normalizedRankName
    );
}

/**
 * Determine whether a Discord guild is supported.
 *
 * @param {string} guildId
 * @returns {boolean}
 */
function isSupportedGuild(guildId) {
    return Boolean(
        getServerConfig(guildId)
    );
}

/*
 * ============================================================
 * AUTOCOMPLETE
 * ============================================================
 */

/**
 * Return autocomplete-ready rank choices.
 *
 * Supports:
 *
 * d
 * director
 * assistant
 * assistant server director
 * asd
 * sd
 *
 * Discord allows a maximum of 25 autocomplete results.
 *
 * @param {string} guildId
 * @param {string} focusedValue
 * @returns {Array<{name: string, value: string}>}
 */
function getRankAutocompleteChoices(
    guildId,
    focusedValue = ''
) {
    const ranks =
        getGuildRanks(guildId);

    if (ranks.length === 0) {
        return [];
    }

    const normalizedSearch =
        normalizeSearchText(
            focusedValue
        );

    /*
     * Display all ranks immediately when the user has not typed
     * anything yet.
     */
    if (!normalizedSearch) {
        return ranks
            .slice(0, 25)
            .map((rank) => ({
                name: rank.name,
                value: rank.name,
            }));
    }

    const searchWords =
        normalizedSearch
            .split(' ')
            .filter(Boolean);

    const rankedResults =
        ranks
            .map((rank, index) => {
                const normalizedRankName =
                    normalizeSearchText(
                        rank.name
                    );

                const rankWords =
                    normalizedRankName
                        .split(' ')
                        .filter(Boolean);

                const initials =
                    getRankInitials(
                        rank.name
                    );

                let score = 0;

                /*
                 * Exact full-rank match.
                 */
                if (
                    normalizedRankName ===
                    normalizedSearch
                ) {
                    score += 1000;
                }

                /*
                 * Full phrase appears in rank.
                 */
                if (
                    normalizedRankName.includes(
                        normalizedSearch
                    )
                ) {
                    score += 500;
                }

                /*
                 * Rank begins with the search phrase.
                 */
                if (
                    normalizedRankName.startsWith(
                        normalizedSearch
                    )
                ) {
                    score += 300;
                }

                /*
                 * Initial matching:
                 *
                 * asd → Assistant Server Director
                 * sd  → Server Director
                 */
                if (
                    initials ===
                    normalizedSearch
                ) {
                    score += 450;
                } else if (
                    initials.startsWith(
                        normalizedSearch
                    )
                ) {
                    score += 250;
                }

                for (
                    const searchWord of
                    searchWords
                ) {
                    /*
                     * A rank word exactly matches the typed word.
                     */
                    if (
                        rankWords.includes(
                            searchWord
                        )
                    ) {
                        score += 100;
                    }

                    /*
                     * A rank word begins with the typed word.
                     */
                    if (
                        rankWords.some(
                            (rankWord) =>
                                rankWord.startsWith(
                                    searchWord
                                )
                        )
                    ) {
                        score += 75;
                    }

                    /*
                     * The typed word appears anywhere.
                     */
                    if (
                        normalizedRankName.includes(
                            searchWord
                        )
                    ) {
                        score += 40;
                    }
                }

                return {
                    rank,
                    score,
                    index,
                };
            })
            .filter(
                (result) =>
                    result.score > 0
            )
            .sort(
                (first, second) => {
                    if (
                        second.score !==
                        first.score
                    ) {
                        return (
                            second.score -
                            first.score
                        );
                    }

                    return (
                        first.index -
                        second.index
                    );
                }
            );

    /*
     * If no text matched, return all ranks instead of making
     * Discord display "No options match your search."
     */
    const results =
        rankedResults.length > 0
            ? rankedResults.map(
                  (result) =>
                      result.rank
              )
            : ranks;

    return results
        .slice(0, 25)
        .map((rank) => ({
            name: rank.name,
            value: rank.name,
        }));
}

/*
 * ============================================================
 * PERMISSION HELPERS
 * ============================================================
 */

/**
 * Check whether a member has a configured reviewer role.
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

    const reviewerRoleIds =
        Array.isArray(
            serverConfig.reviewerRoleIds
        )
            ? serverConfig.reviewerRoleIds
            : [];

    return member.roles.cache.some(
        (role) =>
            reviewerRoleIds.includes(
                role.id
            )
    );
}

/*
 * ============================================================
 * CHANNEL HELPERS
 * ============================================================
 */

/**
 * Return a configured channel ID.
 *
 * Valid channel types:
 *
 * promotions
 * demotions
 * infractions
 *
 * @param {string} guildId
 * @param {string} channelType
 * @returns {string|null}
 */
function getConfiguredChannelId(
    guildId,
    channelType
) {
    if (!channelType) {
        return null;
    }

    const serverConfig =
        getServerConfig(guildId);

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

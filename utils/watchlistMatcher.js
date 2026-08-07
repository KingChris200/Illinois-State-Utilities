const { parsePlayerRecord } = require('./playerResolver');

function matchWatchlistPlayers(records, players) {
    const activeRecords = (Array.isArray(records) ? records : [])
        .filter((record) => record?.status === 'active');
    const onlinePlayers = (Array.isArray(players) ? players : [])
        .map((player) => {
            try {
                return parsePlayerRecord(player);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    const matches = [];
    const seen = new Set();

    for (const record of activeRecords) {
        const recordUserId = String(
            record.robloxUserId || ''
        ).trim();
        const recordUsername = String(
            record.robloxUsername || ''
        )
            .trim()
            .toLowerCase();

        for (const player of onlinePlayers) {
            const matchedBy =
                recordUserId && player.userId === recordUserId
                    ? 'user_id'
                    : (!recordUserId || !player.userId) &&
                        recordUsername &&
                        player.username.toLowerCase() ===
                            recordUsername
                      ? 'username'
                      : null;

            if (!matchedBy) {
                continue;
            }

            const key = `${record.id || recordUserId}:${player.userId || player.username.toLowerCase()}`;

            if (!seen.has(key)) {
                matches.push({ record, player, matchedBy });
                seen.add(key);
            }
        }
    }

    return matches;
}

module.exports = {
    matchWatchlistPlayers,
};

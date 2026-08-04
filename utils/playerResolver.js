class PlayerResolverError extends Error {
    constructor(message, code, matches = []) {
        super(message);
        this.name = 'PlayerResolverError';
        this.code = code;
        this.matches = matches;
    }
}

function parsePlayerRecord(player) {
    const rawPlayer = String(
        player?.Player || player?.Username || ''
    ).trim();
    const separatorIndex = rawPlayer.lastIndexOf(':');
    const possibleUserId =
        separatorIndex > 0
            ? rawPlayer.slice(separatorIndex + 1).trim()
            : '';
    const hasUserId = /^\d+$/.test(possibleUserId);
    const username = (
        hasUserId
            ? rawPlayer.slice(0, separatorIndex)
            : rawPlayer
    ).trim();

    if (!username) {
        throw new PlayerResolverError(
            'The ER:LC API returned an invalid player record.',
            'INVALID_PLAYER_RECORD'
        );
    }

    return {
        username,
        userId: hasUserId ? possibleUserId : null,
        permission: String(player.Permission || 'Normal'),
        raw: player,
    };
}

function resolvePlayer(players, query) {
    const normalizedQuery = String(query || '')
        .trim()
        .toLowerCase();

    if (!normalizedQuery) {
        throw new PlayerResolverError(
            'Provide a Roblox username or user ID.',
            'PLAYER_QUERY_REQUIRED'
        );
    }

    const parsedPlayers = (Array.isArray(players) ? players : [])
        .map(parsePlayerRecord);
    const isNumericQuery = /^\d+$/.test(normalizedQuery);

    if (isNumericQuery) {
        const idMatch = parsedPlayers.find(
            (player) => player.userId === normalizedQuery
        );

        if (idMatch) {
            return { player: idMatch, matchType: 'exact_id' };
        }

        throw new PlayerResolverError(
            `No online player has the Roblox ID ${normalizedQuery}.`,
            'PLAYER_NOT_FOUND'
        );
    }

    const exactMatch = parsedPlayers.find(
        (player) =>
            player.username.toLowerCase() === normalizedQuery
    );

    if (exactMatch) {
        return {
            player: exactMatch,
            matchType: 'exact_username',
        };
    }

    if (normalizedQuery.length < 3) {
        throw new PlayerResolverError(
            'Enter at least 3 characters for a partial username search.',
            'PLAYER_QUERY_TOO_SHORT'
        );
    }

    const prefixMatches = parsedPlayers.filter((player) =>
        player.username.toLowerCase().startsWith(normalizedQuery)
    );

    if (prefixMatches.length === 1) {
        return {
            player: prefixMatches[0],
            matchType: 'username_prefix',
        };
    }

    if (prefixMatches.length > 1) {
        throw createAmbiguousError(prefixMatches);
    }

    const containsMatches = parsedPlayers.filter((player) =>
        player.username.toLowerCase().includes(normalizedQuery)
    );

    if (containsMatches.length === 1) {
        return {
            player: containsMatches[0],
            matchType: 'username_contains',
        };
    }

    if (containsMatches.length > 1) {
        throw createAmbiguousError(containsMatches);
    }

    throw new PlayerResolverError(
        `No online player matched "${String(query).trim()}".`,
        'PLAYER_NOT_FOUND'
    );
}

function createAmbiguousError(matches) {
    const visibleMatches = matches.slice(0, 5);
    const names = visibleMatches
        .map((player) => player.username)
        .join(', ');
    const remaining = matches.length - visibleMatches.length;
    const suffix = remaining > 0
        ? `, and ${remaining} more`
        : '';

    return new PlayerResolverError(
        `That search matches multiple players: ${names}${suffix}. Enter the full username or Roblox ID.`,
        'PLAYER_AMBIGUOUS',
        matches
    );
}

module.exports = {
    PlayerResolverError,
    parsePlayerRecord,
    resolvePlayer,
};

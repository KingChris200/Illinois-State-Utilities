async function findUserId(username) {
    const normalizedUsername = String(username || '').trim();

    if (!normalizedUsername) {
        return null;
    }

    const response = await fetch(
        'https://users.roblox.com/v1/usernames/users',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                usernames: [normalizedUsername],
                excludeBannedUsers: false,
            }),
            signal: AbortSignal.timeout(10_000),
        }
    );

    if (!response.ok) {
        throw new Error(
            `Roblox lookup failed (${response.status}).`
        );
    }

    const body = await response.json();
    return body.data?.[0] || null;
}

async function findUserById(userId) {
    const normalizedUserId = String(userId || '').trim();

    if (!/^\d{1,20}$/.test(normalizedUserId)) {
        return null;
    }

    const response = await fetch(
        `https://users.roblox.com/v1/users/${normalizedUserId}`,
        {
            signal: AbortSignal.timeout(10_000),
        }
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(
            `Roblox lookup failed (${response.status}).`
        );
    }

    return response.json();
}

async function resolveUser(identifier) {
    const query = String(identifier || '').trim();

    if (!query) {
        return null;
    }

    const user = /^\d{1,20}$/.test(query)
        ? await findUserById(query)
        : await findUserId(query);

    if (!user?.id || !user?.name) {
        return null;
    }

    return {
        id: String(user.id),
        name: String(user.name),
        displayName: String(
            user.displayName || user.name
        ),
    };
}

module.exports = {
    findUserId,
    findUserById,
    resolveUser,
};

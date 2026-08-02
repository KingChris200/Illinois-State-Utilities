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

module.exports = {
    findUserId,
};

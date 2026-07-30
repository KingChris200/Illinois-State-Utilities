/**
 * Illinois State Roleplay | Strict
 * Session Manager
 *
 * Stores the currently active server vote and session.
 *
 * Important:
 * This currently stores data in memory, meaning an active vote will reset
 * if the bot restarts. We can add permanent JSON/database saving later.
 */

let activeVote = null;
let activeSession = null;

/**
 * Creates a new server vote.
 *
 * @param {object} voteData
 */
function createVote(voteData) {
    activeVote = {
        guildId: voteData.guildId,
        channelId: voteData.channelId,
        messageId: voteData.messageId,
        hostId: voteData.hostId,

        goal: voteData.goal,
        durationMinutes: voteData.durationMinutes,

        startedAt: voteData.startedAt,
        endsAt: voteData.endsAt,

        attending: new Set(),
        notAttending: new Set(),

        status: 'voting',
    };

    return activeVote;
}

/**
 * Returns the active vote.
 */
function getVote() {
    return activeVote;
}

/**
 * Checks whether a vote is currently active.
 */
function hasActiveVote() {
    return activeVote !== null && activeVote.status === 'voting';
}

/**
 * Adds or changes a member's vote.
 *
 * @param {string} userId
 * @param {'attending'|'not_attending'} choice
 */
function setVote(userId, choice) {
    if (!activeVote) {
        return null;
    }

    // Remove the member's previous selection.
    activeVote.attending.delete(userId);
    activeVote.notAttending.delete(userId);

    if (choice === 'attending') {
        activeVote.attending.add(userId);
    }

    if (choice === 'not_attending') {
        activeVote.notAttending.add(userId);
    }

    return activeVote;
}

/**
 * Removes a member's vote completely.
 *
 * @param {string} userId
 */
function removeVote(userId) {
    if (!activeVote) {
        return null;
    }

    activeVote.attending.delete(userId);
    activeVote.notAttending.delete(userId);

    return activeVote;
}

/**
 * Returns the number of attending voters.
 */
function getAttendingCount() {
    return activeVote?.attending.size ?? 0;
}

/**
 * Returns an array containing attending member IDs.
 */
function getAttendingMembers() {
    if (!activeVote) {
        return [];
    }

    return [...activeVote.attending];
}

/**
 * Checks whether the vote goal has been reached.
 */
function hasReachedGoal() {
    if (!activeVote) {
        return false;
    }

    return activeVote.attending.size >= activeVote.goal;
}

/**
 * Marks the current vote as completed.
 */
function completeVote() {
    if (!activeVote) {
        return null;
    }

    activeVote.status = 'completed';

    return activeVote;
}

/**
 * Clears the active server vote.
 */
function clearVote() {
    activeVote = null;
}

/**
 * Starts an official session after the vote goal is reached.
 *
 * @param {object} sessionData
 */
function startSession(sessionData) {
    activeSession = {
        guildId: sessionData.guildId,
        channelId: sessionData.channelId,
        hostId: sessionData.hostId,
        startupMessageId: sessionData.startupMessageId ?? null,

        attendeeIds: sessionData.attendeeIds ?? [],

        startedAt: sessionData.startedAt ?? Date.now(),
        status: 'online',
    };

    return activeSession;
}

/**
 * Returns the active session.
 */
function getSession() {
    return activeSession;
}

/**
 * Checks whether a session is currently active.
 */
function hasActiveSession() {
    return activeSession !== null && activeSession.status === 'online';
}

/**
 * Ends and returns the active session.
 */
function endSession() {
    if (!activeSession) {
        return null;
    }

    const endedSession = {
        ...activeSession,
        status: 'offline',
        endedAt: Date.now(),
    };

    activeSession = null;

    return endedSession;
}

/**
 * Clears all session-related information.
 */
function resetAll() {
    activeVote = null;
    activeSession = null;
}

module.exports = {
    createVote,
    getVote,
    hasActiveVote,

    setVote,
    removeVote,
    getAttendingCount,
    getAttendingMembers,
    hasReachedGoal,
    completeVote,
    clearVote,

    startSession,
    getSession,
    hasActiveSession,
    endSession,

    resetAll,
};
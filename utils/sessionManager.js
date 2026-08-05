/*
 * Illinois State Utilities
 * Session Manager
 *
 * Stores the currently active server vote and session.
 *
 * Runtime state is stored here. The session state store serializes
 * and restores this information when the bot restarts.
 */

let activeVote = null;
let activeSession = null;

/*
 * ==========================================
 * SERVER VOTE
 * ==========================================
 */

function createVote(data) {
    activeVote = {
        guildId: data.guildId,
        channelId: data.channelId,
        messageId: data.messageId,
        hostId: data.hostId,
        hostUsername: data.hostUsername,
        goal: data.goal,
        roleplayZone: data.roleplayZone ?? 'Statewide',
        notes: data.notes ?? null,
        startedAt: data.startedAt ?? Date.now(),
        endsAt: data.endsAt,
        votes: new Map(),
        completed: false,
    };

    return activeVote;
}

function getVote() {
    return activeVote;
}

function hasActiveVote() {
    return activeVote !== null;
}

function setVote(userId, choice) {
    if (!activeVote) {
        return false;
    }

    activeVote.votes.set(userId, choice);
    return true;
}

function removeVote(userId) {
    if (!activeVote) {
        return false;
    }

    return activeVote.votes.delete(userId);
}

function getAttendingMembers() {
    if (!activeVote) {
        return [];
    }

    return [...activeVote.votes.entries()]
        .filter(([, choice]) => choice === 'attending')
        .map(([userId]) => userId);
}

function getNotAttendingMembers() {
    if (!activeVote) {
        return [];
    }

    return [...activeVote.votes.entries()]
        .filter(([, choice]) => choice === 'not_attending')
        .map(([userId]) => userId);
}

function getAttendingCount() {
    return getAttendingMembers().length;
}

function hasReachedGoal() {
    if (!activeVote) {
        return false;
    }

    return getAttendingCount() >= activeVote.goal;
}

function markVoteCompleted() {
    if (!activeVote) {
        return false;
    }

    activeVote.completed = true;
    return true;
}

function clearVote() {
    activeVote = null;
}

/*
 * ==========================================
 * ACTIVE SESSION
 * ==========================================
 */

function startSession(data) {
    activeSession = {
        guildId: data.guildId,
        channelId: data.channelId,
        hostId: data.hostId,
        hostUsername: data.hostUsername,
        startupMessageId: data.startupMessageId ?? null,
        attendeeIds: data.attendeeIds ?? [],
        roleplayZone: data.roleplayZone ?? 'Statewide',
        notes: data.notes ?? null,
        livePlayerCount:
            data.livePlayerCount ?? null,
        maxPlayerCount:
            data.maxPlayerCount ?? null,
        playerCountUpdatedAt:
            data.playerCountUpdatedAt ?? null,
        startedAt: data.startedAt ?? Date.now(),
    };

    return activeSession;
}

function getSession() {
    return activeSession;
}

function hasActiveSession() {
    return activeSession !== null;
}

function updateSessionPlayerCount({
    guildId,
    messageId,
    currentPlayers,
    maxPlayers,
    updatedAt = Date.now(),
}) {
    if (
        !activeSession ||
        activeSession.guildId !== String(guildId) ||
        activeSession.startupMessageId !==
            String(messageId)
    ) {
        return false;
    }

    activeSession.livePlayerCount =
        currentPlayers;
    activeSession.maxPlayerCount =
        maxPlayers;
    activeSession.playerCountUpdatedAt =
        updatedAt;

    return true;
}

function endSession() {
    if (!activeSession) {
        return null;
    }

    const endedSession = {
        ...activeSession,
        endedAt: Date.now(),
    };

    activeSession = null;

    return endedSession;
}

/*
 * ==========================================
 * RESET
 * ==========================================
 */

function resetAll() {
    activeVote = null;
    activeSession = null;
}

function exportState() {
    return {
        activeVote: activeVote
            ? {
                  ...activeVote,
                  votes: [
                      ...activeVote.votes.entries(),
                  ],
              }
            : null,
        activeSession: activeSession
            ? {
                  ...activeSession,
                  attendeeIds: [
                      ...activeSession.attendeeIds,
                  ],
              }
            : null,
    };
}

function restoreState({
    activeVote: savedVote = null,
    activeSession: savedSession = null,
} = {}) {
    activeVote = savedVote
        ? {
              ...savedVote,
              votes: new Map(
                  Array.isArray(savedVote.votes)
                      ? savedVote.votes
                      : []
              ),
          }
        : null;

    activeSession = savedSession
        ? {
              ...savedSession,
              attendeeIds: Array.isArray(
                  savedSession.attendeeIds
              )
                  ? [...savedSession.attendeeIds]
                  : [],
          }
        : null;

    return exportState();
}

module.exports = {
    createVote,
    getVote,
    hasActiveVote,
    setVote,
    removeVote,
    getAttendingMembers,
    getNotAttendingMembers,
    getAttendingCount,
    hasReachedGoal,
    markVoteCompleted,
    clearVote,

    startSession,
    getSession,
    hasActiveSession,
    updateSessionPlayerCount,
    endSession,

    resetAll,
    exportState,
    restoreState,
};

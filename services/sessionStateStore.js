const {
    readDatabase,
    writeDatabase,
} = require('../utils/database');
const sessionManager = require('../utils/sessionManager');

const DATABASE_NAME = 'active-session-state';
const STATE_VERSION = 1;

let writeQueue = Promise.resolve();

function createSnapshot() {
    const state = sessionManager.exportState();

    return {
        version: STATE_VERSION,
        updatedAt: new Date().toISOString(),
        activeVote: state.activeVote,
        activeSession: state.activeSession,
    };
}

function normalizeSavedState(savedState) {
    if (
        !savedState ||
        typeof savedState !== 'object' ||
        Array.isArray(savedState)
    ) {
        return {
            activeVote: null,
            activeSession: null,
        };
    }

    const activeVote =
        savedState.activeVote &&
        typeof savedState.activeVote === 'object' &&
        typeof savedState.activeVote.guildId === 'string' &&
        typeof savedState.activeVote.channelId === 'string' &&
        typeof savedState.activeVote.messageId === 'string' &&
        Number.isFinite(savedState.activeVote.endsAt)
            ? savedState.activeVote
            : null;

    const activeSession =
        savedState.activeSession &&
        typeof savedState.activeSession === 'object' &&
        typeof savedState.activeSession.guildId === 'string' &&
        typeof savedState.activeSession.channelId === 'string' &&
        typeof savedState.activeSession.startupMessageId === 'string'
            ? savedState.activeSession
            : null;

    return {
        activeVote,
        activeSession,
    };
}

async function loadSessionState() {
    const savedState = await readDatabase(
        DATABASE_NAME,
        {
            version: STATE_VERSION,
            activeVote: null,
            activeSession: null,
        }
    );

    return normalizeSavedState(savedState);
}

function saveSessionState() {
    const snapshot = createSnapshot();

    writeQueue = writeQueue
        .catch(() => {})
        .then(() =>
            writeDatabase(
                DATABASE_NAME,
                snapshot
            )
        );

    return writeQueue;
}

function waitForSessionStateWrites() {
    return writeQueue;
}

module.exports = {
    DATABASE_NAME,
    STATE_VERSION,
    createSnapshot,
    normalizeSavedState,
    loadSessionState,
    saveSessionState,
    waitForSessionStateWrites,
};

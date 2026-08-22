const {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
} = require('discord.js');

const sessionManager = require('../utils/sessionManager');
const {
    loadSessionState,
    saveSessionState,
} = require('./sessionStateStore');
const {
    startSessionPlayerCountMonitor,
} = require('./sessionPlayerCountMonitor');

const recoveryTimers = new Map();

async function fetchSavedMessage(client, state, messageId) {
    const guild =
        client.guilds.cache.get(state.guildId) ||
        (await client.guilds.fetch(state.guildId).catch(() => null));

    if (!guild) {
        return null;
    }

    const channel =
        guild.channels.cache.get(state.channelId) ||
        (await guild.channels.fetch(state.channelId).catch(() => null));

    if (!channel?.isTextBased()) {
        return null;
    }

    const message = await channel.messages
        .fetch(messageId)
        .catch(() => null);

    if (
        !message ||
        message.author?.id !== client.user.id
    ) {
        return null;
    }

    return message;
}

function disableComponents(message) {
    return message.components.map((row) =>
        new ActionRowBuilder().addComponents(
            row.components.map((component) =>
                ButtonBuilder.from(component).setDisabled(true)
            )
        )
    );
}

async function expireRecoveredVote(client, expectedVote) {
    const activeVote = sessionManager.getVote();

    if (
        !activeVote ||
        activeVote.messageId !== expectedVote.messageId ||
        activeVote.completed
    ) {
        return false;
    }

    const message = await fetchSavedMessage(
        client,
        activeVote,
        activeVote.messageId
    );

    if (message) {
        const embed = message.embeds[0]
            ? new EmbedBuilder(
                  message.embeds[0].toJSON()
              )
                  .setColor('#A83A3A')
                  .setTitle('Vote Ended')
                  .setDescription(
                      'The vote ended before it reached the goal.'
                  )
            : null;

        await message
            .edit({
                embeds: embed ? [embed] : [],
                components:
                    disableComponents(message),
            })
            .catch((error) => {
                console.error(
                    '[SESSION RECOVERY] Could not close the expired vote message:',
                    error
                );
            });
    }

    sessionManager.clearVote();
    await saveSessionState();
    recoveryTimers.delete(activeVote.guildId);
    return true;
}

function scheduleRecoveredVoteExpiration(client, vote) {
    const existingTimer = recoveryTimers.get(vote.guildId);

    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const remainingMilliseconds = Math.max(
        0,
        vote.endsAt - Date.now()
    );
    const timer = setTimeout(
        () =>
            expireRecoveredVote(client, vote).catch(
                (error) =>
                    console.error(
                        '[SESSION RECOVERY] Vote expiration failed:',
                        error
                    )
            ),
        remainingMilliseconds
    );

    timer.unref?.();
    recoveryTimers.set(vote.guildId, timer);
    return remainingMilliseconds;
}

async function recoverSessionState(client) {
    const savedState = await loadSessionState();

    if (savedState.activeSession) {
        const sessionMessage = await fetchSavedMessage(
            client,
            savedState.activeSession,
            savedState.activeSession.startupMessageId
        );

        if (sessionMessage) {
            sessionManager.restoreState({
                activeSession: savedState.activeSession,
            });
            await saveSessionState();

            startSessionPlayerCountMonitor({
                client,
                guildId: savedState.activeSession.guildId,
                channelId: savedState.activeSession.channelId,
                messageId:
                    savedState.activeSession.startupMessageId,
            });

            console.log(
                `✅ Restored active session in #${savedState.activeSession.channelId}.`
            );

            return {
                status: 'session_restored',
                state: sessionManager.getSession(),
            };
        }
    }

    if (savedState.activeVote) {
        const voteMessage = await fetchSavedMessage(
            client,
            savedState.activeVote,
            savedState.activeVote.messageId
        );

        if (voteMessage) {
            const restoredVote = {
                ...savedState.activeVote,
                completed: false,
            };

            sessionManager.restoreState({
                activeVote: restoredVote,
            });

            if (
                restoredVote.endsAt <= Date.now()
            ) {
                await expireRecoveredVote(
                    client,
                    restoredVote
                );

                return {
                    status: 'expired_vote_cleared',
                };
            }

            scheduleRecoveredVoteExpiration(
                client,
                restoredVote
            );
            await saveSessionState();

            console.log(
                `✅ Restored active session vote in #${savedState.activeVote.channelId}.`
            );

            return {
                status: 'vote_restored',
                state: sessionManager.getVote(),
            };
        }
    }

    sessionManager.resetAll();
    await saveSessionState();

    return {
        status:
            savedState.activeSession || savedState.activeVote
                ? 'stale_state_cleared'
                : 'no_saved_state',
    };
}

module.exports = {
    fetchSavedMessage,
    disableComponents,
    expireRecoveredVote,
    scheduleRecoveredVoteExpiration,
    recoverSessionState,
};

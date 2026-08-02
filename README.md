# Illinois State Utilities

## Remote ER:LC commands

The bot supports `?m`, `?h`, `?players`, `?server`, `?help`, and
`?id <Roblox username>`. Remote calls are isolated in
`services/erlcService.js`.

Add the following values to `.env` as needed:

```env
# Required for live ER:LC API calls (leave unset until available)
ERLC_SERVER_KEY=

# Comma-separated Discord role and channel IDs
ERLC_COMMAND_ROLE_IDS=123456789012345678,234567890123456789
ERLC_COMMAND_CHANNEL_IDS=345678901234567890

# Optional Discord channel for command audit messages
ERLC_COMMAND_LOG_CHANNEL_ID=456789012345678901

# Set true to test ?m and ?h without sending anything to ER:LC
ERLC_DRY_RUN=true

# Set true to return safe sample data from ?players and ?server too
ERLC_MOCK_MODE=true
```

Administrators may use staff-only commands even when their role is not
listed. If no channel IDs are configured, commands are accepted in any
guild text channel. If no role IDs are configured, staff-only commands
remain administrator-only.

Enable **Message Content Intent** for the bot in the Discord Developer
Portal before starting it. No slash-command redeployment is needed.

!

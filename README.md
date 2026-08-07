# Illinois State Utilities

## Remote ER:LC commands

Remote calls are isolated in `services/erlcService.js`. Run `?help`
to see only the commands available to your Discord roles, or
`?help <command>` for detailed usage.

Current prefix commands include:

- Public: `?help`, `?id`, and `?status`
- Server information: `?players`, `?server`, `?staff`, and `?queue`
- Live intelligence: `?operations`, `?modcalls`, `?joinlogs`, `?kl`, `?vehicles`, and `?logs`
- Announcements: `?m` and `?h`
- Confirmed moderation: `?warn`, `?kick`, `?ban`, `?unban`, `?respawn`, `?heal`, `?wanted`, and `?unwanted`
- Diagnostics: `?apicheck`

Add the following values to `.env` as needed:

```env
# Required for live ER:LC API calls (leave unset until available)
ERLC_SERVER_KEY=

# Comma-separated Discord role and channel IDs
ERLC_COMMAND_ROLE_IDS=123456789012345678,234567890123456789
ERLC_COMMAND_CHANNEL_IDS=345678901234567890

# Senior roles permitted to use restricted moderation and logs
ERLC_SENIOR_MOD_ROLE_IDS=567890123456789012

# Optional Discord channel for command audit messages
ERLC_COMMAND_LOG_CHANNEL_ID=456789012345678901

# Optional channel for detailed moderation lifecycle embeds
ERLC_MODERATION_LOG_CHANNEL_ID=678901234567890123

# Session automation is restricted to this Discord channel
ERLC_SESSION_CHANNEL_ID=1490731232311378010

# Required only when enabling live session-to-ER:LC announcements
ERLC_SESSION_AUTOMATION_ENABLED=false

# Set true to preview remote commands without sending them to ER:LC
ERLC_DRY_RUN=true

# Set true to return safe sample data for every ER:LC information command
ERLC_MOCK_MODE=true
```

Administrators may use staff-only commands even when their role is not
listed. If no channel IDs are configured, commands are accepted in any
guild text channel. If no role IDs are configured, staff-only commands
remain administrator-only.

Enable **Message Content Intent** for the bot in the Discord Developer
Portal before starting it. No slash-command redeployment is needed.

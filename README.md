# Illinois State Utilities

## Remote ER:LC commands

Remote calls are isolated in `services/erlcService.js`. Run `?help`
to see only the commands available to your Discord roles, or
`?help <command>` for detailed usage.

Current prefix commands include:

- Public: `?help`, `?id`, and `?status`
- Server information: `?players`, `?server`, `?staff`, and `?queue`
- Live intelligence: `?operations`, `?player`, `?alerts`, `?modcalls`, `?joinlogs`, `?kl`, `?vehicles`, and `?logs`
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

# Smart alerts remain off until explicitly enabled
ERLC_SMART_ALERTS_ENABLED=false
ERLC_SMART_ALERT_CHANNEL_ID=

# Optional staff role to ping when a real alert is sent
ERLC_SMART_ALERT_ROLE_ID=

# Optional tuning (safe defaults shown)
ERLC_SMART_ALERT_INTERVAL_MS=60000
ERLC_MODCALL_ALERT_DELAY_SECONDS=60
ERLC_QUEUE_ALERT_THRESHOLD=5
ERLC_KILL_ALERT_THRESHOLD=5
ERLC_KILL_ALERT_WINDOW_SECONDS=120
ERLC_ALERT_COOLDOWN_SECONDS=300
```

Administrators may use staff-only commands even when their role is not
listed. If no channel IDs are configured, commands are accepted in any
guild text channel. If no role IDs are configured, staff-only commands
remain administrator-only.

Enable **Message Content Intent** for the bot in the Discord Developer
Portal before starting it. No slash-command redeployment is needed for
the prefix commands above.

## Branded `/embed` announcements

Staff members with **Manage Messages** can create a clean announcement
with only three options:

- `message` (required): the announcement text
- `title` (optional): defaults to **Community Announcement**
- `channel` (optional): defaults to the channel where the command runs

The bot automatically applies the Illinois State Roleplay color, live
Discord server logo, wide official wordmark, official footer, and
timestamp. Custom text cannot trigger user, role, or everyone mentions.

After changing the `/embed` command, run `npm run deploy-commands` once
and restart the bot. Global Discord command changes may take several
minutes to appear.

## Brand assets

Reusable Illinois State Roleplay logos and the supplied Roblox avatar are
stored in `assets/branding`. The generated Discord welcome artwork is at
`assets/thumbnails/welcome-banner.png`. The welcome artwork is ready for
a future member-join system; the automatic welcome handler and welcome
channel configuration have not been added yet.

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

# New-member welcomes are sent here
WELCOME_CHANNEL_ID=1490733409037975654

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
`assets/thumbnails/welcome-banner.png`.

## Welcome system

New human members are welcomed automatically in channel
`1490733409037975654` using the branded banner, a clickable member tag,
the current server member count, and safe mention controls. Bot accounts
are ignored. Override the destination with `WELCOME_CHANNEL_ID` if the
channel changes.

Enable **Server Members Intent** for the bot in the Discord Developer
Portal so Discord sends member-join events. Restart the bot afterward;
no slash-command deployment is required for the welcome system.

Automatic unanswered moderator-call alerts are disabled to prevent
repeated notifications. Staff can still check calls manually with
`?modcalls`; queue-surge and unusual-kill smart alerts remain available.

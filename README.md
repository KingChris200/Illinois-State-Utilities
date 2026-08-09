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

# Optional Staff Guide source and private permission-log shortcut
STAFF_GUIDE_DOCUMENT_URL=https://docs.google.com/document/d/1-HhMjftqUdLhgdmoLhNSrNcpvkcwlo_p2JZ_4ri1C3o/edit
STAFF_PERMISSION_LOGS_CHANNEL_ID=
STAFF_GUIDE_VERSION=1.0

# Automatic private JSON snapshots (defaults shown)
DATA_BACKUPS_ENABLED=true
DATA_BACKUP_INTERVAL_MS=21600000
DATA_BACKUP_RETENTION=14

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

# Private automatic watchlist matching (use a management-only channel)
WATCHLIST_ALERTS_ENABLED=false
WATCHLIST_ALERT_CHANNEL_ID=
WATCHLIST_ALERT_INTERVAL_MS=60000
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
`assets/thumbnails/welcome-banner.png`, and the session artwork is at
`assets/thumbnails/session-started.png`. The dedicated interactive guide
header is at `assets/thumbnails/staff-guide-banner-v2.png`.

The local files are the source of truth. Shared embeds use stable GitHub
asset URLs instead of temporary Discord attachment links, while commands
such as `/about`, `/embed`, the welcome system, and session announcements
attach the wide artwork directly when appropriate. Keep the `assets`
folder in the same commit as branding changes.

If the repository or default branch changes, set a new public base URL:

```env
ISRP_ASSET_BASE_URL=https://example.com/illinois-state-utilities/assets

# Optional: use only when an official Illinois State Police badge is ready
ISP_BRAND_LOGO_URL=
```

The ISP embed family intentionally stays neutral when
`ISP_BRAND_LOGO_URL` is empty so the community ISRP logo is not presented
as an official police badge.

### Embed design system

Shared embeds use `utils/embedTheme.js` to keep the bot visually
consistent. The automatic image priority is:

1. The relevant member's Discord avatar for staff profiles and personnel
   records.
2. The current Discord server logo for server-wide information,
   dashboards, logs, and command responses.
3. The official ISRP or Illinois State Utilities logo as a safe fallback
   and footer mark.

Success, warning, danger, moderation, informational, and neutral embeds
also share a consistent color palette. Wide artwork is reserved for major
moments such as welcomes, announcements, and sessions so everyday tools
remain easy to scan.

## Private case management

The existing `/case` system provides view, edit, close, reopen, void,
search, list, and text-export tools. Case records and exports always use
private Discord responses. Access is limited to the server owner,
administrators, members with **Manage Server**, and the management,
Internal Affairs, director, or ownership roles configured in
`config/serverConfigs.js`. **Manage Messages** by itself is not enough to
read personnel records.

Because the public/private slash-command choices were removed, run
`npm run deploy-commands` once after installing this update.

Database writes are serialized per data file. Simultaneous promotions,
infractions, watchlist actions, session updates, and case actions can no
longer overwrite one another after reading the same older state.

## Welcome system

New human members are welcomed automatically in channel
`1490733409037975654` using one branded embed, a real restricted member
ping, the current server member count, and safe mention controls. Bot
accounts and duplicate join events are ignored. Override the destination
with `WELCOME_CHANNEL_ID` if the channel changes.

Enable **Server Members Intent** for the bot in the Discord Developer
Portal so Discord sends member-join events. Restart the bot afterward;
no slash-command deployment is required for the welcome system.

Automatic unanswered moderator-call alerts are disabled to prevent
repeated notifications. Staff can still check calls manually with
`?modcalls`; queue-surge and unusual-kill smart alerts remain available.

## Permanent Staff Guide

The `/guide` command manages a branded, persistent staff handbook panel
for the main Illinois State Roleplay server. Its topic and rank menus open
private responses, so staff can study policies without filling the public
channel with messages. The panel continues working after bot restarts.

Private guide pages use Discord Components V2 for a mobile-friendly
handbook-card layout: dedicated ISRP artwork, accent rail, dividers,
larger section headings, grouped policy text, direct resource buttons,
and a final handoff to the configured permission-log channel. When no
permission-log channel is configured, that handoff safely becomes an
acknowledgment button instead.

The official chain of command is organized into Foundership, Directorate,
Staff Supervision, Management, Internal Affairs, Administration, and
Moderation. The panel links every operational summary back to its matching
tab in the official Staff Handbook. Quick-access buttons also open the
ISRP Whitelisted Roblox group and the Melonly staff panel.

Staff with **Manage Server** can use:

- `/guide preview` to inspect the complete panel privately.
- `/guide setup channel:#staff-guide` to post it. Leaving out `channel`
  uses the current channel.
- `/guide update` to refresh the saved message after future changes.
- `/guide remove` to remove the message and its saved location.
- `/guide acknowledgements` to review current-version confirmations.
- `/guide onboarding-status` to review staff onboarding completion.
- `/guide publish-update version:1.1 summary:...` to publish a new
  version and request fresh acknowledgments.

Authorized staff can use **Acknowledge Guide** and **Staff Onboarding**
directly from the permanent panel. Acknowledgments and checklist
completion are private, versioned, and recorded without automatically
changing roles, sending reminders, or applying discipline.

Set `STAFF_PERMISSION_LOGS_CHANNEL_ID` only if the panel should include a
shortcut to a private permission-log channel. The bot needs **View
Channel**, **Send Messages**, and **Embed Links** in the selected guide
channel.

Run `npm run deploy-commands` once after installing this feature, then
restart the bot and begin with `/guide preview`.

## Configuration doctor and data backups

`/doctor` runs a private, read-only review of the Discord connection,
required gateway intents, ER:LC mode, configured channels, channel
permissions, permanent Staff Guide, live data directory, and automatic
backup service. It reports problems without changing configuration.

Automatic backups copy every JSON file from `data` into timestamped
folders under the gitignored `backups` directory. They run once when the
bot starts and then every six hours by default. The newest 14 snapshots
are retained; cleanup is restricted to verified timestamped folders
inside `backups`.

Management can use:

- `/backup status` to review scheduling and the most recent result.
- `/backup create` to create a snapshot immediately.

Local snapshots protect against accidental data damage, but they remain
on the same computer. Periodically copy the `backups` folder to a secure
off-device location for full disaster recovery. Restoring data remains a
manual operation so the bot cannot overwrite live records accidentally.

## Private watchlist

Authorized management, Internal Affairs, directors, ownership, server
administrators, and the server owner can use `/watchlist`. Every response
is ephemeral and every record is scoped to the Discord server where it
was created.

Available actions:

- `/watchlist add` verifies a Roblox username or numeric user ID and
  creates an active record with severity, reason, evidence, and notes.
- `/watchlist view` opens the newest matching record privately.
- `/watchlist search` filters records by text, status, and severity.
- `/watchlist scan` privately compares every connected ER:LC player with
  active records using exact Roblox IDs (or exact usernames as a fallback).
- `/watchlist dashboard` opens an interactive private command center with
  record totals, severity coverage, recent audit activity, and a review queue.
- `/watchlist update` records field changes and the reason for the edit.
- `/watchlist resolve` closes a concern with a documented outcome.
- `/watchlist remove` archives an entry without deleting its audit trail.

Adding and managing records uses Roblox's public user API and does not
require the ER:LC server key. The live scan uses the configured ER:LC API,
or safe sample players while `ERLC_MOCK_MODE=true`. Records are stored in the gitignored
`data/private-watchlist.json` file. Keep the bot's `data` folder backed up
because it contains live private records and must never be committed to
GitHub.

Automatic matching is disabled until `WATCHLIST_ALERTS_ENABLED=true` and
`WATCHLIST_ALERT_CHANNEL_ID` points to a private management channel. The
monitor checks once per minute by default, never pings members or roles,
and stores its deduplication state in the gitignored `data` directory. A
match is announced once while that player remains online; it becomes
eligible for a fresh alert only after leaving and later rejoining.

Each automatic alert includes protected controls to acknowledge it, open
the full private record, launch live player intelligence, document a false
match, resolve the entry with a required reason, or refresh the player's
online status. State-changing responses are written into the record's
audit history, and every detailed response is ephemeral.

Run `npm run deploy-commands` after installing this feature, wait for the
global slash-command update to appear, and restart the bot.

## Assistance tickets and guided appeals

The permanent Assistance panel is configured for channel
`1490730143508070540`. Management can use `/tickets preview`, then
`/tickets setup` to post or refresh it. `/tickets status` reports the
saved panel and current open-ticket count.

The panel has three focused choices, and ticket channels are routed and
assigned automatically:

- General Support → category `1490870667795763412`, team role
  `1490523797629960392`
- Internal Affairs Support → category `1490870524245577899`, team role
  `1526344302618218656`
- Management Support → category `1490870524245577899`, team role
  `1490523581187231795`

Each new ticket pings the ticket creator and only the team selected in the
panel. Its private channel is visible to that creator, the selected team,
the bot, and server administrators. Management Support also covers
partnership requests and serious leadership concerns.

Inside an open ticket, authorized staff can use `!hello` to claim the
ticket and send a rank-aware introduction to its creator. `!appeal`
presents the ticket creator with a choice between an in-game punishment
appeal and a staff-infraction appeal. Both options open a five-question
form and preserve the completed submission in `data/ticket-appeals.json`.

Ticket and panel state is stored in the gitignored `data` directory. The
bot requires **Manage Channels**, **View Channel**, **Send Messages**,
**Read Message History**, **Attach Files**, and **Embed Links** for the
Assistance categories. Deploy slash commands once, restart the bot, and
run `/tickets setup`.

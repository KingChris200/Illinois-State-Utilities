# Illinois State Utilities

Project structure, interaction ownership, and data-safety conventions are
documented in [`docs/architecture.md`](docs/architecture.md).

## First-time setup

1. Install Node.js 20 or newer.
2. Run `npm install` in the project folder.
3. Copy `.env.example` to `.env`.
4. Add the bot token to `DISCORD_TOKEN` and the Discord application ID to
   `CLIENT_ID`. Keep `.env` private and never commit it.
5. Run `npm run deploy-commands` once, then start the bot with `npm start`.

Run `npm run check` before committing a change. It checks every source file
for syntax errors and then runs the complete automated test suite.

For safe testing without live ER:LC access, leave `ERLC_DRY_RUN=true` and
`ERLC_MOCK_MODE=true`. Set both to `false` only when the live server key and
Discord permissions have been verified.

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

# Optional Staff Guide source and displayed version
STAFF_GUIDE_DOCUMENT_URL=https://docs.google.com/document/d/1-HhMjftqUdLhgdmoLhNSrNcpvkcwlo_p2JZ_4ri1C3o/edit?tab=t.3qivgdyxzvm9
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
Discord server logo, minimal announcement header, official footer, and
timestamp. Custom text cannot trigger user, role, or everyone mentions.

After changing the `/embed` command, run `npm run deploy-commands` once
and restart the bot. Global Discord command changes may take several
minutes to appear.

## Brand assets

Reusable Illinois State Roleplay logos are stored in `assets/branding`, and
the reusable community avatar references are stored in `assets/avatars`.
The second-generation visual system uses
matching minimal headers in `assets/thumbnails` for Assistance, Sessions,
Welcome, Staff Guide, About, Announcements, Information, Regulations, and
the Dashboard.
These headers share one gradient, type system, logo lockup, tagline, and
spacing grid so public panels remain visually consistent.

The official `assets/branding/v2` logo kit includes light and dark
lockups, transparent white and navy marks, a circular badge, bot icon,
horizontal wordmarks, and a subtle watermark. Its palette is deliberately
limited to white, ice, light blue, soft navy, and neutral slate. Run
`scripts/generate-logo-kit.ps1` to regenerate the complete versioned kit.

Run `scripts/generate-brand-banners.ps1` after changing the shared banner
template. It deterministically regenerates the complete header family;
the design does not rely on AI-generated scenery or text.

The local files are the source of truth. Shared embeds use stable GitHub
asset URLs instead of temporary Discord attachment links, while commands
such as `/about`, `/embed`, the welcome system, and session announcements
attach the wide artwork directly when appropriate. Keep the `assets`
folder in the same commit as branding changes.

## Permanent ISRP Information Panel

The public Information panel introduces ISRP, provides direct links to the
guidelines, Assistance, Sessions, and the Whitelisted Roblox group, and uses
one menu for five private information sections. It uses the local
`information-banner-v1.png` artwork and stores its permanent Discord message
so it can be updated after a restart.

Members with **Manage Server** can use:

- `/information preview` to review the complete panel privately
- `/information setup channel:#information` to post and save it
- `/information update` to refresh the saved message
- `/information remove` to remove the saved message

No Information panel `.env` settings are required. Deploy the slash command
once with `npm run deploy-commands`, restart the bot, and run
`/information setup`.

## Permanent ISRP Guidelines Panels

Discord Guidelines and In-Game Guidelines use two separate permanent
Components V2 panels. Each panel has its own private menu, saved message,
and configured destination channel, so updating or removing one never
affects the other.

The In-Game Guidelines menu displays the approved restricted-item summary
directly: large or heavy weapons (except sniper rifles) and exotic or
prestige vehicles are booster-only, while all Tesla vehicles and sniper
rifles are banned.

Members with **Manage Server** can use:

- `/regulations preview panel:Discord Guidelines` to preview Discord rules
- `/regulations preview panel:In-Game Guidelines` to preview in-game rules
- `/regulations setup panel:Discord Guidelines` to post in the configured Discord Guidelines channel
- `/regulations setup panel:In-Game Guidelines` to post in the configured In-Game Guidelines channel
- `/regulations update panel:<panel>` to refresh only the selected panel
- `/regulations remove panel:<panel>` to remove only the selected panel

No Regulations panel `.env` settings are required. Deploy the slash command
once with `npm run deploy-commands`, restart the bot, and run both setup
commands. The optional `channel` setting can override a configured destination.

## Illinois State Police Shift Management

The ISP server has its own persistent weekly shift system. Officers open a
private manager in <#1527524104209567824>, start or stop their shift, and
pause or resume breaks from three simple buttons. Active time excludes breaks,
survives bot restarts, and automatically synchronizes the On-Duty and On-Break
roles.

Officer commands:

- `/shift manage` opens the private Start, Break, and Stop panel
- `/shift leaderboard` shows the current weekly standings
- `/shift online` shows officers who are currently on shift

Office of Director commands:

- `/shift admin global` shows system status, controls logging, or safely ends all shifts
- `/shift admin user` reviews a member, ends a shift, adjusts time, manages infractions, or manages promotion cooldowns
- `/shift dashboard` sets up, updates, or removes the permanent shift dashboard
- `/shift cooldowns` lists active promotion cooldowns
- `/shift excuse` and `/shift excuse-revoke` manage weekly quota excuses
- `/shift lists` lists active shift infractions
- `/shift logging` enables or disables new shift recording
- `/shift promotions` posts an advisory promotion-review list
- `/shift quota-reminder` privately reminds officers below quota

Configured resources:

- Office of Director: `1527518424060792872`
- On-Duty role: `1539069939468738590`
- On-Break role: `1539074734963294238`
- Shift logs: `1527524431642104039`
- Shift manager: `1527524104209567824`
- Shift administration: `1527524291829174365`

Run `/shift dashboard` with **Setup Dashboard** once to post the permanent
panel in the configured Shift manager channel. It displays current On-Duty and
On-Break totals, the weekly quota, logging status, and the top three officers.
Its three buttons privately open the officer's shift manager, online list, or
leaderboard. The saved message is recovered after restarts and refreshes every
minute.

The weekly quota defaults to two hours in `config/ispShift.js`. Promotion
reviews never change Discord roles automatically; the Office of Director must
review every candidate. No new `.env` values are required.

## Permanent ISRP Dashboard

The public Dashboard is one minimal Components V2 card with the official
ISRP banner, direct links to the guidelines, Assistance, Sessions, Proof,
Primary, In-Game Chat, and the Whitelisted Roblox group. Its single menu
opens five private information pages. Staff Resources remain restricted to
authorized staff members.

Members with **Manage Server** can use:

- `/dashboard preview` to check the complete panel privately
- `/dashboard setup channel:#dashboard` to post and save it
- `/dashboard update` to refresh the saved panel after a change
- `/dashboard remove` to delete the saved panel

The saved channel and message survive bot restarts. No dashboard `.env`
settings are required. Deploy the slash command once with
`npm run deploy-commands`, restart the bot, and run `/dashboard setup`.

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
Moderation. The public panel is one spacious Components V2 card with the
banner, official links, and one full-width team dropdown inside the card.
That single menu contains Moderation, Administration, High Rank, and
Senior High Rank. Together, those four team pages cover all 21 official
ranks exactly once. Each team card uses the matching live Discord team-role
color when available, with a team-specific blue, red, orange, or green
fallback. The official Staff Guide, Whitelisted Roblox group, and Melonly
invite remain clean links inside the panel.

Staff with **Manage Server** can use:

- `/guide preview` to inspect the complete panel privately.
- `/guide setup channel:#staff-guide` to post it. Leaving out `channel`
  uses the current channel.
- `/guide update` to refresh the saved message after future changes.
- `/guide remove` to remove the message and its saved location.
- `/guide publish-update version:1.1 summary:...` to publish a new
  version and refresh the official guide.

The public panel intentionally has no acknowledgment or onboarding
controls. Existing historical compliance records remain preserved, but
rank pages end cleanly after their official handbook link.

The bot needs **View Channel**, **Send Messages**, and **Embed Links** in
the selected guide channel.

Run `npm run deploy-commands` once after installing this feature, then
restart the bot and begin with `/guide preview`.

## Leave of absence system

The LOA workflow uses two private, staff-only commands:

- `/loa request duration:<days> reason:<reason> start:<optional date>`
  submits a request. Duration is limited to 1–90 days, and the optional
  start date uses `YYYY-MM-DD`; leaving it blank starts the LOA today.
- `/loa manage` shows the staff member's current request, lets them cancel
  a pending request or end an approved LOA early, and provides their past
  LOA history.

New requests are posted to the configured log channel and ping only the
Ownership and Directive teams. Those teams approve or deny requests with
buttons—no request IDs or extra management subcommands are required.
Approved LOAs update the staff profile automatically, and ending one
returns the staff member to active status. Existing historical LOA data
is preserved.

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

The panel is one spacious Components V2 card containing the existing
Assistance banner, readable category descriptions, and one full-width
three-option dropdown. Ticket channels are routed and assigned
automatically:

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
ticket and send a rank-aware introduction to its creator. The command
message is automatically removed when the bot has permission, leaving
only the professional greeting. An authorized ticket handler can use
`!appeal` to post a copyable in-channel questionnaire for either an
in-game punishment or staff-infraction appeal. The ticket creator pastes
their completed answers back into the ticket, where the handler can
review them and the normal ticket transcript preserves the conversation.
If either command is used outside a bot-created ticket, the bot removes
the trigger when possible and briefly explains where it must be used.
When the ticket opener mentions `partnership` or `partnerships`, the bot
automatically posts the official partnership requirements once in that
ticket. Repeated mentions do not create duplicate requirement messages.

Closing a ticket locks it, archives its private transcript, and deletes
the ticket channel after a five-second notice. If transcript archiving
fails, the bot intentionally keeps the locked channel so evidence is not
lost. The close action therefore requires **Manage Channels** and a
working transcript destination.

Ticket and panel state is stored in the gitignored `data` directory. The
bot requires **Manage Channels**, **View Channel**, **Send Messages**,
**Read Message History**, **Attach Files**, and **Embed Links** for the
Assistance categories. Deploy slash commands once, restart the bot, and
run `/tickets setup`.

Closing a ticket automatically saves a branded archive post and a plain
text transcript in private channel `1490813707289362533`. The transcript
contains the complete ticket conversation, embed text, and attachment
links, while its archive post suppresses Discord mentions. Up to the most
recent 1,000 messages are preserved. If archiving fails, the ticket still
closes safely and staff receive a permissions warning.

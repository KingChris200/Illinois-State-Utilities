# Illinois State Utilities Architecture

This project keeps Discord presentation, interaction routing, business logic,
external services, and persistent data separate. New features should follow
the same boundaries so the bot remains safe to change.

## Runtime flow

1. `index.js` creates the Discord client and starts command, event, and
   presence services.
2. `handlers/commandHandler.js` loads deployable slash commands using the
   shared command discovery utility.
3. `handlers/eventHandler.js` registers events behind one global error
   boundary.
4. `events/interactionCreate.js` sends slash commands to the command handler,
   reusable components to the component router, and session-vote buttons to
   the session workflow.
5. Commands and component managers call `services/` for ER:LC or background
   operations and `utils/database.js` for queued JSON updates.

## Folder responsibilities

- `commands/`: Discord slash-command definitions and top-level execution.
- `prefixCommands/`: `?` commands and their ER:LC-facing workflows.
- `handlers/`: discovery, loading, routing, and global execution boundaries.
- `events/`: Discord gateway event entry points.
- `services/`: ER:LC requests, monitors, backups, recovery, and other runtime
  services.
- `utils/`: reusable business logic, managers, formatting, and data access.
- `config/`: static IDs, branding, content, permissions, and safe defaults.
- `data/`: live JSON state; never commit it.
- `backups/`: automatic recoverable snapshots; never commit them.
- `assets/`: current branding, banners, avatars, and other local artwork.
- `test/`: behavior and regression tests.

## Interaction ownership

- Slash command and autocomplete execution belongs to
  `handlers/commandInteractionHandler.js`.
- Persistent buttons, menus, and modals are mapped in
  `handlers/componentInteractionHandler.js`.
- Session vote button behavior remains owned by
  `events/interactionCreate.js` until its presentation and state workflow are
  separated in a later focused refactor.
- A new component family should have one unique custom-ID prefix and one
  manager entry in the component route table.

## Data safety rules

- Read and write JSON through `utils/database.js`.
- Use `updateDatabase()` for read-modify-write operations so concurrent
  commands cannot overwrite each other.
- Do not store secrets, tokens, or the ER:LC key in JSON records.
- Never delete historical staff, case, ticket, watchlist, LOA, or shift data
  during a code cleanup.
- Remote moderation must retain permission checks, confirmation, audit logs,
  and mock/dry-run support.

## Adding a slash command

1. Add the command under the appropriate `commands/<area>/` folder.
2. Export valid `data` and `execute` properties.
3. Add `.setDMPermission(false)` for server workflows.
4. Add Discord default permissions and a runtime permission check for staff
   or management actions.
5. Add focused tests, then run `node --test`.
6. Run `npm run deploy-commands` only when command metadata changes.

Internal helper files placed inside `commands/` must also be added to
`config/internalCommandModules.js`. Runtime loading, deployment, and tests all
use `utils/commandDiscovery.js`, so this list is now enforced consistently.

# Command Audit

Reviewed on August 9, 2026.

## Removed

- `/say` was removed because the branded `/embed` command covers the same
  purpose with safer presentation and clearer authorship.
- `/guide acknowledgements` and `/guide onboarding-status` were removed
  because the public Staff Guide no longer uses those workflows.
- `/movement` and its revoke helpers were removed because the focused
  `/promote`, `/demote`, and `/infraction` workflows already cover the
  staff actions the server uses.

Historical Staff Guide compliance data is preserved. No stored user or
ticket data was deleted.

## Kept

- `/setup` and `/config` remain because staff, award, leave, infraction,
  history, promotion, and case workflows depend on their configuration.
- `/staff` is the quick staff profile; `/history` is the complete record.
- `/promote`, `/demote`, and `/infraction` remain as the focused personnel
  and discipline workflows.
- `/doctor`, `?status`, and `?apicheck` serve different permission levels
  and depths of operational diagnosis.
- `?operations` is the full operations dashboard. The shorter read-only
  prefix commands remain useful for quick lookups.
- Session commands remain because each represents a distinct stage,
  alert, or reporting action in the session workflow.

## Recommendation

Keep rare administrative commands out of public-facing help where
appropriate instead of deleting working tools. Review actual usage logs
before the next cleanup so future removals are evidence-based. A future
ISRP Dashboard can surface the common workflows while leaving advanced
commands available to authorized staff.

# CampOps v0.8 — Guarded Delete

New commands:

```cmd
node .\scripts\deercamp-admin\deercamp-admin.mjs delete-preview <campId>
node .\scripts\deercamp-admin\deercamp-admin.mjs delete <campId> --project deercamp-47c12 --execute
```

Safety controls:

- protected-camp configuration with no command-line override
- automatic backup before deletion
- explicit `--execute` flag
- exact camp-ID confirmation
- dependency-safe deletion order
- post-delete verification
- JSON operation log

Protected IDs are stored in:

```text
config/protected-camps.json
```

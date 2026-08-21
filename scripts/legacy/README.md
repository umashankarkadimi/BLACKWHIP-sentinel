# Legacy Scripts

One-shot developer codemods from the project's AI-assisted development history.
They edited the codebase directly and are **not** part of the runtime or the
build. They are archived here for reference only — do not run them against the
current codebase; most reference code that no longer exists.

| Group | Files | What they did |
|---|---|---|
| Server rewrites | `rewrite_server.cjs`, `fix_server.cjs` | Full-file templates that became `backend/server.ts` |
| Backend patches | `patch_*.cjs`, `fix_errors.cjs`, `fix-db.cjs`, `fix-dotenv.cjs`, `fix-auth-backend.cjs`, `fix-server*.cjs` | Added routes, auth, SSE, collector, persistence over time |
| Frontend patches | `fix-app-*.cjs`, `fix-dashboard-*.cjs`, `fix-topbar*.cjs`, `fix-fetch.cjs`, `fix-ts.cjs`, `fix-all-ts.cjs`, `fix-login-block.cjs`, `fix-sensors.cjs`, `patch_authFetch*.cjs`, `patch_incident_view.cjs` | Wired authFetch, login, dark mode, sensors UI, TS fixes |
| Theming | `make_*.cjs`, `add_dark_mode.cjs`, `update_theme.cjs/.js`, `update_styles.sh` | Sed/string replacements that produced the black/red HUD look |
| Scratch tests | `test-*.cjs`, `test-*.ts`, `test-json.cjs` | Ad-hoc probes; superseded by `scripts/smoke-test.cjs` (`npm test`) |

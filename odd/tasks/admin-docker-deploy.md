# Admin Controls, Port 8123 & Docker Auto-Deploy

- **Goal:** Change default port to `8123`, add admin controls for announcements, scheduled match-disable window, manual/scheduled Docker image build/deploy, and granting items/coins to any user.

## Specs

- **S1 (Port 8123):** "cambia el puerto a 8123" — Default `PORT` is `8123` in `server/index.ts`, `Dockerfile`, `.env.example`.
- **S2 (Admin user & Announcements):** "agerga un usario admin que tenga la posibilidad de habilitar anuncios" — Admin can enable/disable and edit a global announcement banner; clients display it when enabled.
- **S3 (Scheduled match disable):** "deshabilitar partidas durante un horario fijo para no provocar caída de partidas" — Admin can configure a daily time window (`HH:MM`–`HH:MM`) during which new matches cannot be created/joined.
- **S4 (Image upload / deploy):** "además este puede habilitar la subida de nueva imagen automática (por horario) o manual" — `.github/workflows/docker.yml` builds & pushes to `ghcr.io` on push, schedule, or manual `workflow_dispatch`; admin can trigger manual deploy or configure auto-update settings from the admin panel.
- **S5 (Grant items/resources):** "también que pueda agregar itemss o recursos (como monedas) a cualquier usuario" — Admin can grant coins or catalog items to any user by ID.

## Tasks

- [ ] **T1** (S1) — Update default port to `8123` in `server/index.ts`, `Dockerfile`, `.env.example` | route: inline | commit: pending
- [ ] **T2** (S2, S3, S4, S5) — Add DB settings table & grant helpers in `server/db.ts`, maintenance window check in `server/rooms.ts`, and admin/public endpoints in `server/api.ts` | route: inline | commit: pending
- [ ] **T3** (S2, S3, S4, S5) — Add announcement banner in client app and admin controls in `src/client/ui/screens/admin.tsx` + `src/client/services/api.ts` | route: inline | commit: pending
- [ ] **T4** (S4) — Add `.github/workflows/docker.yml` for GHCR image build/push (push, cron, manual) | route: inline | commit: pending
- [ ] **T5** (S1–S5) — Add tests in `tests/server.test.ts` and run `npm.cmd run check` | route: inline | commit: pending

## Log

- **L1:** "entonces cambia el puerto a 8123, agerga un usario admin que tenga la posibilidad de habilitar anuncios y deshabilitar partidas durante un horario fijo para no provocar caída de partidas, además este puede habilitar la subida de nueva imagen automática (por horario) o manual. también que pueda agregar itemss o recursos (como monedas) a cualquier usuario."

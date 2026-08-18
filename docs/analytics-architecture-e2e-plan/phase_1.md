# Phase 1 — Batas keamanan privat dan autentikasi Directus

## Objective, dependencies, observable result

- **Dependency:** none; preserve baseline dirty tree.
- **Objective:** cut over existing Dashboard, Infografis, Tabular, Spasial, internal docs, and private assets from anonymous access to a real same-origin Directus session boundary.
- **Observable result:** anonymous dashboard navigation redirects to `/sign-in` with a validated `returnTo` query parameter; anonymous API returns 401; authenticated wrong policy returns 403; Application User works; logout/revocation clears access and private caches; only loopback service ports remain behind public Caddy.

Before work:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-1-before.json
git status --short --branch
```

## Closed file manifest

| Action | Path |
|---|---|
| modify | `.gitignore` |
| create | `.dockerignore` |
| create | `.env.example` |
| modify | `docker-compose.yml` |
| modify | `docker/Caddyfile` |
| modify | `docker/Dockerfile.directus` |
| modify | `services/storage/minioclient/entrypoint.sh` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/config/caddy/autosave.json` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/data/caddy/acme/acme-v02.api.letsencrypt.org-directory/users/default/default.json` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/data/caddy/acme/acme-v02.api.letsencrypt.org-directory/users/default/default.key` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/diskuk.tangkassiskamling.com/diskuk.tangkassiskamling.com.crt` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/diskuk.tangkassiskamling.com/diskuk.tangkassiskamling.com.json` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/diskuk.tangkassiskamling.com/diskuk.tangkassiskamling.com.key` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/data/caddy/instance.uuid` |
| delete from Git index; leave local runtime copy ignored | `services/caddy/data/caddy/last_clean.json` |
| create | `services/directus/migrations/20260819A-private-dashboard-access.js` |
| create | `services/directus/extensions/shared/auth.cjs` |
| modify | `services/directus/extensions/directus-extension-infografis/package.json` |
| create | `services/directus/extensions/directus-extension-infografis/src/index.js` |
| modify | `services/directus/extensions/directus-extension-infografis/dist/index.js` |
| modify | `services/directus/extensions/directus-extension-infografis/test/index.test.cjs` |
| modify | `services/directus/extensions/directus-extension-tabular/src/index.js` |
| modify | `services/directus/extensions/directus-extension-tabular/test/index.test.cjs` |
| modify | `services/directus/extensions/docs/package.json` |
| modify | `services/directus/extensions/docs/src/index.ts` |
| modify | `services/directus/extensions/docs/dist/index.js` |
| modify | `apps/web/package.json` |
| modify | `apps/web/pnpm-lock.yaml` |
| modify | `apps/web/nuxt.config.ts` |
| create | `apps/web/server/middleware/01-panel-proxy.ts` |
| create | `apps/web/server/utils/directus-proxy.ts` |
| create | `apps/web/server/utils/session-policy.ts` |
| create | `apps/web/app/middleware/auth.global.ts` |
| create | `apps/web/app/composables/useAuth.ts` |
| modify | `apps/web/app/plugins/directus.client.ts` |
| modify | `apps/web/app/plugins/query.ts` |
| modify | `apps/web/app/lib/idb.ts` |
| modify | `apps/web/app/lib/index.ts` |
| modify | `apps/web/app/components/auth/SignInForm.vue` |
| modify | `apps/web/app/pages/(auth)/sign-in.vue` |
| modify | `apps/web/app/components/nav/Header.vue` |
| modify | `apps/web/app/components/landing/LandingNav.vue` |
| create | `apps/web/vitest.config.ts` |
| create | `apps/web/playwright.config.ts` |
| create | `apps/web/tests/unit/session-policy.test.ts` |
| create | `apps/web/tests/fixtures/mock-directus.mjs` |
| create | `apps/web/tests/e2e/auth.spec.ts` |
| create | `scripts/provision-application-user.mjs` |
| create | `apps/web/tests/e2e/auth.directus.spec.ts` |

The eight `services/caddy/**` rows are removed from Git with `git rm --cached`; do not open or delete their local bytes. `.gitignore` must ignore `services/caddy/data/` and `services/caddy/config/` while preserving the existing `.agents/` dirty change. The approved scope amendment also creates a root `.dockerignore` that excludes all Caddy/runtime credentials, local storage volumes, dependency trees, and environment files from every Docker context.

## Exact symbols and search anchors

- `apps/web/nuxt.config.ts::routeRules`, `pwa.workbox.runtimeCaching`.
- `apps/web/app/plugins/directus.client.ts::createDirectus`, `authentication("session")`, `auth:unauthorized`.
- `apps/web/app/plugins/query.ts::onQueryError`, `persistQueryClient`.
- `apps/web/app/lib/idb.ts::queryPersistStore`, `geoJsonStore`, `layerGroupStore`, `layerOrderStore`.
- `apps/web/app/components/auth/SignInForm.vue::<form>` and current social/register/reset copy.
- `apps/web/app/components/nav/Header.vue::navLinks`, user dropdown, `Keluar` item.
- `directus-extension-tabular/src/index.js::handler`, all `router.get`, `router.post("/publish")`.
- `directus-extension-infografis/dist/index.js::handler` and its test import.
- `services/directus/extensions/docs/src/index.ts::handler`, `/assets/:file`, `/`, `/oas`.
- `docker-compose.yml::ports`, Directus session env, MinIO credentials.
- `services/storage/minioclient/entrypoint.sh::mc config host add`.

Run these read-only anchors before editing:

```bash
rg -n 'routeRules|/panel/assets|authentication\("session"\)' apps/web/nuxt.config.ts apps/web/app/plugins/directus.client.ts
rg -n 'router\.(get|post)' services/directus/extensions/directus-extension-tabular/src/index.js services/directus/extensions/directus-extension-infografis/dist/index.js
rg -n 'router\.get\("/(assets/:file|oas|)"' services/directus/extensions/docs/src/index.ts
rg -n '^\s+ports:|SESSION_COOKIE|MINIO_ROOT' docker-compose.yml
```

## Current contract and final desired contract

### Current

- `/dashboard/**` SSR and custom reads are anonymous.
- Directus SDK session mode is unused by a functional form; refresh/error handling is client-only.
- Public endpoints use raw Knex without accountability; wrong/missing filter can still query broad snapshots.
- Directus and storage use root/general DB credentials; non-Caddy ports bind all interfaces.
- Private asset and query state can survive logout.

### Final

- Role UUID is fixed as `7d6d493c-1a6d-4c59-9e74-40d42a7862eb`; policy UUID is `9325db4b-9518-41db-b122-8c667f2ce510`. Migration upserts role/policy/access/legacy dashboard permissions against pinned Directus 11.17.4; provisioning supplies user email/password only from environment.
- `requireDashboardAccountability(req)` returns 401 for no `accountability.user`, 403 for authenticated non-admin whose role differs, and allows Application User or admin. It executes before any database call.
- Nitro owns `/panel/**` HTTP proxying to private `NUXT_DIRECTUS_INTERNAL_URL`. Directus session `Set-Cookie` is forwarded unchanged; private responses get `Cache-Control: private, no-store`.
- Signed HttpOnly cookies `diskuk_session_started` and `diskuk_session_last_activity` use HMAC-SHA256 and `NUXT_SESSION_POLICY_SECRET`; absolute max 8h, idle max 30m. `/auth/refresh` does not roll activity. Failed/expired policy clears all auth cookies and returns 401.
- Mutating methods require exact same-origin `Origin`; missing/cross-origin browser origin returns 403. GET/HEAD remain origin-independent but authenticated where private.
- Directus runtime: `ACCESS_TOKEN_TTL=15m`, `SESSION_COOKIE_TTL=8h`, `REFRESH_TOKEN_TTL=9h`, `SESSION_COOKIE_SAME_SITE=lax`; production requires Secure cookies and HTTPS. Ephemeral HTTP tests explicitly set Secure false.
- Browser Directus WebSocket is disabled for this MVP; no current consumer needs it, and HTTP remains the only policy-enforced path.
- Sign-in uses email/password, show/hide password, generic failure, safe local `returnTo`, loading/disabled state. Logout calls Directus, clears TanStack memory, persisted queries, private IndexedDB stores, Workbox private caches, and policy cookies.
- No `/panel/assets` Workbox rule. `/images` and `flagcdn` public caching remain.
- Postgres, MinIO, console, Directus, and web host bindings are loopback only. Caddy is the only all-interface ingress. Directus image is pinned to 11.17.4.
- MinIO bootstrap creates separate Directus-storage and analytics-export users/prefix policies from environment; runtime services no longer receive root credentials.

## Ordered edits

1. Pin Directus, set every existing extension host compatibility to Directus 11, and convert extension builds to clean source builds. Create Infografis `src/index.js`, add its build script, update tracked dist, build docs, and retain build-before-test for Tabular.
2. Add the role/policy migration and environment-only provisioning script. The script is idempotent, never accepts secrets in argv, never prints credentials, and verifies the resulting role through authenticated `/users/me`.
3. Add shared accountability helper and apply it to every Infografis and Tabular GET, `/publish`, and docs/assets/OAS handler. Preserve dirty spatial route/filter work. `/publish` remains admin-only in this phase.
4. Add Nitro session-policy and proxy deep module. Proxy forwards method/body/query/cookies and selected headers, strips hop-by-hop headers, handles multi-value `Set-Cookie`, enforces origin on mutations, signs policy cookies after successful login, and clears them after logout/401.
5. Replace routeRules proxy and browser WebSocket; expose only private runtime config for internal Directus URL and public nonsecret feature flags.
6. Add SSR-aware global middleware and `useAuth`: guard only `/dashboard` and descendants, allow public pages/sign-in, validate `returnTo` with same-origin path rules, bootstrap `/panel/users/me`, and prevent redirect loops.
7. Replace sign-in copy/behavior; use the real current user in Header; implement desktop/mobile logout; remove public registration/reset/social controls from sign-in and landing nav.
8. Add `clearPrivateClientState` and call it on logout, revocation, 401, user change, and policy expiry. Remove private asset CacheFirst rule.
9. Restrict ports and provision MinIO least-privilege users. Add `.env.example` with placeholders only and production assertions.
10. Untrack Caddy runtime files without reading them. Record key rotation/history cleanup as required production confirmation, not as source completion.
11. Add Vitest/Playwright harness, deterministic mock Directus, unit auth-policy tests, mock browser tests, and actual ephemeral Directus browser tests.

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Anonymous SSR direct navigation and client navigation; stale session; revoked session; malformed/expired/tampered policy cookie.
- Application User, wrong role, break-glass admin; unauthorized handler must make zero DB calls.
- Safe nested return URL with query/hash; `//evil`, absolute URL, encoded backslash, and non-dashboard path fall back to `/dashboard`.
- Login invalid email and invalid password show the same message and timing class; no account enumeration.
- Mutation with same-origin, cross-origin, `Origin: null`, and missing browser origin.
- Logout while Directus is down still clears local/private state.
- Two sequential users in one browser context do not share query/asset/SSR payload.
- Idle boundary 29:59 allowed, 30:00 denied; absolute boundary 7:59:59 allowed, 8:00 denied; refresh at 29:50 does not reset activity.
- Proxy upstream timeout returns generic 502 with correlation ID; no upstream stack/body credential is logged.
- Landing render performs no `/panel/infografis`, `/panel/tabular`, or `/panel/analitik` request.

## Validation commands

Narrow source/package gates:

```bash
(cd services/directus/extensions/directus-extension-infografis && pnpm run build && pnpm test)
(cd services/directus/extensions/directus-extension-tabular && pnpm run build && pnpm test)
(cd services/directus/extensions/docs && pnpm run build)
(cd apps/web && pnpm install --frozen-lockfile && pnpm run typecheck)
(cd apps/web && pnpm run test:unit -- tests/unit/session-policy.test.ts)
(cd apps/web && pnpm exec playwright test tests/e2e/auth.spec.ts)
python3 -m py_compile docs/analytics-architecture-e2e-plan/scope_guard.py
node --check scripts/provision-application-user.mjs
```

Expected: every command exits 0; endpoint tests include anonymous 401, wrong-role 403, allowed role, admin-only publish, and zero-DB-call denial; browser mock auth suite passes.

Compose config gate:

```bash
docker compose --env-file .env.example config --quiet
```

Expected: exit 0; rendered non-Caddy host mappings begin with `127.0.0.1`, Directus image is `directus/directus:11.17.4`, and no runtime service receives `MINIO_ROOT_*`.

Actual ephemeral runtime gate, after user permits local image builds/pulls:

```bash
cp .env.example /tmp/diskuk-auth-e2e.env
set -a; . /tmp/diskuk-auth-e2e.env; set +a
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-auth-e2e up -d --build postgis pgbouncer minio minioclient directus web
node scripts/provision-application-user.mjs
(cd apps/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/e2e/auth.directus.spec.ts)
docker compose --env-file /tmp/diskuk-auth-e2e.env -p diskuk-auth-e2e down -v
```

Expected: exit 0; teardown removes only project `diskuk-auth-e2e` ephemeral volumes.

## Runtime/browser proof and unproven boundary

Required actual Directus proof: cookie attributes over HTTPS, `/dashboard` redirect, every existing custom route 401/403/2xx matrix, logout/revocation, two-session cache isolation, Directus Admin access for break-glass only, and loopback port scan. Production key rotation/history cleanup remains `blocked` until user supplies an external receipt; source must not claim keys rotated.

## No-advance condition

All narrow gates, Compose config, and actual ephemeral Directus browser suite must pass. Do not advance on mock-only auth proof. Caddy runtime paths must be untracked and ignored. Production deployment remains prohibited until key rotation/history response and production Secure-cookie proof are confirmed.

## Required failure probes

- Tamper one signature byte; expect 401 and cleared cookies.
- Send wrong-role request to every custom route; expect 403 and no raw query.
- Send cross-origin PATCH/POST; expect 403.
- Revoke session after page hydration; next API request must redirect and clear caches.
- Stop Directus during logout; local browser state must still clear.
- Request private asset before login and after logout; expect 401, not service-worker cache.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, contract yang memaksa perubahan, efek dependency, dan gate tambahan. Setelah edit selesai, jalankan:

```bash
python3 docs/analytics-architecture-e2e-plan/scope_guard.py check \
  --snapshot /tmp/analytics-phase-1-before.json \
  --manifest docs/analytics-architecture-e2e-plan/scope_manifest.json \
  --phase 1
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback source changes as one phase commit only after preserving user overlap. Runtime rollback restores the prior image/config, but never republishes anonymous endpoints as a silent fallback. Handoff to Phase 2 only with the private boundary `proven`.

# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Development mode: Directus remote (`dev:direct`)

Frontend-only development against the production Directus, without the local Docker stack:

```bash
pnpm dev:direct   # from the repo root
```

Starts the Nuxt dev server on `http://localhost:3000`. Every `/panel/*` request is proxied by the
`/panel/**` route rule in `nuxt.config.ts` to `PANEL_URL` (the `/panel` prefix is stripped), with
cookies preserved, so login and sessions are handled by Directus itself. To point at a different
Directus, set `PANEL_URL` when starting the app (it is read when the config loads):

```bash
PANEL_URL=https://directus.example.com pnpm dev   # from apps/web
```

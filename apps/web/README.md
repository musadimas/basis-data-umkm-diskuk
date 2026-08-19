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

Starts the Nuxt dev server on `http://localhost:3000`. Every `/panel/*` request is forwarded by the
Nitro proxy (`server/middleware/01-panel-proxy.ts`) to
`https://diskuk.tangkassiskamling.com/panel/*` with the path, cookies, and a rewritten `Origin`
preserved, so login and session handling are enforced by the production Directus proxy itself. To
point at a different Directus, run the app directly:

```bash
NUXT_DIRECTUS_PROXY_TARGET=https://example.com pnpm dev   # from apps/web
```

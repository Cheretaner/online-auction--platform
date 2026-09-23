# Cheretanet web app

React, TypeScript, Vite and Tailwind CSS frontend for the auction API. Routes and feature modules live under `src/`; API requests go through `src/lib/api`, and server state uses TanStack Query.

## Local development

From the repository root:

```sh
pnpm install
pnpm --filter @auction/shared build
pnpm dev
```

The Vite server proxies `/api` and `/health` to `http://localhost:3000`. Start the API separately with `pnpm dev:api`. Copy `packages/web/.env.example` to `packages/web/.env.local` to set local overrides.

## Environment

| Variable                 | Purpose                                                                           |
| ------------------------ | --------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | Optional API origin. Leave blank in local development to use the Vite proxy.      |
| `VITE_APP_NAME`          | Public application name.                                                          |
| `VITE_VOXIDE_PUBLIC_KEY` | Optional Voxide publishable key (`vox_pub_…`). Leave blank to omit the assistant. |

Vite variables are bundled into browser code. Never put server secrets in `VITE_*` variables.

## Voxide voice assistant

Create a Voxide project and copy its publishable key into `VITE_VOXIDE_PUBLIC_KEY`. `localhost` is permitted for development. Before deployment, add each frontend origin to that project's domain whitelist. Voice requires microphone permission and HTTPS outside localhost.

The global widget is mounted next to the router so it stays mounted through route changes. Its only data capabilities read the API's public auction catalogue and open a listed public auction. It does not expose account, bidder, or organization data, and it has no voice-triggered mutation tools. Voxide processes voice and text conversations through its hosted service. Tell visitors when they are using an AI assistant and review Voxide's [privacy and redaction documentation](https://voxide.app/docs/privacy) and your application's privacy notice before enabling it for users.

See the [Voxide React quickstart](https://voxide.app/docs/quickstart), [actions guide](https://voxide.app/docs/actions), and [security guide](https://voxide.app/docs/security) for project configuration and domain restrictions.

## Validation

```sh
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web build
```

The service worker precaches versioned frontend assets. API requests use network-only caching so offline data cannot be mistaken for current auction state.

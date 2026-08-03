# Repository instructions

Run `pnpm check` and `pnpm test` after a TypeScript or SST change.

Run `pnpm install` after a dependency change.

Keep runtime configuration in repository variables and secrets. Do not add runtime configuration files.

Keep the connector unprivileged. Restrict Linux network changes to the edge.

Use `docs/setup.md` as the only deployment procedure.

Do not commit a package token, provider token, or Tailscale auth key.

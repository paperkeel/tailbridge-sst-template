# Set up Tailbridge

This template deploys the published Tailbridge component. It does not build Tailbridge source code.

## Create the repository

1. Create a public repository from this template.

2. Do not fork the Tailbridge source repository.

3. Keep the default branch name `master`.

4. Enable GitHub Actions for the repository.

## Add the package token

1. Create a GitHub personal access token with the `read:packages` scope.

2. Give the token access to the `paperkeel` package.

3. Add the token as the `GH_PACKAGES_TOKEN` secret in the `production` environment.

4. For local work, configure the token in your user-level npm configuration.

Do not put the token in the repository `.npmrc` file.

## Add deployment secrets

Add these secrets to the GitHub `production` environment:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Stores encrypted SST state in Cloudflare R2. |
| `DIGITALOCEAN_TOKEN` | Manages the shared edge. |
| `GH_PACKAGES_TOKEN` | Reads the Tailbridge package. |
| `RAILWAY_TOKEN` | Manages the Railway connector services. |
| `TAILSCALE_AUTH_KEY` | Registers the edge in the tailnet. |

Use a reusable and preauthorized Tailscale auth key. Apply the `tag:tailbridge` tag to the key.

The workflow sends the Tailscale key to SST through standard input. It does not write the key to a file.

## Add deployment variables

Add these required variables to the GitHub `production` environment:

| Variable | Value |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account for SST state. |
| `EDGE_SSH_SOURCE_CIDRS` | A comma-separated list of administrative CIDRs. |
| `TAILBRIDGE_CONNECTORS_JSON` | A JSON array of Railway connectors. |

The workflow adds its public IPv4 address as a temporary `/32` source.

These variables are optional:

| Variable | Default |
|---|---|
| `DIGITALOCEAN_REGION` | `nyc3` |
| `DIGITALOCEAN_SIZE` | `s-1vcpu-1gb` |
| `TAILBRIDGE_EDGE_ID` | `production` |
| `TAILBRIDGE_VIRTUAL_NETWORK` | `fd20::/11` |

Do not change `TAILBRIDGE_EDGE_ID` after the first deployment.

Use this connector format:

```json
[
  {
    "name": "billing",
    "slot": 0,
    "projectId": "replace-me",
    "environmentId": "replace-me",
    "region": "us-west2",
    "realPrefix": "fd12::/16"
  }
]
```

Use a unique name and slot for each connector. Use slots from `0` through `31`.

Keep a connector in the same slot after its first deployment.

## Run the first deployment

1. Open the `Tailbridge deployment` workflow.

2. Start a manual run.

3. Leave `package_version` empty.

4. Review the type check, tests, and SST diff in the workflow log.

5. Wait for the production deployment to finish.

6. Add the returned routes to the Tailscale policy.

7. Approve the routes if the policy does not approve them automatically.

8. Configure split DNS for each returned connector suffix and nameserver.

## Receive updates

The deployment workflow polls the package `master` tag each hour.

The workflow resolves the tag to an exact immutable package version.

It compares the version with the SST `artifactVersion` output.

If the versions match, the scheduled workflow stops without a deployment.

If the versions differ, the workflow updates the dependency only on its temporary runner.

The workflow then runs the type check, tests, SST diff, and production deployment.

## Roll back an update

1. Find an exact working version in an earlier successful workflow run.

2. Start the `Tailbridge deployment` workflow manually.

3. Enter the exact version in `package_version`.

4. Review the SST diff.

5. Wait for the deployment to finish.

The next hourly run deploys `master` again if that tag points to a different version.

## Use local SST state

Cloudflare is the default SST state home. Production automation requires the Cloudflare state home.

Set `SST_HOME=local` only for a disposable local test.

Local state does not provide shared deployment locks or remote recovery.

Do not run a production deployment from two state homes.

## Remove the deployment

1. Set the same variables and provider credentials that the deployment uses.

2. Run `pnpm sst remove --stage production`.

3. Confirm that SST removed the edge and connector services.

4. Delete retained edge volumes only after you confirm that recovery is unnecessary.

5. Remove the Tailscale machine after SST removal succeeds.

SST does not delete referenced Railway projects or environments.

## Recover a deployment

1. Stop all deployment workflows.

2. Restore the Cloudflare SST state before you change infrastructure.

3. Keep the original `TAILBRIDGE_EDGE_ID` and connector slots.

4. Keep the retained DigitalOcean volume.

5. Start a manual deployment with the last working exact package version.

6. Verify the edge identity, routes, DNS, and every connector.

If the state cannot be restored, inspect all retained resources before a new deployment.

An unrelated new deployment can create duplicate resources and a new Tailscale identity.

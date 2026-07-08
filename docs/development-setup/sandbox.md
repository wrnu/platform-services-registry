# Sandbox Environment

The development sandbox serves as an isolated environment for local development and testing, separate from the live system. This setup grants full control over local data and mock interfaces.

## Pre-requisites

Due to BC Government procurement restrictions, Docker Desktop is not permitted. However, the following alternatives are approved:

-   Docker Engine (with Docker CLI)
-   Podman
-   Rancher Desktop

### Docker Setup

=== "Mac"

      1. `brew install docker`
      1. `brew install docker-compose`
      1. `brew install docker-buildx`
      1. Add symlinks in `~/.docker/cli-plugins`
         1. `ln -s $HOMEBREW_PREFIX/lib/docker/cli-plugins/docker-buildx docker-buildx`
         1. `ln -s $HOMEBREW_PREFIX/lib/docker/cli-plugins/docker-compose docker-compose`
      1. Login to docker
         1. `docker login`
      1. Start VM. Example (using podman):
         1. `podman machine init`
         1. `podman machine start`

=== "Windows"

      Refer to these blog posts on how to install Docker without Docker Desktop:

      * [How to install wsl2 ubuntu + docker + docker-compose](https://gist.github.com/martinsam16/4492957e3bbea34046f2c8b49c3e5ac0)
      * [Mastering Docker on WSL2: A Complete Guide Without Docker Desktop](https://medium.com/h7w/mastering-docker-on-wsl2-a-complete-guide-without-docker-desktop-19c4e945590b)
      * [Installing Docker, and Docker-Compose, in WSL2/Ubuntu on Windows](https://codingwithcalvin.net/installing-docker-and-docker-compose-in-wsl2ubuntu-on-windows/)

## Getting Started

1. Create three directories to mount volumes for `mongodb`, `postgres` and `mailpit`.

In the root of the project directory:

```bash
mkdir -p sandbox/mnt/mongodb
mkdir -p sandbox/mnt/postgres
mkdir -p sandbox/mnt/mailpit
```

If you have data version conflict errors due to existing mount volumes, please delete the directories and recreate them.

2. Run the sandbox environment

The Makefile uses docker-compose.

For WSL/Linux:

```bash
make sandbox
```

To run in detached mode:

```bash
make sandbox SBD=true
```

For Mac M1/M2

```bash
make localmac
```

To run in detached mode:

```bash
make localmac SBD=true
```

Ensure that neither `MongoDB` nor `Mongosh` is installed on your local machine, as they may interfere with the database schema managed by Prisma, which connects to the `MongoDB Docker container`. If you have either installed, you can remove them by following the instruction provided in this link: [uninstall mongodb and mongosh](https://www.mongodb.com/resources/products/fundamentals/uninstall-mongodb#:~:text=How%20to%20uninstall%20MongoDB%20from%20Mac%201%20If,the%20below%20command%3A%20brew%20uninstall%20mongodb-community%20%20){target="\_blank" rel="noopener noreferrer"}

## Services

Within the local Docker container environment, **10 services** are available:

1. **Keycloak**
   Handles user authentication for the application via browser-based login.

2. **Keycloak Provision**
   Provisions the local Keycloak realm, clients, and users.

3. **PostgreSQL**
   Serves as the database for Keycloak.

4. **MongoDB**
   Serves as the database for the local application; you can use [MongoDB Compass](https://www.mongodb.com/products/tools/compass){target="\_blank" rel="noopener noreferrer"} to explore the local database.

5. **Microsoft 365 Mock**
   A mock server for Microsoft Graph API endpoints.

6. **CHES Mock**
   Simulates the Common Hosted Email Service (CHES) for local email delivery and testing.

7. **NATS**
   Acts as the message broker for communication with the Provisioner.

8. **NATS Provision**
   A mock Provisioner service for handling provisioning requests.

9. **WeasyPrint Server**
   Converts HTML and CSS content into downloadable PDF documents.

10. **Mailpit**
    A lightweight email testing tool that captures and inspects outgoing emails.
    - See [Mailpit GitHub Repository](https://github.com/axllent/mailpit){target="\_blank" rel="noopener noreferrer"} for more details.

> For complete service definitions, refer to the [docker-compose.yml](https://github.com/bcgov/platform-services-registry/blob/main/sandbox/docker-compose.yml){target="\_blank" rel="noopener noreferrer"} file.

### Access Details

-   **Keycloak (HTTP)**: [http://localhost:8080](http://localhost:8080)
-   **Keycloak (HTTPS)**: [https://localhost:8443](https://localhost:8443)
-   **Keycloak Realm**: `platform-services`
-   **Keycloak Client ID**: `pltsvc`
-   **Keycloak Client Secret**: `testsecret`
-   **MongoDB URL**: `mongodb://localhost:27017`
-   **Microsoft 365 Proxy URL**: [http://localhost:8000](http://localhost:8000)
-   **CHES Mock URL**: [http://localhost:3025](http://localhost:3025)
-   **Mailpit URL**: [http://localhost:8025](http://localhost:8025)

> Mock user details can be found in the [mock-users.json](https://github.com/bcgov/platform-services-registry/blob/main/sandbox/mock-users.json){target="\_blank" rel="noopener noreferrer"} file.
> Passwords are derived by converting user email addresses to lowercase.

### Seed local application data

After starting the sandbox and running `prisma db push`:

**Full seed (recommended)** — ministries, users, cost rules, Azure product `e71b0e`, accountability demo data:

```bash
cd app
pnpm run prisma-push
pnpm run seed-all-local
```

**Minimal seed** — organizations and users only:

```bash
cd app
pnpm run prisma-push
pnpm run seed-local
```

Refresh the browser so the ministry dropdown and user search are populated. When filling team contacts, search by email (at least 3 characters), e.g. `admin.system` or `gov.bc`.

To skip the billing eMOU **Review** step locally (after signing as expense authority):

```bash
pnpm run approve-local-emou
```

This marks signed billings as approved and closes the reviewer task. If you are provisioning a new product, approve the create request:

```bash
pnpm run approve-local-request
```

This approves pending CREATE requests, creates the product, and marks the request provisioned (skips public reviewer UI and NATS).

### Seed accountability demo data

After a product exists (e.g. licence plate `e71b0e`), populate CSP spend, history, an approved forecast, and a sample A1 alert:

```bash
pnpm run seed-accountability-local
```

Options:

```bash
# Different licence plate
pnpm run seed-accountability-local -- abc123

# Clear accountability data for the product and re-seed
pnpm run seed-accountability-local -- --reset

# CSP data only (test forecast create / submit / approve in the UI)
pnpm run seed-accountability-local -- --skip-forecast --reset
```

The script prints a walkthrough checklist. Open the product budget section on the **Product** tab:

`http://localhost:3000/public-cloud/products/e71b0e/edit`

Login as `admin.system@gov.bc.ca` (password from mock-users.json — email lowercased).

After seeding, verify current month spend on the **Costs** tab:

`http://localhost:3000/public-cloud/products/e71b0e/costs`

## Sharing your local sandbox (Cloudflare Tunnel)

Use [cloudflared](https://github.com/cloudflare/cloudflared) (Apache 2.0) to expose your local app and Keycloak over HTTPS so others can try the sandbox without VPN access.

**Use mock data only.** Do not tunnel environments with real credentials or production-like secrets. Confirm your team’s policy allows third-party tunnel relays before sharing outside your machine.

### Install

=== "Mac"

```bash
brew install cloudflared
```

=== "Linux"

See [Cloudflare Tunnel install docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/){target="\_blank" rel="noopener noreferrer"}.

### Start tunnels

With the sandbox and Next dev server running locally, **in a dedicated terminal** (leave it open while sharing):

```bash
make tunnel
```

`make tunnel` blocks until you press Ctrl+C (which stops tunnels and restores `.env.local`). For a non-blocking start: `make tunnel DETACHED=true`.

This script:

1. Starts two quick tunnels — app (`localhost:3000`) and Keycloak (`localhost:8080`)
2. Backs up `app/.env.local` to `sandbox/.tunnel/.env.local.bak`
3. Sets `BASE_URL`, `AUTH_BASE_URL`, `AUTH_SERVER_URL`, and related Keycloak URLs in `.env.local`
4. Prints the **share URL** (the app tunnel)

**Restart the dev server** after starting tunnels so Next.js picks up the new env vars (use Ctrl+C in the dev terminal, not `lsof -ti:3000 | xargs kill`):

```bash
cd app && pnpm run dev
```

Share the printed `https://….trycloudflare.com` URL. Viewers log in with mock users from [mock-users.json](https://github.com/bcgov/platform-services-registry/blob/main/sandbox/mock-users.json){target="\_blank" rel="noopener noreferrer"} (password = email lowercased).

Local Keycloak allows any redirect URI (`redirectUris: ['*']`), so OAuth works with the tunnel URLs without extra Keycloak config.

### Stop tunnels

```bash
make tunnel-stop
```

Stops `cloudflared`, restores `.env.local` from the backup, and returns you to localhost URLs. Restart the dev server again.

### Check status

```bash
make tunnel-status
```

### Notes

-   Quick tunnel URLs change every time you run `make tunnel`. Re-share after each restart.
-   If you see Cloudflare error **1033**, the tunnel process stopped — run `make tunnel` again (older scripts exited when `make` finished; use the latest `cloudflared-tunnel.sh`).
-   Next.js dev mode blocks tunnel hostnames by default; `next.config.js` uses `BASE_URL` for `allowedDevOrigins` when not on localhost.
-   Set `NEXTAUTH_URL` to the app tunnel URL (done automatically by `make tunnel`) so the Login button and session work through the tunnel.
-   For a stable hostname, use a [named Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/){target="\_blank" rel="noopener noreferrer"} with a free Cloudflare account.
-   Tunnels only forward the app and Keycloak. Mailpit (`localhost:8025`) and other sandbox services stay local unless you add more tunnels.

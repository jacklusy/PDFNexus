# Deployment — Oracle Cloud walkthrough

This is a click-by-click guide for deploying PDFNexus to a single Oracle Cloud
"Always Free" ARM VM, written for someone who has never used Oracle Cloud
before. It runs the whole stack — Postgres, Redis, MinIO, Gotenberg, the API,
and the web app — as Docker containers on one machine, behind Caddy for
automatic HTTPS.

You'll need, before starting:
- A domain name (any registrar). You'll create 3 DNS records with it.
- The GitHub repo pushed and accessible: `https://github.com/jacklusy/PDFNexus.git`

---

## Step 1 — Create the VM

In the Oracle Cloud Console:

1. Click **☰ (hamburger menu, top-left) → Compute → Instances**, then **Create Instance**.
   (Or use the **Create a VM instance** shortcut on the Home page.)
2. **Name**: `pdfnexus-prod`.
3. **Image and shape** → click **Edit**:
   - Click **Change image** → **Canonical Ubuntu** → pick **Canonical Ubuntu 24.04** → **Select image**.
   - Click **Change shape** → **Ampere** → **VM.Standard.A1.Flex** → set **OCPU = 4**, **Memory = 24 GB** → **Select shape**.
   This is your full Always Free ARM allowance — no cost as long as you stay at or under it.
4. **Networking**: leave "Create new virtual cloud network" selected, and confirm **"Assign a public IPv4 address"** is turned **on** — you need this to reach the server from the internet.
5. **Add SSH keys**: select **"Generate a key pair for me"**, then click **Save private key** — this downloads a `.key` file (e.g. `ssh-key-2026-xx-xx.key`) to your Downloads folder. This file is your password to the server; keep it safe, you cannot re-download it.
6. Leave boot volume at its default (~50 GB — plenty, and inside the free 200 GB limit).
7. Click **Create**.

Wait for the instance state to change from *Provisioning* to *Running* (1–3 minutes). On the instance's detail page, copy the **Public IP address** shown under "Instance access" — you'll need it constantly from here on.

> If instance creation fails with **"Out of host capacity"**: this is Oracle's free ARM tier being oversubscribed in Frankfurt. Change the **Availability Domain** in the Placement section and click Create again, or just retry a few minutes later.

---

## Step 2 — Open the cloud firewall

By default Oracle only allows SSH (port 22) in. You need to open 80 and 443 for the website.

1. On the instance detail page, find **Primary VNIC** → click the **Subnet** link (something like `subnet-...`).
2. On the subnet page, under **Security Lists**, click **Default Security List for `<your-vcn-name>`**.
3. Click **Add Ingress Rules**, and add these two rules (Source Type: **CIDR**, Source CIDR: **0.0.0.0/0**, IP Protocol: **TCP**):
   - Destination Port Range: **80**
   - Destination Port Range: **443**
4. Click **Add Ingress Rules** to save.

---

## Step 3 — Connect to the VM

From PowerShell on your PC (adjust the path to wherever the `.key` file downloaded):

```powershell
ssh -i "$env:USERPROFILE\Downloads\ssh-key-2026-xx-xx.key" ubuntu@<PUBLIC_IP>
```

Type `yes` when asked to confirm the host fingerprint. If SSH refuses the key over file permissions, run this once and retry:

```powershell
icacls "$env:USERPROFILE\Downloads\ssh-key-2026-xx-xx.key" /inheritance:r
icacls "$env:USERPROFILE\Downloads\ssh-key-2026-xx-xx.key" /grant:r "$($env:USERNAME):(R)"
```

Everything from here on runs **inside this SSH session**, on the Ubuntu server — not on your PC.

---

## Step 4 — Open the VM's own firewall

Oracle's Ubuntu image also blocks 80/443 with a *second*, VM-level firewall (`iptables`), separate from the console rule you just added. Both must be open:

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

If `netfilter-persistent` isn't found:
```bash
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```
(answer "yes" to the prompts it shows.)

---

## Step 5 — Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit
```

That `exit` closes the SSH session — this is required for the permission change to take effect. Reconnect with the same `ssh -i ...` command from Step 3, then confirm it worked:

```bash
docker --version
docker compose version
```

---

## Step 6 — Get the code onto the VM

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/jacklusy/PDFNexus.git
cd PDFNexus
```

> If the repo is private, cloning over plain `https://` will ask for credentials and fail. Create a token at github.com → Settings → Developer settings → Personal access tokens (read-only, repo scope), then clone with:
> `git clone https://<TOKEN>@github.com/jacklusy/PDFNexus.git`

---

## Step 7 — About "the database" (read this before Step 8)

You do **not** need to create a database anywhere in the Oracle console. There's no separate database service to provision.

[docker-compose.prod.yml](../docker-compose.prod.yml) already includes Postgres as one of the containers. When you start the stack in Step 9:

1. Docker downloads and starts a `postgres:16-alpine` container.
2. Postgres auto-creates an empty database named `pdfnexus` (from the `POSTGRES_DB` setting baked into the compose file).
3. In Step 10, `prisma migrate deploy` connects to that empty database and creates all the actual tables the app needs (users, files, jobs, etc.).

The only thing *you* provide is a password for it — that's the `POSTGRES_PASSWORD` value you'll set in the next step. Nothing to click or provision in the Oracle console for this.

---

## Step 8 — Configure `.env`

```bash
cp .env.example .env
nano .env
```

Generate random secrets as you go. Two commands, depending on where the value is used:

```bash
openssl rand -base64 32   # for standalone secrets (COOKIE_SECRET, ADMIN_SESSION_SECRET)
openssl rand -hex 24      # for anything embedded inside a URL (POSTGRES_PASSWORD, S3_SECRET_KEY)
```

Base64 output can contain `/`, `+`, and `=`, which need percent-encoding inside a connection string like `DATABASE_URL` — easy to get wrong and it fails silently. Hex only uses `0-9a-f`, so it's always safe to drop straight into a URL. Run either command again each time you need a fresh value — it prints a new random string every time.

Edit these values in `.env` (everything not listed here can stay as-is from the example):

| Variable | What to set it to |
|---|---|
| `POSTGRES_PASSWORD` | An `openssl rand -hex 24` secret (hex — this goes inside a URL). Also update the password inside `DATABASE_URL` on the line above it to match (username `pdfnexus`, host `postgres`, e.g. `postgresql://pdfnexus:<same-hex-secret>@postgres:5432/pdfnexus?schema=public`). |
| `REDIS_URL` | `redis://redis:6379` |
| `COOKIE_SECRET` | An `openssl rand -base64 32` secret. |
| `APP_URL` | `https://app.yourdomain.com` |
| `API_URL` | `https://api.yourdomain.com` |
| `ALLOWED_ORIGINS` | Same as `APP_URL`. |
| `S3_ACCESS_KEY` | A username you choose, e.g. `pdfnexus-prod`. This becomes MinIO's login too — same idea as `POSTGRES_PASSWORD` in Step 7, just for object storage instead of the database. |
| `S3_SECRET_KEY` | An `openssl rand -hex 24` secret. |
| `GOTENBERG_URL` | `http://gotenberg:3000` |
| `MAIL_PROVIDER` | `resend` (there's no Mailpit in production) |
| `RESEND_API_KEY` | See below. |
| `MAIL_FROM` | `PDFNexus <noreply@yourdomain.com>` |
| `ADMIN_SESSION_SECRET` | An `openssl rand -base64 32` secret. |
| `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` | Your real admin login — pick a strong password, you'll use it to log into `/admin`. |
| `NEXT_PUBLIC_API_URL` | Same as `API_URL`. |
| `NEXT_PUBLIC_APP_URL` | Same as `APP_URL`. |
| `NEXT_PUBLIC_STORAGE_URL` | `https://storage.yourdomain.com` |

Leave `GEMINI_API_KEY` and the `GOOGLE_*` variables empty unless you specifically want OCR or Google Drive import — those endpoints just return "unavailable" when unset, nothing breaks.

**Getting a `RESEND_API_KEY`:** sign up free at resend.com → verify a sending domain (or use their sandbox `onboarding@resend.dev` sender while testing) → **API Keys** in the left sidebar → **Create API Key** → copy it into `.env`.

Save and exit nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## Step 9 — Point your domain at the VM

At your DNS provider (Cloudflare recommended), create three **A records**, all pointing at the VM's public IP from Step 1:

```
app.yourdomain.com      →  <PUBLIC_IP>
api.yourdomain.com      →  <PUBLIC_IP>
storage.yourdomain.com  →  <PUBLIC_IP>
```

If using Cloudflare, set them to **DNS only (grey cloud)** for now — Caddy needs to complete a direct HTTP challenge with Let's Encrypt before you switch to proxied (orange cloud). DNS changes can take a few minutes to propagate; you can check with `https://dnschecker.org`.

---

## Step 10 — Start everything

Still inside the SSH session, in the `PDFNexus` folder:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

First run takes several minutes — it's building the API and web images from scratch. `-d` runs it in the background, so you get your prompt back; check on it with:

```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show `running` (or `healthy`). If something shows `restarting`, check its logs (see Troubleshooting below).

Once Postgres is healthy, create the actual database tables:

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

---

## Step 11 — Verify it's live

```bash
curl https://api.yourdomain.com/api/health
```
Should return a JSON `ok` response. Then open `https://app.yourdomain.com` in a browser, and try uploading and downloading a file to confirm the storage domain and CORS are working end-to-end.

---

## Troubleshooting

- **A container keeps restarting** — `docker compose -f docker-compose.prod.yml logs -f <service>` (e.g. `api`, `postgres`). Usually a missing/incorrect `.env` value.
- **Caddy won't get a certificate / site doesn't load over HTTPS** — almost always DNS hasn't propagated yet, or port 80/443 is still blocked somewhere (recheck Step 2 *and* Step 4 — both must be open). Check: `docker compose -f docker-compose.prod.yml logs caddy`.
- **502 Bad Gateway from Caddy** — the backend it's proxying to isn't up yet or crashed; check that service's logs.
- **Login doesn't work / redirects loop** — `APP_URL`, `API_URL`, and `ALLOWED_ORIGINS` in `.env` must exactly match the real HTTPS domains (no trailing slash, no `http://`).
- **File upload fails / CORS error in browser console** — `NEXT_PUBLIC_STORAGE_URL` must be the public `https://storage.yourdomain.com` address, and `MINIO_API_CORS_ALLOW_ORIGIN` (driven by `APP_URL` in the compose file) must match the app's real origin.
- **"Out of host capacity" when creating the instance** — see the note at the end of Step 1.

## Updating the app later

```bash
cd ~/PDFNexus
git pull
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

---

## Reference

- `GET /api/health` — liveness + OCR budget hint
- `GET /api/ready` — readiness (DB connectivity)
- `FilesCleanupService` periodically deletes expired finals — tune `FILE_TTL_DAYS` in `.env`.
- API logs are structured Pino JSON. Filenames, emails, and base64 payloads are intentionally excluded from free-text logs.
- Never put `GEMINI_API_KEY`, `COOKIE_SECRET`, or S3 secrets in any `NEXT_PUBLIC_*` variable — those are shipped to the browser.

### Testing the production compose file locally (optional)

Before deploying, you can sanity-check `docker-compose.prod.yml` on your own machine with `localhost` values in `.env` (same as `.env.example` defaults) — just note Caddy won't be able to issue real certificates for `localhost`, so this is only useful for confirming the containers build and start, not for testing HTTPS.

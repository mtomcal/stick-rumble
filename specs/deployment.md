# Deployment (AWS MVP)

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-04-11
> **Depends On**: [networking.md](networking.md), [rooms.md](rooms.md), [messages.md](messages.md)
> **Depended By**: —

---

## Overview

This spec defines the first production deployment target for Stick Rumble: **a small, publicly reachable environment where the project owner and a handful of friends can play**. It intentionally does **not** describe a scalable, highly-available, or multi-region architecture. The target is MVP: reachable from the public internet, secure at the transport layer, cheap enough to leave running, and simple enough that every piece maps to a service the owner is studying for the AWS Certified Cloud Practitioner (CLF-C02) exam.

**Why AWS specifically?**
The project owner is preparing for the Cloud Practitioner exam and wants a real deployment to be the study vehicle. The value of this spec is not architectural elegance — it is that every service used here appears on the exam blueprint, so doing the work teaches exam-relevant vocabulary in the process.

**Why this particular shape (EC2 + Caddy + S3 + CloudFront)?**
1. EC2, S3, CloudFront, IAM, and ACM are among the most heavily tested services on the Cloud Practitioner exam; using them in anger is the most efficient study material.
2. A single-process Go server with a WebSocket endpoint fits trivially on one EC2 instance. There is no reason to introduce container orchestration, load balancers, or multi-AZ concerns at this scale.
3. Splitting the static client (S3 + CloudFront) from the game server (EC2) matches how real AWS workloads are shaped and avoids putting a CDN in front of a long-lived WebSocket origin — which works but adds configuration surface that does not pay rent at MVP scale.
4. Caddy as a TLS terminator on the EC2 box provides automated Let's Encrypt certificates with near-zero configuration, removing the single largest operational chore (certbot renewals).

**What this spec is not:**
- Not a production-hardened topology. There is no autoscaling, no multi-AZ, no managed DB, no WAF, no DDoS protection beyond what CloudFront and the security group provide by default.
- Not a CI/CD pipeline spec. Deployment steps are described manually; automating them is a follow-up.
- Not a custom-domain / Route 53 spec. MVP uses AWS-provided default hostnames (CloudFront distribution domain, EC2 public DNS). A custom domain can be added later without changing anything else.

---

## Dependencies

### Spec Dependencies

- [networking.md](networking.md) — WebSocket lifecycle, origin check, reconnection
- [rooms.md](rooms.md) — Matchmaking and named-room behavior that must survive the public deployment
- [messages.md](messages.md) — Client–server message contract
- Friends-MVP gameplay changes in [player.md](player.md) (display name) and [rooms.md](rooms.md#named-room-join) (room codes) must already be implemented before this deployment is useful

### External Dependencies

| Component | Purpose | MVP Reason |
|-----------|---------|------------|
| AWS EC2 | Host the Go game server process | Cheapest always-on compute that still maps to the exam |
| AWS S3 | Store the built React client bundle (`dist/`) | Durable, cheap static storage |
| AWS CloudFront | Global CDN in front of S3 for the client | Free TLS on the AWS-issued default domain, low latency |
| AWS ACM | TLS certificates (CloudFront cert is AWS-issued; server cert is Let's Encrypt via Caddy) | Browser requires `wss://` for production WebSockets |
| AWS IAM | Instance role for EC2, bucket policy for S3 | Shared-responsibility boundary, explicit on the exam |
| Caddy (on EC2) | Reverse proxy + TLS terminator in front of the Go binary | Automated Let's Encrypt eliminates cert chores |
| systemd (on EC2) | Supervise the Go binary and Caddy | Boring, built-in, survives reboots |

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `GAME_SERVER_PORT` | `8080` | Go server listens on loopback only |
| `PUBLIC_TLS_PORT` | `443` | Caddy terminates WSS on the public interface |
| `HTTP_REDIRECT_PORT` | `80` | Caddy redirects plain HTTP to HTTPS (ACME HTTP-01 challenge also uses this) |
| `EC2_INSTANCE_TYPE` | `t4g.small` (ARM) or `t3.micro` (x86, free-tier eligible) | Graviton is cheaper; free-tier is free for first 12 months |
| `CLIENT_BUCKET_NAME` | project-chosen, globally unique | S3 bucket holding the built React app |
| `CLIENT_DIST_PATH` | `stick-rumble-client/dist/` | Source of the uploaded static bundle |

---

## Target Topology

```
                   ┌──────────────────────┐
  Players ──────▶  │  CloudFront          │  ──▶  S3 bucket (static client)
  (HTTPS)          │  default domain      │        (private, OAC-restricted)
                   │  *.cloudfront.net    │
                   └──────────────────────┘

                   ┌──────────────────────┐
  Players ──────▶  │  EC2 public DNS      │  ──▶  Caddy :443 ──▶ Go server :8080
  (WSS)            │  *.compute.aws       │       (TLS term.)     (loopback only)
                   └──────────────────────┘
```

Two independent public surfaces, two independent TLS stories, zero shared state between them. Either can be rebuilt without touching the other.

**Why not put CloudFront in front of the EC2 server too?**
CloudFront supports WebSockets, but doing so introduces an extra origin configuration, an extra cert, and an extra hop that obscures latency attribution during debugging. For ten friends on one instance, it buys nothing.

---

## Game Server: EC2 Instance

### Shape

- **Instance type**: `t4g.small` (Graviton, ARM64) if cost is the priority; `t3.micro` if 12-month free tier is the priority. The Go server cross-compiles to both.
- **OS**: Amazon Linux 2023, updated at provision time.
- **Disk**: default 8 GiB gp3 root volume. Nothing persistent runs here — if the instance dies, recreate it.
- **Public IP**: enabled. Elastic IP is optional but recommended so the public DNS does not change across stop/start cycles (matters because `VITE_WS_URL` is baked into the client bundle at build time).

### Security Group

Ingress allowlist (deny everything else by default):

| Port | Protocol | Source | Reason |
|------|----------|--------|--------|
| 22 | TCP | owner's current IP only | SSH for operations; narrow the source when the owner's IP changes |
| 80 | TCP | `0.0.0.0/0` | Let's Encrypt HTTP-01 challenge + HTTP → HTTPS redirect |
| 443 | TCP | `0.0.0.0/0` | Public WSS endpoint |

Egress: default (all outbound allowed). The server makes no outbound calls in normal operation; restricting egress adds operational friction without meaningful security benefit at MVP scale.

**Why not expose 8080 directly?**
Browsers reject plain `ws://` from an `https://` page. Exposing 8080 also means a self-managed TLS story on the Go server, which is strictly worse than terminating TLS at Caddy.

### Process Layout

One EC2 instance runs two services under systemd:

1. `stick-rumble.service` — the Go binary. Listens on `127.0.0.1:8080` only. Never reachable from the internet directly.
2. `caddy.service` — the Caddy reverse proxy. Listens on `:80` and `:443`. Handles TLS (Let's Encrypt via ACME HTTP-01 on port 80) and forwards `/ws` (and any future HTTP paths) to `127.0.0.1:8080`.

**Why loopback-only for the Go server?**
Caddy is the only process that should be able to reach the game server. Binding to loopback makes that a hard invariant instead of a security-group-dependent one.

**Why systemd?**
Built into Amazon Linux, restarts the service on crash, starts it on boot, and writes a structured journal. No new infrastructure.

### TLS Story

Caddy manages Let's Encrypt certificates automatically for whatever hostname it is configured to serve. For MVP, that hostname is the EC2 instance's public DNS (e.g. `ec2-1-2-3-4.us-west-2.compute.amazonaws.com`). Let's Encrypt issues certs for AWS default DNS names without any domain ownership paperwork beyond the ACME HTTP-01 challenge, which Caddy handles on port 80.

**Why not AWS ACM on the EC2 side?**
ACM-issued certs can only be used by AWS services that ACM integrates with (ELB, CloudFront, API Gateway). They cannot be exported to a raw EC2 instance. Let's Encrypt is the correct tool here.

**Why not skip TLS entirely?**
Browsers block `ws://` connections initiated from an `https://` page, and the static client will be served over HTTPS. Therefore the server side must be `wss://`, which requires a cert.

### `CheckOrigin` Hardening

The current Go server uses `CheckOrigin: return true` on the WebSocket upgrader, which accepts connections from any origin. For the deployed environment this MUST be tightened to allow only the CloudFront distribution's default domain (and optionally `http://localhost:*` for development builds). Add the allowlist to the server config via environment variable:

```
ALLOWED_ORIGINS=https://<distribution-id>.cloudfront.net,http://localhost:5173
```

**Why restrict origins?**
A permissive origin check lets any other website open a WebSocket to the server using a user's browser session, which would be a trust boundary violation even in the absence of cookies.

### Environment Variables

| Variable | Value | Consumed By |
|----------|-------|-------------|
| `PORT` | `8080` | Go server bind address |
| `ALLOWED_ORIGINS` | comma-separated HTTPS origins | WebSocket upgrader `CheckOrigin` |
| `LOG_LEVEL` | `info` | Go server logger |

### IAM Instance Role

Attach a minimal instance role to the EC2 instance:

- Managed policy `AmazonSSMManagedInstanceCore` — enables SSM Session Manager, so SSH can eventually be retired.
- Nothing else. The game server does not need to read or write any other AWS resource.

**Why SSM at all if SSH works?**
SSM is what the Cloud Practitioner exam calls "managed access without opening SSH ports," and it is free. Having it available means the owner can close port 22 entirely when they want to.

---

## Static Client: S3 + CloudFront

### S3 Bucket

- **Name**: project-chosen, globally unique, lowercase with hyphens.
- **Region**: same region as the EC2 instance for operational simplicity (not a latency consideration since CloudFront fronts it).
- **Public access**: **blocked**. All four "Block Public Access" switches stay on.
- **Access policy**: only the CloudFront distribution (via **Origin Access Control** / OAC) may read objects. No other principal is allowed.
- **Versioning**: optional. Enabling it is cheap insurance against a bad client build; disable if not wanted.

**Why not enable S3 static website hosting and make the bucket public?**
Public buckets are the single most common AWS misconfiguration and a named item on the exam. Using CloudFront + OAC is the correct modern pattern, and it is not meaningfully more work.

### CloudFront Distribution

- **Origin**: the S3 bucket above, accessed via OAC (not the legacy OAI).
- **Default root object**: `index.html`.
- **Viewer protocol policy**: redirect HTTP to HTTPS.
- **Allowed methods**: `GET`, `HEAD`. (The client bundle is static; no mutating methods needed.)
- **Cache policy**: AWS managed `CachingOptimized` for everything except `index.html`, which should have a short or `no-store` cache to make redeploys visible immediately. Vite produces content-hashed asset filenames, so the hashed assets can be cached aggressively without stale-content risk.
- **TLS certificate**: default `*.cloudfront.net` certificate issued by AWS (no ACM request needed until a custom domain is added).
- **Price class**: `PriceClass_100` (North America + Europe) to minimize cost; the owner's friends are on those continents.

**Why CloudFront at all for ten friends?**
Two reasons. First, HTTPS on a default AWS-issued hostname is free and automatic through CloudFront but cumbersome directly on S3. Second, CloudFront is an exam-blueprint item and the setup itself is the study material.

### `VITE_WS_URL` Build-Time Configuration

The Vite build bakes `VITE_WS_URL` into the bundle at build time. Set it to the Caddy-fronted EC2 endpoint before running `npm run build`:

```
VITE_WS_URL=wss://<ec2-public-dns>/ws
```

**Why build-time and not runtime?**
It is how the current client is written. Changing to runtime lookup is a separate refactor and is not required for MVP. The consequence is that changing the server hostname requires a rebuild and a re-upload of the S3 bucket contents — acceptable at MVP cadence.

---

## Deployment Steps (Manual, MVP)

These steps are manual on purpose. Automating them with Terraform / CDK / GitHub Actions is a follow-up once the shape is stable.

### One-time AWS setup

1. Create the S3 bucket with public access blocked.
2. Create the CloudFront distribution with S3 origin + OAC, default root object `index.html`, viewer policy redirect-to-HTTPS.
3. Apply the bucket policy that grants read access to the CloudFront distribution (CloudFront generates this for you; copy and attach it).
4. Launch the EC2 instance with the chosen AMI, instance type, security group, and SSM instance role.
5. (Optional) Attach an Elastic IP to the instance so its public DNS is stable across stop/start.
6. SSH (or SSM) into the instance. Install Caddy via Amazon Linux's package manager. Install Go only if you plan to build on the instance; otherwise cross-compile locally and upload the binary.

### Server deploy

1. Locally: `GOOS=linux GOARCH=arm64 go build -o server cmd/server/main.go` (or `amd64` for `t3.micro`).
2. Copy `server` to the instance (`scp` or S3 intermediary).
3. On the instance: place the binary at `/usr/local/bin/stick-rumble`, write a minimal systemd unit that runs it as a dedicated system user and sets `PORT`, `ALLOWED_ORIGINS`, and `LOG_LEVEL`.
4. Write a Caddyfile that proxies `<ec2-public-dns>` to `127.0.0.1:8080`. Enable and start both services (`systemctl enable --now stick-rumble caddy`).
5. Verify `curl -I https://<ec2-public-dns>/` returns a TLS handshake success (Caddy will have auto-provisioned the cert at this point).

### Client deploy

1. Locally: `VITE_WS_URL=wss://<ec2-public-dns>/ws npm run build` in `stick-rumble-client/`.
2. Upload `dist/` contents to the S3 bucket, preserving paths.
3. Create a CloudFront invalidation on `/index.html` (cheap — one path) so the new root picks up immediately.
4. Visit the CloudFront distribution URL, confirm a match connects to the game server.

### Smoke test

1. Open the CloudFront URL in two browser tabs (or two machines).
2. Enter distinct display names, both using `mode: "public"` first.
3. Confirm both land in the same public room and can see each other.
4. Refresh, switch to `mode: "code"` with an agreed code (e.g. `TEST`), confirm both land in the same named room.
5. Fill the room to 8 and try a 9th connect with the same code — confirm `error:room_full`.

---

## Error Handling and Failure Modes

### TLS Provisioning Fails

**Trigger**: Caddy cannot reach Let's Encrypt or ACME HTTP-01 challenge fails
**Detection**: `journalctl -u caddy` shows ACME errors; `https://` on the EC2 host returns a cert error
**Response**: Ensure port 80 is open in the security group (ACME HTTP-01 uses it), confirm the public DNS name resolves correctly, retry. Rate-limited by Let's Encrypt — avoid flailing.
**Recovery**: Caddy retries automatically on its own schedule.

### S3 Upload Succeeds but CloudFront Serves Old Content

**Trigger**: New `dist/` uploaded, browser still sees the old build
**Detection**: Visible in-browser, or via `curl -I` showing `X-Cache: Hit from cloudfront`
**Response**: Create a CloudFront invalidation on `/index.html`. Content-hashed assets do not need invalidation because their filenames change on every build.
**Recovery**: Invalidation completes in a minute or two.

### `wss://` Connection Refused

**Trigger**: Client loads but cannot open a WebSocket
**Detection**: Browser console shows WebSocket error; server journal shows no corresponding upgrade attempt
**Response**: Verify the security group allows 443 inbound from `0.0.0.0/0`; verify Caddy is running; verify the Go server is listening on `127.0.0.1:8080`; verify `ALLOWED_ORIGINS` includes the CloudFront distribution hostname.
**Recovery**: Fix whichever of the above is wrong. No state loss.

### Instance Reboot

**Trigger**: AWS maintenance event, accidental stop/start, or crash
**Detection**: Public DNS changes if no Elastic IP attached
**Response**: If the public DNS changed, the client bundle's baked `VITE_WS_URL` is stale. Either reattach an Elastic IP (preferred) or rebuild + re-upload the client with the new DNS.
**Recovery**: `systemctl` restarts both services automatically on boot.

---

## Cost Envelope

Rough monthly cost at MVP scale, running 24/7:

| Component | Cost |
|-----------|------|
| EC2 `t4g.small` | ~$12 |
| EBS 8 GiB gp3 | ~$0.65 |
| S3 storage + requests | < $0.10 |
| CloudFront (ten friends, occasional use) | < $1 |
| Data transfer out | < $1 |
| **Total** | **~$15** |

On `t3.micro` with the 12-month free tier, this drops to effectively $0 for the first year. Turning the instance off between play sessions cuts EC2 cost to near zero regardless of instance type.

---

## Exam-Relevance Map (Cloud Practitioner CLF-C02)

Every service used by this deployment appears on the exam blueprint. Rough mapping:

| Service used here | Exam domain |
|-------------------|-------------|
| EC2 (instance types, AMIs, EBS, security groups, key pairs) | Domain 3: Cloud Technology and Services |
| S3 (buckets, Block Public Access, OAC) | Domain 3 |
| CloudFront (distributions, origins, cache policies) | Domain 3 |
| IAM (instance roles, policies, shared responsibility) | Domain 2: Security and Compliance |
| ACM / Let's Encrypt distinction | Domain 2 |
| Free tier vs. on-demand pricing | Domain 4: Billing, Pricing, and Support |
| SSM Session Manager | Domain 3 |
| CloudWatch journaling (via EC2 metrics defaults) | Domain 3 |

Going through the deployment by hand exercises each of these in a way flashcards do not.

---

## Implementation Notes

- The Go server is stateless between connections. An instance restart drops all in-flight matches. This is acceptable at MVP scale; persistent matches are out of scope.
- There is no database. Scores live only for the duration of a match and are discarded when the room is destroyed.
- There is no backup, because there is no state worth backing up. The S3 bucket contents are reproducible from the client source tree.
- Custom domain names and Route 53 hosted zones are deliberately deferred. Adding them later is additive: request an ACM cert for the domain, attach it to the CloudFront distribution, point a Route 53 A/ALIAS record at the distribution, rebuild the client with the new `VITE_WS_URL` if the EC2 hostname changes.
- HTTPS for the game server could eventually be upgraded to an ACM-backed ALB in front of the EC2 instance, which would be more "correct" AWS but is unnecessary complexity for MVP.

---

## Test Scenarios

### TS-DEPLOY-001: Public Page Loads over HTTPS

**Category**: Smoke
**Priority**: Critical

**Input**: Fetch the CloudFront distribution URL in a browser.

**Expected Output**:
- HTTPS handshake succeeds using the `*.cloudfront.net` cert
- `index.html` loads and renders the React app
- No mixed-content warnings in the browser console

### TS-DEPLOY-002: WebSocket Upgrade Succeeds over WSS

**Category**: Smoke
**Priority**: Critical

**Input**: From the loaded React app, initiate a WebSocket connection to `wss://<ec2-public-dns>/ws`.

**Expected Output**:
- Upgrade succeeds
- Server accepts the connection
- Client is able to send `player:hello` and receive `room:joined`

### TS-DEPLOY-003: Origin Check Rejects Foreign Origins

**Category**: Security
**Priority**: High

**Input**: Attempt a WebSocket upgrade from a page served on an origin NOT listed in `ALLOWED_ORIGINS` (e.g. `https://example.com`).

**Expected Output**:
- Server rejects the upgrade (HTTP 403 or connection close)
- No `room:joined` message is sent

### TS-DEPLOY-004: Eight Friends, One Named Room

**Category**: End-to-end
**Priority**: High

**Input**: Eight distinct browsers connect to the deployed client and submit `player:hello { mode: "code", code: "friends" }`.

**Expected Output**:
- All eight land in the same `RoomKindCode` room
- Match starts and runs to completion
- A ninth client submitting the same code receives `error:room_full`

### TS-DEPLOY-005: Redeploy Without Downtime for the Game Server

**Category**: Operations
**Priority**: Medium

**Input**: Upload a new client build to S3 and invalidate `/index.html`.

**Expected Output**:
- New client build is served on next page load
- Existing `wss://` sessions are unaffected (game server was not touched)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-11 | Initial MVP AWS deployment spec: EC2 + Caddy + loopback Go server, S3 + CloudFront + OAC for static client, default AWS hostnames, `ALLOWED_ORIGINS` hardening, manual deploy steps, cost envelope, Cloud Practitioner exam mapping. |

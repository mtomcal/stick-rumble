# Deployment Runbook: AWS MVP (First Manual Deploy)

> **Runbook Version**: 1.0.0
> **Last Updated**: 2026-04-14
> **Depends On**: [deployment.md](deployment.md)
> **Status**: Completed — live at a custom domain, family playtest successful

---

## Purpose

This document records the first manual deployment of Stick Rumble to AWS. It serves two purposes:

1. **Ops reference** — enough detail to reproduce the deployment in a fresh AWS account, or to hand off operations to another person.
2. **Automation brief** — the decisions, surprises, and concrete values that a future Terraform or CDK implementation will need to get right the first time. Spec documents describe intent; this document describes what actually happened.

Read `deployment.md` first for architecture rationale. This document assumes that context and only records the deltas: what the spec did not anticipate, where assumptions broke, and what the working configuration looks like.

### Learning Vehicle Context

The project owner is using this deployment as a hands-on study vehicle for AWS certifications, starting with the **AWS Certified Cloud Practitioner (CLF-C02)**. The MVP topology — EC2, S3, CloudFront, IAM, ACM/Let's Encrypt — was deliberately chosen to cover the exam blueprint in practice rather than on flashcards.

This is the first step. The intention is to pursue higher certifications (Solutions Architect Associate, then potentially Developer or SysOps) and to use this project as the learning vehicle at each stage. That means the deployment architecture will deliberately grow in sophistication over time, not because the game requires it, but because building and operating the infrastructure *is the point*. Future iterations might introduce:

- **Route 53** (DNS management, health checks, routing policies)
- **Terraform or CDK** (infrastructure as code — the immediate next step)
- **ALB + ACM** (replacing the Caddy/Let's Encrypt pattern with managed AWS TLS)
- **ECS or Fargate** (containerized deploys, replacing the on-instance git/build flow)
- **RDS or DynamoDB** (if persistent state ever becomes a game requirement)
- **CloudWatch dashboards and alarms** (observability beyond systemd journald)
- **CI/CD via GitHub Actions or CodePipeline** (automated deploy on push)

Each of these maps to exam domains at the Associate level and above. When a future engineer or AI agent sees the architecture grow in a direction that seems over-engineered for the game's actual scale, this is the reason — the deployment is a study vehicle first and a production system second.

---

## What Was Deployed

| Surface | Technology | Location |
|---------|-----------|----------|
| Static client | S3 + CloudFront | CloudFront default domain (`*.cloudfront.net`) |
| Game server | EC2 + Caddy + Go binary | Custom domain, port 443 (WSS) |
| TLS (server) | Let's Encrypt via Caddy ACME | Managed automatically by Caddy |
| TLS (client) | AWS-issued `*.cloudfront.net` cert | Managed automatically by CloudFront |

The two surfaces are fully independent. Either can be rebuilt and redeployed without touching the other.

---

## Surprise Log

These are the places where the spec's assumptions did not hold and required adaptation. Each is a mandatory input to any future automation effort.

### 1. Let's Encrypt Refuses EC2 Default Hostnames

**What the spec said**: Use the EC2 instance's public DNS hostname (e.g. `ec2-1-2-3-4.us-west-2.compute.amazonaws.com`) as the Caddy-managed TLS hostname. Run a pre-flight validation before committing.

**What happened**: The pre-flight failed immediately. Let's Encrypt returns `urn:ietf:params:acme:error:rejectedIdentifier` for `*.compute.amazonaws.com` hostnames — they are permanently blacklisted by policy, not rate-limited. This affects all AWS default EC2 hostnames regardless of region.

**Resolution**: Registered a custom domain (`stickrumble.com`) and pointed a DNS `A` record (`play.stickrumble.com`) at the Elastic IP. Caddy acquired a Let's Encrypt cert for the custom hostname without issue.

**Automation implication**: Any Terraform or CDK implementation must assume a custom domain is required. There is no path to production TLS using EC2 default hostnames. The automation should accept a `var.server_domain` input (e.g. `play.stickrumble.com`) and configure Caddy accordingly. The custom domain's DNS must resolve to the EIP before Caddy starts — the ACME HTTP-01 challenge will fail otherwise.

---

### 2. Caddy Is Not in Amazon Linux 2023 Default Repos

**What the spec said**: Install Caddy via Amazon Linux's package manager.

**What happened**: `sudo dnf install caddy` returns `No match for argument: caddy`. Caddy is not in the default Amazon Linux 2023 package repositories.

**Resolution**: Installed via the official Caddy COPR repository:
```bash
sudo dnf install -y 'dnf-command(copr)'
sudo dnf copr enable -y @caddy/caddy epel-9-$(arch)
sudo dnf install -y caddy
```

**Automation implication**: Any user data script or Ansible/SSM playbook provisioning the EC2 instance must include the COPR enable step before attempting to install Caddy. Alternatively, use the Caddy static binary (download from `caddyserver.com/api/download`) to avoid the COPR dependency entirely — simpler for automation.

---

### 3. Server Requires Schema Files at Runtime via Relative Paths

**What the spec said**: Cross-compile the Go binary locally and copy it to the instance.

**What happened**: The Go server (`internal/network/schema_loader.go`) loads JSON schema files at startup by searching a hardcoded list of relative paths from its working directory:
```
../events-schema/schemas/client-to-server
../../events-schema/schemas/client-to-server
../../../events-schema/schemas/client-to-server
```

A standalone binary with no accompanying schema directory crashes at startup with:
```
FATAL: Failed to load client-to-server JSON schemas from any path
```

**Resolution**: Cloned the full repository to `/opt/stick-rumble` on the instance and built the binary there with `go build`. The systemd unit sets `WorkingDirectory=/opt/stick-rumble/stick-rumble-server`, so the first relative path (`../events-schema/schemas/client-to-server`) resolves correctly against the repo checkout.

**Automation implication**: There are two valid paths forward for automation:

- **Option A (current)**: Clone the repo to the instance, build on-instance, set `WorkingDirectory` in systemd. Redeploy = `git pull && go build && systemctl restart`. Simple; requires Go installed on the instance.
- **Option B (better long-term)**: Embed the schema files into the binary using Go's `//go:embed` directive. Produces a truly standalone single-file binary; removes the repo-on-instance dependency. This is a small code change (`internal/network/schema_loader.go`) and is the recommended path before building a CI/CD pipeline.

Until Option B is implemented, any automation that tries to deploy a pre-built binary will fail without also deploying the schema directory alongside it.

---

### 4. S3 with OAC Returns 403 (Not 404) for Missing Objects

**What the spec said**: Configure CloudFront error pages to handle 404s for SPA routing.

**What happened**: When a browser requests a path that doesn't exist as an S3 object (e.g. `/match/abc`), S3 returns `403 Forbidden`, not `404 Not Found`. This is intentional AWS behavior — S3 with a private bucket and OAC does not distinguish "does not exist" from "you are not allowed to see this" to avoid leaking object names.

The practical effect: configuring only a 404 custom error response in CloudFront is insufficient. The game client (a React SPA) needs every unknown path to return `index.html` with a 200.

**Resolution**: Configured two CloudFront custom error responses:
- HTTP 403 → `/index.html`, response code 200, TTL 0
- HTTP 404 → `/index.html`, response code 200, TTL 0

**Automation implication**: Any Terraform `aws_cloudfront_distribution` resource must include both `custom_error_response` blocks. Configuring only the 404 is a common mistake and will leave the SPA routing broken for most real-world missing-path scenarios.

---

### 5. `index.html` Requires a Separate Upload with `no-store` Cache-Control

**What the spec said**: Upload `dist/` contents to the S3 bucket. Create a CloudFront invalidation on `/index.html` after each deploy.

**What happened**: `aws s3 sync` uploads all files without a `Cache-Control` header. CloudFront's `CachingOptimized` policy will cache `index.html` aggressively. Invalidations clear the edge cache but do not affect the browser cache — a user who has `index.html` cached locally will not see a new deploy until the browser cache expires.

**Resolution**: Run `aws s3 sync` for all assets, then upload `index.html` separately with explicit headers:
```bash
aws s3 sync dist/ s3://<bucket>/ --delete
aws s3 cp dist/index.html s3://<bucket>/index.html \
    --cache-control "no-store, max-age=0" \
    --content-type "text/html"
```

Content-hashed assets (everything in `assets/`) can be cached indefinitely — their filenames change on every build, making stale cache impossible. Only `index.html` needs `no-store`.

**Automation implication**: Any deploy script or CI step that only runs `aws s3 sync` is incomplete. The two-step pattern (sync then explicit `index.html` upload) should be part of every client deploy. Follow with a CloudFront invalidation on `/index.html` to clear the edge cache.

---

## Working Configuration Reference

This section records the working configuration for each component. Values that vary per environment (domain name, bucket name, account IDs, distribution IDs) are shown as placeholders — keep those in a private ops document, not here.

### EC2 Instance

| Parameter | Value |
|-----------|-------|
| AMI | Amazon Linux 2023 |
| Instance type | t3.micro (x86) or t4g.small (ARM) |
| Root volume | 8 GiB gp3 |
| Elastic IP | Required — attached to instance |
| IAM instance role | `AmazonSSMManagedInstanceCore` only |
| Security group inbound | 22/TCP (owner IP only), 80/TCP (0.0.0.0/0), 443/TCP (0.0.0.0/0) |
| Security group outbound | All traffic |

### Repo Layout on Instance

```
/opt/stick-rumble/                      ← repo root
├── events-schema/schemas/              ← required at runtime
│   ├── client-to-server/*.json
│   └── server-to-client/*.json
└── stick-rumble-server/
    └── server                          ← built binary
```

### systemd Unit (`/etc/systemd/system/stick-rumble.service`)

```ini
[Unit]
Description=Stick Rumble game server
After=network.target

[Service]
Type=simple
User=stickrumble
Group=stickrumble
WorkingDirectory=/opt/stick-rumble/stick-rumble-server
ExecStart=/opt/stick-rumble/stick-rumble-server/server
Restart=on-failure
RestartSec=5

Environment=PORT=8080
Environment=ALLOWED_ORIGINS=https://<cloudfront-distribution-domain>
Environment=LOG_LEVEL=info
Environment=GO_ENV=production

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Caddyfile (`/etc/caddy/Caddyfile`)

```
<your-domain> {
    reverse_proxy 127.0.0.1:8080
}
```

Caddy manages the Let's Encrypt certificate automatically. No manual cert operations needed. Renewal is automatic.

### S3 Bucket

| Parameter | Value |
|-----------|-------|
| Block Public Access | All four switches ON |
| Bucket policy | OAC-restricted read (CloudFront-generated policy) |
| Versioning | Enabled |
| Default encryption | SSE-S3 |

### CloudFront Distribution

| Parameter | Value |
|-----------|-------|
| Origin | S3 bucket via OAC |
| Default root object | `index.html` |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed methods | GET, HEAD |
| Cache policy | CachingOptimized (except `index.html` — see below) |
| Price class | PriceClass_100 (North America + Europe) |
| Custom error response: 403 | → `/index.html`, HTTP 200, TTL 0 |
| Custom error response: 404 | → `/index.html`, HTTP 200, TTL 0 |

---

## Manual Redeploy Procedures

### Redeploy Server

```bash
ssh -i ~/.ssh/stick-rumble-key.pem ec2-user@<eip>
cd /opt/stick-rumble
sudo -u stickrumble git pull
cd stick-rumble-server
sudo -u stickrumble go build -o server cmd/server/main.go
sudo systemctl restart stick-rumble
sudo journalctl -u stick-rumble -f
```

### Redeploy Client

```bash
cd stick-rumble-client
VITE_WS_URL=wss://<your-domain>/ws npm run build
aws s3 sync dist/ s3://<bucket-name>/ --delete
aws s3 cp dist/index.html s3://<bucket-name>/index.html \
    --cache-control "no-store, max-age=0" \
    --content-type "text/html"
aws cloudfront create-invalidation \
    --distribution-id <distribution-id> \
    --paths "/index.html"
```

---

## Known Gaps (Post-MVP Backlog)

These are items discovered during the first deploy that deviate from the spec's intent. They are not blocking for MVP but should be addressed before any significant expansion of the player base or before automation is built on top of this topology.

### 1. Go Server Binds to All Interfaces

**File**: `stick-rumble-server/cmd/server/main.go:35`
**Current**: `Addr: ":" + runtimeConfig.Port` (binds `0.0.0.0:8080`)
**Spec intent**: `127.0.0.1:8080` — loopback only, so the security group is not the sole barrier between the internet and the game server
**Fix**: Change to `Addr: "127.0.0.1:" + runtimeConfig.Port`

### 2. Empty `ALLOWED_ORIGINS` Defaults to Allow-All

**File**: `stick-rumble-server/internal/config/runtime.go:33-36`
**Current**: If `ALLOWED_ORIGINS` is unset or empty, `AllowsOrigin` returns `true` for all origins
**Spec intent**: Unset `ALLOWED_ORIGINS` in production (`GO_ENV=production`) must be a hard startup failure, not a silent open door
**Fix**: In `AllowsOrigin` (or at server startup), check `GO_ENV == "production" && len(AllowedOrigins) == 0` and either `log.Fatal` or return `false` for all origins

### 3. Schema Files Are Not Embedded in the Binary

**File**: `stick-rumble-server/internal/network/schema_loader.go`
**Current**: Loads schema JSON files from relative filesystem paths at runtime — requires the repo checkout to be present alongside the binary
**Better**: Use `//go:embed events-schema/schemas` to bundle the schemas into the binary at compile time, enabling single-file deploys and simpler CI/CD
**Note**: This requires the embed directive to be in a file within `stick-rumble-server/`, and the embedded path must be relative to the Go module root — verify this works with the monorepo layout before committing to it

---

## Automation Road Map

When this deployment is eventually automated, the above configuration and gap list are the primary inputs. Suggested sequence:

1. **Fix the three known gaps** before writing any automation — they are small code changes and it is better to automate the correct behavior from the start
2. **Embed schemas** (gap 3) to decouple the server binary from the repo checkout — this unlocks single-artifact deploys
3. **Write a Terraform module** (or CDK stack) covering: VPC/security group, EC2 + EIP + IAM role, S3 bucket + OAC policy, CloudFront distribution + error responses. Use the working configuration table above as the spec for each resource.
4. **Write a deploy script** (or GitHub Actions workflow) for the two redeploy procedures above — server and client are independent pipelines
5. **Consider Route 53** for DNS management alongside the Terraform module — currently DNS is managed at the registrar; moving it to Route 53 centralizes everything and is exam-relevant

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-14 | Initial runbook from first manual deploy — five surprises documented, working configuration recorded, known gaps identified |

# Epic 9: Polish & Production Launch

**Goal:** Players experience polished, reliable game ready for public audience

**Value Delivered:** Visual effects, audio, monitoring, stable deployment

**FRs Covered:** FR14 (HUD), FR16 (performance)

**Status:** Not Started (0/7 stories)

---

## Stories

### Story 9.1: Implement Visual Effects and Particles

As a player,
I want satisfying visual feedback,
So that combat feels impactful and polished.

**Acceptance Criteria:**

**Given** I am in combat
**When** I shoot a weapon
**Then** I see muzzle flash particle effect (bright flash, fades in 0.1s)

**And** bullet tracer: line from gun to impact point (visible for 0.2s)
**And** bullet impact: spark particles on wall hit, blood splatter on player hit
**And** damage numbers: floating text showing damage dealt (red, rises and fades)

**And** death effect: ragdoll animation + particle explosion
**And** weapon pickup: glow effect pulsing around weapon sprite
**And** respawn: fade-in effect with spawn protection glow

**And** screen shake on taking damage (camera shakes for 0.2s)
**And** all effects optimized (no FPS drop below 55 on desktop, 45 on mobile)

**Prerequisites:** Story 8.5

**Technical Notes:**
- Phaser particle emitters: `this.add.particles('spark').createEmitter({...})`
- Muzzle flash: 10-particle burst, lifespan 100ms, scale 0.5-1.5
- Bullet tracer: Phaser line graphic, alpha fades from 1 to 0 over 200ms
- Damage numbers: Phaser text object, moves up 50px while fading
- Blood splatter: 5-particle burst, red tint, sticks to ground for 2s
- Screen shake: `this.cameras.main.shake(200, 0.01)`
- Performance: pool particles (reuse instead of create/destroy)

---

### Story 9.2: Integrate Audio and Sound Effects

As a player,
I want clear, satisfying audio,
So that I can hear combat and feel immersed.

**Acceptance Criteria:**

**Given** I am in a match
**When** I shoot the Uzi
**Then** I hear rapid gunfire sound effect (matches 10/s fire rate)

**And** each weapon has unique sound:
- Uzi: rapid "brrt brrt" (high pitch)
- AK47: heavier "bang bang" (mid pitch)
- Shotgun: loud "boom" (low pitch, bass)
- Bat: "whoosh" then "thwack" on hit
- Katana: "slash" sound

**And** hit confirmation: distinct "ding" sound when landing shots
**And** footsteps: subtle step sounds (louder when sprinting)
**And** damage taken: grunt/impact sound
**And** death: death sound effect
**And** UI sounds: menu clicks, button hovers

**And** spatial audio: gunfire from other players has directional positioning
**And** volume controls: master, music, SFX (independent sliders in settings)

**Prerequisites:** Story 9.1

**Technical Notes:**
- Audio format: MP3 or OGG (browser-compatible)
- Source: royalty-free SFX packs (GameAudioGDC, Kenney.nl)
- Phaser audio: `this.sound.add('uzi_fire', {volume: 0.5})`
- Spatial audio: `sound.setVolume(distance < 400 ? 1.0 : 0.3)`, pan based on x position
- Sound pooling: create multiple sound instances for overlapping (e.g., multiple Uzi shots)
- Settings: `localStorage` stores volume preferences

---

### Story 9.3: Implement Kill Feed and Scoreboard HUD

As a player,
I want to see recent kills and current scores,
So that I can track match progress.

**Acceptance Criteria:**

**Given** I am in a match
**When** a kill occurs
**Then** kill feed updates (top-right corner): "[Killer] eliminated [Victim] with [Weapon]"

**And** kill feed shows last 5 kills, oldest fades out
**And** my kills highlighted in different color (green)
**And** kill feed includes weapon icon next to message

**And** scoreboard (Tab key):
- Shows all players ranked by kills
- Displays: Name, Kills, Deaths, Ping
- My row highlighted
- Updates in real-time

**And** match timer visible (top-center): "5:23 remaining"
**And** kill target progress: "First to 20 kills" (below timer)

**Prerequisites:** Story 9.2

**Technical Notes:**
- Kill feed: React component with array of kill events
- Kill event: `{killerId, victimId, weapon, timestamp}`
- Feed update: on `player:killed` message, add to feed, remove oldest if >5
- Fade animation: CSS transition, opacity 1->0 over 0.5s after 5 seconds
- Scoreboard: React component, visible when Tab pressed
- Scoreboard data: sorted by kills descending
- Timer: server sends `match:time` every second with remaining seconds
- Render: `Math.floor(seconds / 60)}:${seconds % 60}`

---

### Story 9.4: Implement Server Monitoring and Metrics

As a developer,
I want real-time server monitoring,
So that I can detect and fix issues proactively.

**Acceptance Criteria:**

**Given** the server is running
**When** I access monitoring dashboard (Grafana)
**Then** I see real-time metrics:
- Active players (gauge: current count)
- Active matches (gauge: room count)
- Server CPU usage (line chart: %)
- Server memory usage (line chart: MB)
- Average latency (line chart: ms)
- Messages per second (line chart: count)
- Error rate (line chart: errors/min)

**And** alerts configured:
- CPU >80% for 5 minutes -> alert
- Latency >150ms for 20% players -> alert
- Error rate >10/min -> alert
- Server crash -> immediate alert

**And** logs are structured (JSON) and searchable
**And** can drill down into specific player sessions

**Prerequisites:** Story 9.3

**Technical Notes:**
- Metrics library: Prometheus client for Go
- Expose metrics: `/metrics` endpoint (Prometheus scrape target)
- Metrics collected:
  - `active_players` (gauge)
  - `active_matches` (gauge)
  - `cpu_usage_percent` (gauge)
  - `memory_usage_bytes` (gauge)
  - `websocket_messages_total` (counter)
  - `latency_milliseconds` (histogram)
  - `errors_total` (counter)
- Grafana dashboard: import JSON with pre-configured panels
- Alerts: Prometheus Alertmanager with webhook to Discord/Slack
- Logging: structured JSON logs with `{level, message, playerId, timestamp}`

---

### Story 9.5: Deploy to Production with CI/CD Pipeline

As a developer,
I want automated deployments,
So that updates are deployed reliably and quickly.

**Acceptance Criteria:**

**Given** I push code to GitHub main branch
**When** CI/CD pipeline runs
**Then** automated tests execute (frontend + backend)

**And** if tests pass: build production artifacts
- Frontend: Vite build -> static assets
- Backend: Go binary compilation

**And** artifacts deployed:
- Frontend -> Vercel/Netlify (automatic deployment)
- Backend -> VPS via SSH (rsync + systemd restart)

**And** deployment completes in <10 minutes
**And** zero-downtime deployment: old server continues until new server ready
**And** rollback capability: if deployment fails, revert to previous version

**And** post-deployment: health check verifies server responding
**And** notification: Discord webhook announces deployment success/failure

**Prerequisites:** Story 9.4

**Technical Notes:**
- CI/CD: GitHub Actions workflow `.github/workflows/deploy.yml`
- Frontend deploy: Vercel GitHub integration (auto-deploy on push)
- Backend deploy steps:
  1. Run tests: `go test ./...`
  2. Build binary: `GOOS=linux GOARCH=amd64 go build -o server cmd/server/main.go`
  3. SCP to VPS: `rsync -avz server user@vps:/opt/stick-rumble/`
  4. Restart service: `ssh user@vps 'sudo systemctl restart stick-rumble'`
  5. Health check: `curl https://yourdomain.com/health`
- Zero-downtime: use systemd socket activation or blue-green deployment
- Rollback: keep last 5 binaries, script to revert: `cp server.backup server && systemctl restart`
- Notifications: use GitHub Actions Discord webhook action

---

### Story 9.5A: Backend Server Deployment to Cloud VPS

**MOVED FROM EPIC 1:** Production deployment belongs in polish/launch epic.

As a developer,
I want the backend Go server deployed to a cloud VPS with systemd service,
So that the game can be tested and played remotely in production.

**Acceptance Criteria:**

**Given** a VPS instance (DigitalOcean/Hetzner/Fly.io) provisioned
**When** I deploy the Go server binary
**Then** the server is accessible at `ws://[public-ip]:8080/ws`

**And** server runs as a systemd service (auto-restart on crash)
**And** systemd service file exists at `/etc/systemd/system/stick-rumble.service`
**And** firewall allows traffic on port 8080 (WebSocket) and port 443 (HTTPS)
**And** server logs are accessible via `journalctl -u stick-rumble -f`
**And** basic health check endpoint `/health` responds with 200 OK
**And** deploy script automates: build binary, transfer to VPS, restart service

**Prerequisites:** Core game features complete (Epic 2-8)

**Technical Notes:**
- VPS requirements: 2GB RAM, 2 vCPUs minimum, Ubuntu 22.04 LTS
- Systemd service: runs as non-root user `stickrumble`
- Deploy script: `deploy.sh` automates build + rsync + restart
- Server binary location: `/opt/stick-rumble/server`
- Environment variables: configure via `/etc/stick-rumble/.env`
- Basic deployment first (HTTP/WS), SSL/TLS added in Story 9.5B

---

### Story 9.5B: Frontend Deployment and SSL/TLS Configuration

**MOVED FROM EPIC 1:** SSL/TLS configuration for production launch.

As a developer,
I want the frontend deployed with SSL/TLS and configured to connect to the production backend,
So that players can access the game securely from anywhere.

**Acceptance Criteria:**

**Given** Story 9.5A backend is deployed and running
**When** I configure TLS/SSL certificate with Let's Encrypt
**Then** the server is accessible at `wss://[domain]/ws` (secure WebSocket)

**And** TLS/SSL certificate configured using Caddy or Certbot
**And** certificate auto-renews before expiration
**And** clients can connect from any network using wss:// protocol
**And** HTTP traffic redirects to HTTPS (port 80 -> 443)
**And** frontend build deployed to Vercel/Netlify
**And** environment variable `VITE_WS_URL=wss://yourdomain.com/ws` configured
**And** production frontend connects successfully to production backend
**And** deployment process documented in README.md

**Prerequisites:** Story 9.5A

**Technical Notes:**
- Use Caddy for automatic Let's Encrypt SSL (simpler than Certbot)
- Caddyfile config: reverse proxy from domain to localhost:8080
- Frontend deployment: Vercel (preferred) or Netlify with auto-deploy on git push
- Environment variables: separate `.env.production` for production WebSocket URL
- Test end-to-end: open production URL, verify WebSocket connection established
- Document: deployment process, domain DNS setup, troubleshooting

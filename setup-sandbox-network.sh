#!/bin/bash
# setup-sandbox-network.sh — Create Docker network with iptables allowlist.
# Run with: sudo ./setup-sandbox-network.sh
#
# Allowlist: Claude API, Statsig, Sentry, GitHub, npm registry, Go proxy, DNS.
# Everything else from the sandbox subnet is REJECTED.
#
# Re-run to refresh IPs (domain IPs rotate). Rules don't survive reboot.

set -euo pipefail

# --- Require root ---
if [ "$(id -u)" -ne 0 ]; then
    echo "error: this script must be run as root (sudo ./setup-sandbox-network.sh)" >&2
    exit 1
fi

# --- Check dependencies ---
for cmd in docker dig curl jq iptables; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "error: '$cmd' is required but not found" >&2
        exit 1
    fi
done

NETWORK_NAME="sandbox-net"
SUBNET="172.30.0.0/24"

# --- Create network (idempotent) ---
if ! docker network inspect "$NETWORK_NAME" &>/dev/null; then
    docker network create --driver bridge --subnet "$SUBNET" "$NETWORK_NAME"
    echo "Created network: $NETWORK_NAME ($SUBNET)"
else
    echo "Network $NETWORK_NAME already exists"
fi

# --- Resolve required domains ---
resolve() {
    local ips
    ips=$(dig +short "$1" | grep -E '^[0-9]' | head -5)
    if [ -z "$ips" ]; then
        echo "warning: could not resolve $1" >&2
    fi
    echo "$ips"
}

ANTHROPIC_IPS=$(resolve api.anthropic.com)
STATSIG_ANTHROPIC_IPS=$(resolve statsig.anthropic.com)
STATSIG_IPS=$(resolve statsig.com)
SENTRY_IPS=$(resolve sentry.io)

# npm registry (for npm install inside container)
NPM_IPS=$(resolve registry.npmjs.org)

# Go module proxy (for go mod download inside container)
GO_PROXY_IPS=$(resolve proxy.golang.org)
GO_SUM_IPS=$(resolve sum.golang.org)
GO_STORAGE_IPS=$(resolve storage.googleapis.com)

# GitHub IP ranges from their meta API (HTTPS only — git uses GH_TOKEN, no SSH)
GITHUB_META=$(curl -sf https://api.github.com/meta) || { echo "warning: could not fetch GitHub meta API" >&2; GITHUB_META="{}"; }
GITHUB_WEB_CIDRS=$(echo "$GITHUB_META" | jq -r '.web[]' 2>/dev/null | grep -v ':' || true)
GITHUB_API_CIDRS=$(echo "$GITHUB_META" | jq -r '.api[]' 2>/dev/null | grep -v ':' || true)

# --- Flush existing sandbox rules ---
iptables -S DOCKER-USER 2>/dev/null | grep "172.30.0.0/24" | while read -r rule; do
    iptables $(echo "$rule" | sed 's/^-A/-D/')
done

# --- Default deny for sandbox subnet ---
iptables -A DOCKER-USER -s "$SUBNET" -j REJECT --reject-with icmp-port-unreachable

# --- Allow DNS (udp/53, tcp/53) ---
iptables -I DOCKER-USER -s "$SUBNET" -p udp --dport 53 -j ACCEPT
iptables -I DOCKER-USER -s "$SUBNET" -p tcp --dport 53 -j ACCEPT

# --- Allow established/related connections ---
iptables -I DOCKER-USER -s "$SUBNET" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# --- Allow Anthropic API (HTTPS) ---
for ip in $ANTHROPIC_IPS; do
    iptables -I DOCKER-USER -s "$SUBNET" -d "$ip" -p tcp --dport 443 -j ACCEPT
done

# --- Allow Statsig (telemetry) ---
for ip in $STATSIG_ANTHROPIC_IPS $STATSIG_IPS; do
    iptables -I DOCKER-USER -s "$SUBNET" -d "$ip" -p tcp --dport 443 -j ACCEPT
done

# --- Allow Sentry (error reporting) ---
for ip in $SENTRY_IPS; do
    iptables -I DOCKER-USER -s "$SUBNET" -d "$ip" -p tcp --dport 443 -j ACCEPT
done

# --- Allow GitHub (HTTPS only — git auth via GH_TOKEN, no SSH needed) ---
for cidr in $GITHUB_WEB_CIDRS $GITHUB_API_CIDRS; do
    iptables -I DOCKER-USER -s "$SUBNET" -d "$cidr" -p tcp --dport 443 -j ACCEPT
done

# --- Allow npm registry (HTTPS) ---
for ip in $NPM_IPS; do
    iptables -I DOCKER-USER -s "$SUBNET" -d "$ip" -p tcp --dport 443 -j ACCEPT
done

# --- Allow Go module proxy + checksum DB + storage (HTTPS) ---
for ip in $GO_PROXY_IPS $GO_SUM_IPS $GO_STORAGE_IPS; do
    iptables -I DOCKER-USER -s "$SUBNET" -d "$ip" -p tcp --dport 443 -j ACCEPT
done

echo ""
echo "Sandbox network rules applied for $SUBNET"
echo "Allowed destinations:"
echo "  - api.anthropic.com:443"
echo "  - statsig.anthropic.com:443 + statsig.com:443"
echo "  - sentry.io:443"
echo "  - github.com:443 (API + web)"
echo "  - registry.npmjs.org:443 (npm install)"
echo "  - proxy.golang.org:443 + sum.golang.org:443 + storage.googleapis.com:443 (Go modules)"
echo "  - DNS (udp+tcp/53)"
echo ""
echo "Everything else from $SUBNET is REJECTED"

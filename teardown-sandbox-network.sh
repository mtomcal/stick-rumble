#!/bin/bash
# teardown-sandbox-network.sh — Remove sandbox iptables rules and Docker network.
# Run with: sudo ./teardown-sandbox-network.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "error: this script must be run as root (sudo ./teardown-sandbox-network.sh)" >&2
    exit 1
fi

SUBNET="172.30.0.0/24"
NETWORK_NAME="sandbox-net"

# Remove iptables rules
iptables -S DOCKER-USER 2>/dev/null | grep "172.30.0.0/24" | while read -r rule; do
    iptables $(echo "$rule" | sed 's/^-A/-D/')
done
echo "Removed iptables rules for $SUBNET"

# Remove network
if docker network inspect "$NETWORK_NAME" &>/dev/null; then
    docker network rm "$NETWORK_NAME"
    echo "Removed network: $NETWORK_NAME"
fi

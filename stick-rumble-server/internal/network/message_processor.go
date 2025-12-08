package network

import (
	"encoding/json"
	"log"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

// handleInputState processes player input state updates
func (h *WebSocketHandler) handleInputState(playerID string, data any) {
	// Convert data to InputState
	dataMap, ok := data.(map[string]interface{})
	if !ok {
		log.Printf("Invalid input:state data format from %s", playerID)
		return
	}

	input := game.InputState{
		Up:       getBool(dataMap, "up"),
		Down:     getBool(dataMap, "down"),
		Left:     getBool(dataMap, "left"),
		Right:    getBool(dataMap, "right"),
		AimAngle: getFloat64(dataMap, "aimAngle"),
	}

	// Update game server with input
	success := h.gameServer.UpdatePlayerInput(playerID, input)
	if !success {
		log.Printf("Failed to update input for player %s", playerID)
	}
}

// handlePlayerShoot processes player shoot messages
func (h *WebSocketHandler) handlePlayerShoot(playerID string, data any) {
	// Convert data to get aim angle
	dataMap, ok := data.(map[string]interface{})
	if !ok {
		log.Printf("Invalid player:shoot data format from %s", playerID)
		return
	}

	aimAngle := getFloat64(dataMap, "aimAngle")

	// Attempt to shoot
	result := h.gameServer.PlayerShoot(playerID, aimAngle)

	if result.Success {
		// Broadcast projectile spawn to all players
		h.broadcastProjectileSpawn(result.Projectile)

		// Send weapon state update to the shooter
		h.sendWeaponState(playerID)
	} else {
		// Send failure reason to player (for empty click sound, etc.)
		h.sendShootFailed(playerID, result.Reason)
	}
}

// handlePlayerReload processes player reload messages
func (h *WebSocketHandler) handlePlayerReload(playerID string) {
	success := h.gameServer.PlayerReload(playerID)

	if success {
		// Send weapon state update to the player
		h.sendWeaponState(playerID)
	}
}

// onReloadComplete is called when a player's reload finishes
func (h *WebSocketHandler) onReloadComplete(playerID string) {
	// Send updated weapon state to the player
	h.sendWeaponState(playerID)
}

// onHit is called when a projectile hits a player
func (h *WebSocketHandler) onHit(hit game.HitEvent) {
	// Get victim's current state (including updated health)
	victimState, victimExists := h.gameServer.GetPlayerState(hit.VictimID)
	if !victimExists {
		return
	}

	// Get attacker's weapon to determine damage dealt
	attackerWeapon := h.gameServer.GetWeaponState(hit.AttackerID)
	if attackerWeapon == nil {
		return
	}

	damage := attackerWeapon.Weapon.Damage

	// Broadcast player:damaged to all players in the room
	damagedMessage := Message{
		Type:      "player:damaged",
		Timestamp: 0,
		Data: map[string]interface{}{
			"victimId":     hit.VictimID,
			"attackerId":   hit.AttackerID,
			"damage":       damage,
			"newHealth":    victimState.Health,
			"projectileId": hit.ProjectileID,
		},
	}

	msgBytes, err := json.Marshal(damagedMessage)
	if err != nil {
		log.Printf("Error marshaling player:damaged message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(hit.VictimID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}

	// Send hit confirmation to the attacker
	hitConfirmedMessage := Message{
		Type:      "hit:confirmed",
		Timestamp: 0,
		Data: map[string]interface{}{
			"victimId":     hit.VictimID,
			"damage":       damage,
			"projectileId": hit.ProjectileID,
		},
	}

	confirmBytes, err := json.Marshal(hitConfirmedMessage)
	if err != nil {
		log.Printf("Error marshaling hit:confirmed message: %v", err)
		return
	}

	h.roomManager.SendToPlayer(hit.AttackerID, confirmBytes)

	// If victim died, mark as dead and broadcast player:death
	if !victimState.IsAlive() {
		// Mark player as dead
		h.gameServer.MarkPlayerDead(hit.VictimID)

		// Update stats: increment attacker kills and victim deaths
		attackerState, attackerExists := h.gameServer.GetPlayerState(hit.AttackerID)
		if attackerExists {
			attackerState.IncrementKills()
			attackerState.AddXP(game.KillXPReward)
		}
		victimState.IncrementDeaths()

		deathMessage := Message{
			Type:      "player:death",
			Timestamp: 0,
			Data: map[string]interface{}{
				"victimId":   hit.VictimID,
				"attackerId": hit.AttackerID,
			},
		}

		deathBytes, err := json.Marshal(deathMessage)
		if err != nil {
			log.Printf("Error marshaling player:death message: %v", err)
			return
		}

		if room != nil {
			room.Broadcast(deathBytes, "")
		}

		// Broadcast kill credit with updated stats
		killCreditMessage := Message{
			Type:      "player:kill_credit",
			Timestamp: 0,
			Data: map[string]interface{}{
				"killerId":    hit.AttackerID,
				"victimId":    hit.VictimID,
				"killerKills": attackerState.Kills,
				"killerXP":    attackerState.XP,
			},
		}

		creditBytes, err := json.Marshal(killCreditMessage)
		if err != nil {
			log.Printf("Error marshaling player:kill_credit message: %v", err)
			return
		}

		if room != nil {
			room.Broadcast(creditBytes, "")

			// Track kill in match and check win conditions
			room.Match.AddKill(hit.AttackerID)

			// Check if kill target reached
			if room.Match.CheckKillTarget() {
				room.Match.EndMatch("kill_target")
				log.Printf("Match ended in room %s: kill target reached", room.ID)
				// TODO Story 2.6.2: Broadcast match:ended message
			}
		}
	}
}

// onRespawn is called when a player respawns after death
func (h *WebSocketHandler) onRespawn(playerID string, position game.Vector2) {
	// Create player:respawn message
	respawnMessage := Message{
		Type:      "player:respawn",
		Timestamp: 0,
		Data: map[string]interface{}{
			"playerId": playerID,
			"position": position,
			"health":   game.PlayerMaxHealth,
		},
	}

	msgBytes, err := json.Marshal(respawnMessage)
	if err != nil {
		log.Printf("Error marshaling player:respawn message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}
}

// getBool safely extracts a boolean value from a map
func getBool(m map[string]interface{}, key string) bool {
	val, ok := m[key]
	if !ok {
		return false
	}
	boolVal, ok := val.(bool)
	if !ok {
		return false
	}
	return boolVal
}

// getFloat64 safely extracts a float64 value from a map
func getFloat64(m map[string]interface{}, key string) float64 {
	val, ok := m[key]
	if !ok {
		return 0
	}
	floatVal, ok := val.(float64)
	if !ok {
		return 0
	}
	return floatVal
}

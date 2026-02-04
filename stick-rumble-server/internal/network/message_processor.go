package network

import (
	"encoding/json"
	"log"
	"math"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

// handleInputState processes player input state updates
func (h *WebSocketHandler) handleInputState(playerID string, data any) {
	// Check if player's match has ended - reject input if so
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil && room.Match.IsEnded() {
		// Silently ignore input after match ends (AC: "server stops accepting input:state messages")
		return
	}

	// Validate data against JSON schema
	if err := h.validator.Validate("input-state-data", data); err != nil {
		log.Printf("Schema validation failed for input:state from %s: %v", playerID, err)
		return
	}

	// After validation, we can safely type assert
	dataMap := data.(map[string]interface{})

	input := game.InputState{
		Up:          dataMap["up"].(bool),
		Down:        dataMap["down"].(bool),
		Left:        dataMap["left"].(bool),
		Right:       dataMap["right"].(bool),
		AimAngle:    dataMap["aimAngle"].(float64),
		IsSprinting: dataMap["isSprinting"].(bool),
	}

	// Extract sequence number for client-side prediction reconciliation
	var sequence uint64
	if seqFloat, ok := dataMap["sequence"].(float64); ok {
		sequence = uint64(seqFloat)
	}

	// Update game server with input and sequence
	success := h.gameServer.UpdatePlayerInputWithSequence(playerID, input, sequence)
	if !success {
		log.Printf("Failed to update input for player %s", playerID)
	}
}

// handlePlayerShoot processes player shoot messages
func (h *WebSocketHandler) handlePlayerShoot(playerID string, data any) {
	// Validate data against JSON schema
	if err := h.validator.Validate("player-shoot-data", data); err != nil {
		log.Printf("Schema validation failed for player:shoot from %s: %v", playerID, err)
		return
	}

	// After validation, we can safely type assert
	dataMap := data.(map[string]interface{})
	aimAngle := dataMap["aimAngle"].(float64)

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

	// Create player:damaged message data
	damagedData := map[string]interface{}{
		"victimId":     hit.VictimID,
		"attackerId":   hit.AttackerID,
		"damage":       damage,
		"newHealth":    victimState.Health,
		"projectileId": hit.ProjectileID,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("player:damaged", damagedData); err != nil {
		log.Printf("Schema validation failed for player:damaged: %v", err)
	}

	// Broadcast player:damaged to all players in the room
	damagedMessage := Message{
		Type:      "player:damaged",
		Timestamp: 0,
		Data:      damagedData,
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

	// Create hit:confirmed message data
	hitConfirmedData := map[string]interface{}{
		"victimId":     hit.VictimID,
		"damage":       damage,
		"projectileId": hit.ProjectileID,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("hit:confirmed", hitConfirmedData); err != nil {
		log.Printf("Schema validation failed for hit:confirmed: %v", err)
	}

	// Send hit confirmation to the attacker
	hitConfirmedMessage := Message{
		Type:      "hit:confirmed",
		Timestamp: 0,
		Data:      hitConfirmedData,
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
		// NOTE: Must use GetWorld().GetPlayer() to get pointer, not GetPlayerState() which returns a copy!
		attacker, attackerExists := h.gameServer.GetWorld().GetPlayer(hit.AttackerID)
		if attackerExists && attacker != nil {
			attacker.IncrementKills()
			attacker.AddXP(game.KillXPReward)
		}
		// victimState is already a pointer from earlier in this function
		victim, victimExists := h.gameServer.GetWorld().GetPlayer(hit.VictimID)
		if victimExists && victim != nil {
			victim.IncrementDeaths()
		}

		// Create player:death message data
		deathData := map[string]interface{}{
			"victimId":   hit.VictimID,
			"attackerId": hit.AttackerID,
		}

		// Validate outgoing message schema (development mode only)
		if err := h.validateOutgoingMessage("player:death", deathData); err != nil {
			log.Printf("Schema validation failed for player:death: %v", err)
		}

		deathMessage := Message{
			Type:      "player:death",
			Timestamp: 0,
			Data:      deathData,
		}

		deathBytes, err := json.Marshal(deathMessage)
		if err != nil {
			log.Printf("Error marshaling player:death message: %v", err)
			return
		}

		if room != nil {
			room.Broadcast(deathBytes, "")
		}

		// Create player:kill_credit message data
		killerKills := 0
		killerXP := 0
		if attacker != nil {
			killerKills = attacker.Kills
			killerXP = attacker.XP
		}
		killCreditData := map[string]interface{}{
			"killerId":    hit.AttackerID,
			"victimId":    hit.VictimID,
			"killerKills": killerKills,
			"killerXP":    killerXP,
		}

		// Validate outgoing message schema (development mode only)
		if err := h.validateOutgoingMessage("player:kill_credit", killCreditData); err != nil {
			log.Printf("Schema validation failed for player:kill_credit: %v", err)
		}

		// Broadcast kill credit with updated stats
		killCreditMessage := Message{
			Type:      "player:kill_credit",
			Timestamp: 0,
			Data:      killCreditData,
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
				// Broadcast match:ended message to all players
				h.broadcastMatchEnded(room, h.gameServer.GetWorld())
			}
		}
	}
}

// onRespawn is called when a player respawns after death
func (h *WebSocketHandler) onRespawn(playerID string, position game.Vector2) {
	// Create player:respawn message data
	respawnData := map[string]interface{}{
		"playerId": playerID,
		"position": position,
		"health":   game.PlayerMaxHealth,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("player:respawn", respawnData); err != nil {
		log.Printf("Schema validation failed for player:respawn: %v", err)
	}

	// Create player:respawn message
	respawnMessage := Message{
		Type:      "player:respawn",
		Timestamp: 0,
		Data:      respawnData,
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

// handleWeaponPickup processes weapon pickup attempts from players
func (h *WebSocketHandler) handleWeaponPickup(playerID string, data any) {
	// Validate data against JSON schema
	if err := h.validator.Validate("weapon-pickup-attempt-data", data); err != nil {
		log.Printf("Schema validation failed for weapon:pickup_attempt from %s: %v", playerID, err)
		return
	}

	// After validation, we can safely type assert
	dataMap := data.(map[string]interface{})
	crateID := dataMap["crateId"].(string)

	// Get weapon crate
	crate := h.gameServer.GetWeaponCrateManager().GetCrate(crateID)
	if crate == nil {
		log.Printf("Invalid crateId %s from player %s", crateID, playerID)
		return
	}

	// Check if crate is available
	if !crate.IsAvailable {
		log.Printf("Player %s attempted to pickup unavailable crate %s", playerID, crateID)
		return
	}

	// Get player state from world
	playerState, exists := h.gameServer.GetWorld().GetPlayer(playerID)
	if !exists {
		log.Printf("Player %s not found for weapon pickup", playerID)
		return
	}

	// Check if player is alive
	if !playerState.IsAlive() {
		log.Printf("Dead player %s attempted weapon pickup", playerID)
		return
	}

	// Check proximity using physics system
	physics := game.NewPhysics()
	if !physics.CheckPlayerCrateProximity(playerState, crate) {
		log.Printf("Player %s out of range for crate %s", playerID, crateID)
		return
	}

	// All validation passed - perform pickup
	// 1. Mark crate as picked up
	success := h.gameServer.GetWeaponCrateManager().PickupCrate(crateID)
	if !success {
		log.Printf("Failed to pick up crate %s (race condition)", crateID)
		return
	}

	// 2. Create new weapon for player
	newWeapon, err := game.CreateWeaponByType(crate.WeaponType)
	if err != nil {
		log.Printf("Failed to create weapon %s: %v", crate.WeaponType, err)
		// Return crate to available state
		crate.IsAvailable = true
		return
	}

	// 3. Replace player's weapon
	h.gameServer.SetWeaponState(playerID, game.NewWeaponState(newWeapon))

	// 4. Call pickup callback to broadcast to clients
	if h.gameServer.GetWeaponCrateManager().GetCrate(crateID) != nil {
		updatedCrate := h.gameServer.GetWeaponCrateManager().GetCrate(crateID)
		h.broadcastWeaponPickup(playerID, crateID, crate.WeaponType, updatedCrate.RespawnTime)

		// 5. Send updated weapon state to picker
		h.sendWeaponState(playerID)
	}

	log.Printf("Player %s picked up %s from crate %s", playerID, crate.WeaponType, crateID)
}

// onWeaponRespawn is called when a weapon crate respawns
func (h *WebSocketHandler) onWeaponRespawn(crate *game.WeaponCrate) {
	h.broadcastWeaponRespawn(crate)
	log.Printf("Weapon crate %s respawned (%s)", crate.ID, crate.WeaponType)
}

// handlePlayerMeleeAttack processes player melee attack messages
func (h *WebSocketHandler) handlePlayerMeleeAttack(playerID string, data any) {
	// Validate data against JSON schema
	if err := h.validator.Validate("player-melee-attack-data", data); err != nil {
		log.Printf("Schema validation failed for player:melee_attack from %s: %v", playerID, err)
		return
	}

	// After validation, we can safely type assert
	dataMap := data.(map[string]interface{})
	aimAngle := dataMap["aimAngle"].(float64)

	// Attempt melee attack
	result := h.gameServer.PlayerMeleeAttack(playerID, aimAngle)

	if !result.Success {
		log.Printf("Melee attack failed for player %s: %s", playerID, result.Reason)
		return
	}

	// Collect victim IDs
	victimIDs := make([]string, len(result.HitPlayers))
	for i, victim := range result.HitPlayers {
		victimIDs[i] = victim.ID
	}

	// Broadcast melee:hit to all players (even if no victims - for swing animation)
	h.broadcastMeleeHit(playerID, victimIDs, result.KnockbackApplied)

	// Process damage events for each victim
	for _, victim := range result.HitPlayers {
		// Get weapon to determine damage
		ws := h.gameServer.GetWeaponState(playerID)
		if ws == nil {
			continue
		}

		damage := ws.Weapon.Damage

		// Broadcast player:damaged
		h.broadcastPlayerDamaged(playerID, victim.ID, damage, victim.Health)

		// Check if victim died
		if !victim.IsAlive() {
			h.processMeleeKill(playerID, victim.ID)
		}
	}
}

// handlePlayerDodgeRoll processes player dodge roll requests
func (h *WebSocketHandler) handlePlayerDodgeRoll(playerID string) {
	// Get player state from world
	playerState, exists := h.gameServer.GetWorld().GetPlayer(playerID)
	if !exists {
		log.Printf("Player %s not found for dodge roll", playerID)
		return
	}

	// Check if player can dodge roll (cooldown, alive, not already rolling)
	if !playerState.CanDodgeRoll() {
		log.Printf("Player %s cannot dodge roll (cooldown or dead)", playerID)
		return
	}

	// Determine roll direction based on input
	input := playerState.GetInput()
	direction := game.Vector2{X: 0, Y: 0}

	// Use WASD keys if any are pressed
	if input.Up || input.Down || input.Left || input.Right {
		if input.Up {
			direction.Y -= 1
		}
		if input.Down {
			direction.Y += 1
		}
		if input.Left {
			direction.X -= 1
		}
		if input.Right {
			direction.X += 1
		}
	} else {
		// If stationary, roll in aim direction
		direction.X = 1.0 // Will be rotated by aim angle
		direction.Y = 0.0
	}

	// Normalize direction
	length := math.Sqrt(direction.X*direction.X + direction.Y*direction.Y)
	if length > 0 {
		direction.X /= length
		direction.Y /= length
	}

	// If using aim angle and stationary, apply rotation
	if !input.Up && !input.Down && !input.Left && !input.Right {
		aimAngle := input.AimAngle
		direction.X = math.Cos(aimAngle)
		direction.Y = math.Sin(aimAngle)
	}

	// Start the dodge roll
	playerState.StartDodgeRoll(direction)

	// Broadcast roll:start to all players in the room
	h.broadcastRollStart(playerID, direction, playerState.GetRollState().RollStartTime)

	log.Printf("Player %s started dodge roll", playerID)
}

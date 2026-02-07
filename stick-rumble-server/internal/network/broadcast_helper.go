package network

import (
	"encoding/json"
	"log"
	"math"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

// broadcastPlayerStates sends player position updates to all players using delta compression
func (h *WebSocketHandler) broadcastPlayerStates(playerStates []game.PlayerStateSnapshot) {
	if len(playerStates) == 0 {
		return
	}

	// Validate player states for NaN/Inf values before marshaling
	for i := range playerStates {
		state := &playerStates[i]
		if math.IsNaN(state.Position.X) || math.IsNaN(state.Position.Y) ||
			math.IsInf(state.Position.X, 0) || math.IsInf(state.Position.Y, 0) {
			log.Printf("ERROR: Player %s has invalid position: %+v", state.ID, state.Position)
		}
		if math.IsNaN(state.Velocity.X) || math.IsNaN(state.Velocity.Y) ||
			math.IsInf(state.Velocity.X, 0) || math.IsInf(state.Velocity.Y, 0) {
			log.Printf("ERROR: Player %s has invalid velocity: %+v", state.ID, state.Velocity)
		}
		if math.IsNaN(state.AimAngle) || math.IsInf(state.AimAngle, 0) {
			log.Printf("ERROR: Player %s has invalid aimAngle: %v", state.ID, state.AimAngle)
			// Sanitize aim angle to prevent JSON marshal error
			state.AimAngle = 0
		}
	}

	// Group player state indices by room to avoid broadcasting cross-room player data
	// Using indices to avoid copying PlayerState which contains a mutex
	roomPlayerIndices := make(map[string][]int)
	waitingPlayerIndices := make([]int, 0)

	for i := range playerStates {
		room := h.roomManager.GetRoomByPlayerID(playerStates[i].ID)
		if room != nil {
			roomPlayerIndices[room.ID] = append(roomPlayerIndices[room.ID], i)
		} else {
			// Player is waiting (not in a room yet)
			waitingPlayerIndices = append(waitingPlayerIndices, i)
		}
	}

	// Broadcast to each room with delta compression (per-client basis)
	for roomID, indices := range roomPlayerIndices {
		// Build player slice for this room only
		roomPlayers := make([]game.PlayerStateSnapshot, len(indices))
		for j, idx := range indices {
			roomPlayers[j] = playerStates[idx]
		}

		// Get room and broadcast to each player individually with delta compression
		rooms := h.roomManager.GetAllRooms()
		for _, room := range rooms {
			if room.ID == roomID {
				// Broadcast to each player in the room with per-client delta compression
				for _, player := range room.GetPlayers() {
					h.broadcastPlayerStatesToClient(player.ID, roomPlayers)
				}
				break
			}
		}
	}

	// Send to waiting players (each waiting player only sees their own state)
	for _, idx := range waitingPlayerIndices {
		// Create slice with single state
		singlePlayerState := make([]game.PlayerStateSnapshot, 1)
		singlePlayerState[0] = playerStates[idx]
		h.broadcastPlayerStatesToClient(playerStates[idx].ID, singlePlayerState)
	}
}

// broadcastPlayerStatesToClient sends player states to a specific client using delta compression
func (h *WebSocketHandler) broadcastPlayerStatesToClient(clientID string, playerStates []game.PlayerStateSnapshot) {
	// Check if we should send a full snapshot or a delta
	shouldSnapshot := h.deltaTracker.ShouldSendSnapshot(clientID)

	if shouldSnapshot {
		// Send full snapshot
		h.sendSnapshot(clientID, playerStates)
		h.deltaTracker.UpdateLastSnapshot(clientID)
		h.deltaTracker.UpdatePlayerState(clientID, playerStates)
	} else {
		// Send delta
		h.sendDelta(clientID, playerStates)
		h.deltaTracker.UpdatePlayerState(clientID, playerStates)
	}
}

// sendSnapshot sends a full state snapshot to a client
func (h *WebSocketHandler) sendSnapshot(clientID string, playerStates []game.PlayerStateSnapshot) {
	// Get active projectiles
	projectiles := h.gameServer.GetActiveProjectiles()

	// Get weapon crates
	weaponCrates := h.gameServer.GetWeaponCrateManager().GetAllCrates()

	// Build projectile snapshot data
	projectileSnapshots := make([]map[string]interface{}, len(projectiles))
	for i, proj := range projectiles {
		projectileSnapshots[i] = map[string]interface{}{
			"id":       proj.ID,
			"ownerId":  proj.OwnerID,
			"position": proj.Position,
			"velocity": proj.Velocity,
		}
	}

	// Build weapon crate snapshot data
	crateSnapshots := make([]map[string]interface{}, 0, len(weaponCrates))
	for _, crate := range weaponCrates {
		crateSnapshots = append(crateSnapshots, map[string]interface{}{
			"id":          crate.ID,
			"position":    crate.Position,
			"weaponType":  crate.WeaponType,
			"isAvailable": crate.IsAvailable,
		})
	}

	// Build lastProcessedSequence and correctedPlayers for reconciliation (Story 4.2)
	lastProcessedSequence := make(map[string]interface{})
	correctedPlayers := make([]string, 0)

	for _, state := range playerStates {
		if player, exists := h.gameServer.GetWorld().GetPlayer(state.ID); exists {
			seq := player.GetInputSequence()
			lastProcessedSequence[state.ID] = float64(seq)

			// Check if this player needs correction (recent correction in stats)
			stats := player.GetCorrectionStats()
			if !stats.LastCorrectionAt.IsZero() && time.Since(stats.LastCorrectionAt) < 100*time.Millisecond {
				correctedPlayers = append(correctedPlayers, state.ID)
			}
		}
	}

	// Create state:snapshot message data
	data := map[string]interface{}{
		"players":               playerStates,
		"projectiles":           projectileSnapshots,
		"weaponCrates":          crateSnapshots,
		"lastProcessedSequence": lastProcessedSequence,
	}

	// Only include correctedPlayers if there are any
	if len(correctedPlayers) > 0 {
		data["correctedPlayers"] = correctedPlayers
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("state:snapshot", data); err != nil {
		log.Printf("Schema validation failed for state:snapshot: %v", err)
	}

	message := Message{
		Type:      "state:snapshot",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling state:snapshot message: %v", err)
		return
	}

	// Send to client
	h.roomManager.SendToPlayer(clientID, msgBytes)
}

// sendDelta sends only changed state to a client
func (h *WebSocketHandler) sendDelta(clientID string, playerStates []game.PlayerStateSnapshot) {
	// Compute player delta
	playerDelta := h.deltaTracker.ComputePlayerDelta(clientID, playerStates)

	// Compute projectile delta
	projectiles := h.gameServer.GetActiveProjectiles()
	projectilesAdded, projectilesRemoved := h.deltaTracker.ComputeProjectileDelta(clientID, projectiles)

	// Build lastProcessedSequence and correctedPlayers for reconciliation (Story 4.2)
	lastProcessedSequence := make(map[string]interface{})
	correctedPlayers := make([]string, 0)

	for _, state := range playerStates {
		if player, exists := h.gameServer.GetWorld().GetPlayer(state.ID); exists {
			seq := player.GetInputSequence()
			lastProcessedSequence[state.ID] = float64(seq)

			// Check if this player needs correction (recent correction in stats)
			stats := player.GetCorrectionStats()
			if !stats.LastCorrectionAt.IsZero() && time.Since(stats.LastCorrectionAt) < 100*time.Millisecond {
				correctedPlayers = append(correctedPlayers, state.ID)
			}
		}
	}

	// If nothing changed, don't send a message
	if len(playerDelta) == 0 && len(projectilesAdded) == 0 && len(projectilesRemoved) == 0 {
		return
	}

	// Build delta message data
	data := make(map[string]interface{})

	if len(playerDelta) > 0 {
		data["players"] = playerDelta
	}

	if len(projectilesAdded) > 0 {
		projSnapshots := make([]map[string]interface{}, len(projectilesAdded))
		for i, proj := range projectilesAdded {
			projSnapshots[i] = map[string]interface{}{
				"id":       proj.ID,
				"ownerId":  proj.OwnerID,
				"position": proj.Position,
				"velocity": proj.Velocity,
			}
		}
		data["projectilesAdded"] = projSnapshots
	}

	if len(projectilesRemoved) > 0 {
		data["projectilesRemoved"] = projectilesRemoved
	}

	// Add reconciliation data
	data["lastProcessedSequence"] = lastProcessedSequence
	if len(correctedPlayers) > 0 {
		data["correctedPlayers"] = correctedPlayers
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("state:delta", data); err != nil {
		log.Printf("Schema validation failed for state:delta: %v", err)
	}

	message := Message{
		Type:      "state:delta",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling state:delta message: %v", err)
		return
	}

	// Send to client
	h.roomManager.SendToPlayer(clientID, msgBytes)

	// Update projectile state tracking
	h.deltaTracker.UpdateProjectileState(clientID, projectiles)
}

// broadcastProjectileSpawn sends projectile spawn event to all clients
func (h *WebSocketHandler) broadcastProjectileSpawn(proj *game.Projectile) {
	if proj == nil {
		return
	}

	// Create projectile:spawn message data
	data := map[string]interface{}{
		"id":       proj.ID,
		"ownerId":  proj.OwnerID,
		"position": proj.Position,
		"velocity": proj.Velocity,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("projectile:spawn", data); err != nil {
		log.Printf("Schema validation failed for projectile:spawn: %v", err)
	}

	message := Message{
		Type:      "projectile:spawn",
		Timestamp: 0,
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling projectile:spawn message: %v", err)
		return
	}

	// Broadcast to all rooms and waiting players
	h.roomManager.BroadcastToAll(msgBytes)
}

// broadcastMatchTimers broadcasts timer updates to all active rooms
func (h *WebSocketHandler) broadcastMatchTimers() {
	rooms := h.roomManager.GetAllRooms()

	for _, room := range rooms {
		// Skip if match ended
		if room.Match.IsEnded() {
			continue
		}

		remainingSeconds := room.Match.GetRemainingSeconds()

		// Create match:timer message data
		data := map[string]interface{}{
			"remainingSeconds": remainingSeconds,
		}

		// Validate outgoing message schema (development mode only)
		if err := h.validateOutgoingMessage("match:timer", data); err != nil {
			log.Printf("Schema validation failed for match:timer: %v", err)
		}

		// Create match:timer message
		timerMessage := Message{
			Type:      "match:timer",
			Timestamp: 0,
			Data:      data,
		}

		msgBytes, err := json.Marshal(timerMessage)
		if err != nil {
			log.Printf("Error marshaling match:timer message: %v", err)
			continue
		}

		// Broadcast to all players in room
		room.Broadcast(msgBytes, "")

		// Check if time limit reached
		if room.Match.CheckTimeLimit() {
			room.Match.EndMatch("time_limit")
			log.Printf("Match ended in room %s: time limit reached", room.ID)
			// Broadcast match:ended message to all players
			h.broadcastMatchEnded(room, h.gameServer.GetWorld())
		}
	}
}

// sendWeaponState sends weapon state update to a specific player
func (h *WebSocketHandler) sendWeaponState(playerID string) {
	ws := h.gameServer.GetWeaponState(playerID)
	if ws == nil {
		return
	}

	current, max := ws.GetAmmoInfo()

	// Create weapon:state message data
	data := map[string]interface{}{
		"currentAmmo": current,
		"maxAmmo":     max,
		"isReloading": ws.IsReloading,
		"canShoot":    ws.CanShoot(),
		"weaponType":  ws.Weapon.Name,
		"isMelee":     ws.Weapon.IsMelee(),
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("weapon:state", data); err != nil {
		log.Printf("Schema validation failed for weapon:state: %v", err)
	}

	message := Message{
		Type:      "weapon:state",
		Timestamp: 0,
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling weapon:state message: %v", err)
		return
	}

	// Send to the specific player
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		player := room.GetPlayer(playerID)
		if player != nil {
			select {
			case player.SendChan <- msgBytes:
			default:
				log.Printf("Failed to send weapon:state to player %s (channel full)", playerID)
			}
		}
	} else {
		h.roomManager.SendToWaitingPlayer(playerID, msgBytes)
	}
}

// sendShootFailed sends a shoot failure message to the player
func (h *WebSocketHandler) sendShootFailed(playerID string, reason string) {
	// Create shoot:failed message data
	data := map[string]interface{}{
		"reason": reason,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("shoot:failed", data); err != nil {
		log.Printf("Schema validation failed for shoot:failed: %v", err)
	}

	message := Message{
		Type:      "shoot:failed",
		Timestamp: 0,
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling shoot:failed message: %v", err)
		return
	}

	// Send to the specific player
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		player := room.GetPlayer(playerID)
		if player != nil {
			select {
			case player.SendChan <- msgBytes:
			default:
				log.Printf("Failed to send shoot:failed to player %s (channel full)", playerID)
			}
		}
	} else {
		h.roomManager.SendToWaitingPlayer(playerID, msgBytes)
	}
}

// broadcastMatchEnded broadcasts match end event to all players in a room
func (h *WebSocketHandler) broadcastMatchEnded(room *game.Room, world *game.World) {
	// Check if match exists
	if room.Match == nil {
		log.Printf("Cannot broadcast match ended: match is nil for room %s", room.ID)
		return
	}

	// Determine winners and get final scores
	winners := room.Match.DetermineWinners()
	finalScores := room.Match.GetFinalScores(world)

	// Create match:ended message data
	data := map[string]interface{}{
		"winners":     winners,
		"finalScores": finalScores,
		"reason":      room.Match.EndReason,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("match:ended", data); err != nil {
		log.Printf("Schema validation failed for match:ended: %v", err)
	}

	// Create match:ended message
	message := Message{
		Type:      "match:ended",
		Timestamp: 0,
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling match:ended message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room.Broadcast(msgBytes, "")
	log.Printf("Match ended in room %s - reason: %s, winners: %v", room.ID, room.Match.EndReason, winners)
}

// broadcastWeaponPickup broadcasts weapon pickup event to all clients
func (h *WebSocketHandler) broadcastWeaponPickup(playerID, crateID, weaponType string, respawnTime time.Time) {
	// Create weapon:pickup_confirmed message data
	data := map[string]interface{}{
		"playerId":        playerID,
		"crateId":         crateID,
		"weaponType":      weaponType,
		"nextRespawnTime": respawnTime.Unix(),
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("weapon:pickup_confirmed", data); err != nil {
		log.Printf("Schema validation failed for weapon:pickup_confirmed: %v", err)
	}

	message := Message{
		Type:      "weapon:pickup_confirmed",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling weapon:pickup_confirmed message: %v", err)
		return
	}

	// Broadcast to all players
	h.roomManager.BroadcastToAll(msgBytes)
}

// broadcastWeaponRespawn broadcasts weapon respawn event to all clients
func (h *WebSocketHandler) broadcastWeaponRespawn(crate *game.WeaponCrate) {
	// Create weapon:respawned message data
	data := map[string]interface{}{
		"crateId":    crate.ID,
		"weaponType": crate.WeaponType,
		"position":   crate.Position,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("weapon:respawned", data); err != nil {
		log.Printf("Schema validation failed for weapon:respawned: %v", err)
	}

	message := Message{
		Type:      "weapon:respawned",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling weapon:respawned message: %v", err)
		return
	}

	// Broadcast to all players
	h.roomManager.BroadcastToAll(msgBytes)
}

// sendWeaponSpawns sends initial weapon spawn state to a specific player
func (h *WebSocketHandler) sendWeaponSpawns(playerID string) {
	// Get all weapon crates from the manager
	allCrates := h.gameServer.GetWeaponCrateManager().GetAllCrates()

	// Build crates array for the message
	crates := make([]map[string]interface{}, 0, len(allCrates))
	for _, crate := range allCrates {
		crateData := map[string]interface{}{
			"id":          crate.ID,
			"position":    map[string]interface{}{"x": crate.Position.X, "y": crate.Position.Y},
			"weaponType":  crate.WeaponType,
			"isAvailable": crate.IsAvailable,
		}
		crates = append(crates, crateData)
	}

	// Create weapon:spawned message data
	data := map[string]interface{}{
		"crates": crates,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("weapon:spawned", data); err != nil {
		log.Printf("Schema validation failed for weapon:spawned: %v", err)
	}

	// Create weapon:spawned message
	message := Message{
		Type:      "weapon:spawned",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling weapon:spawned message: %v", err)
		return
	}

	// Send to the specific player
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		player := room.GetPlayer(playerID)
		if player != nil {
			select {
			case player.SendChan <- msgBytes:
				// Message sent successfully
			default:
				log.Printf("Failed to send weapon:spawned to player %s (channel full)", playerID)
			}
		}
	} else {
		// Player not in a room yet, send to waiting player
		h.roomManager.SendToWaitingPlayer(playerID, msgBytes)
	}
}

// broadcastRollStart broadcasts roll start event to all players in the room
func (h *WebSocketHandler) broadcastRollStart(playerID string, direction game.Vector2, rollStartTime time.Time) {
	// Create roll:start message data
	data := map[string]interface{}{
		"playerId":      playerID,
		"direction":     direction,
		"rollStartTime": rollStartTime.UnixMilli(),
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("roll:start", data); err != nil {
		log.Printf("Schema validation failed for roll:start: %v", err)
	}

	message := Message{
		Type:      "roll:start",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling roll:start message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}
}

// broadcastMeleeHit broadcasts melee hit event to all players in the room
func (h *WebSocketHandler) broadcastMeleeHit(attackerID string, victimIDs []string, knockbackApplied bool) {
	// Create melee:hit message data
	data := map[string]interface{}{
		"attackerId":       attackerID,
		"victims":          victimIDs,
		"knockbackApplied": knockbackApplied,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("melee:hit", data); err != nil {
		log.Printf("Schema validation failed for melee:hit: %v", err)
	}

	message := Message{
		Type:      "melee:hit",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling melee:hit message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(attackerID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}
}

// broadcastPlayerDamaged broadcasts player damage event (used by melee attacks)
func (h *WebSocketHandler) broadcastPlayerDamaged(attackerID, victimID string, damage, newHealth int) {
	// Create player:damaged message data
	data := map[string]interface{}{
		"victimId":   victimID,
		"attackerId": attackerID,
		"damage":     damage,
		"newHealth":  newHealth,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("player:damaged", data); err != nil {
		log.Printf("Schema validation failed for player:damaged: %v", err)
	}

	message := Message{
		Type:      "player:damaged",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling player:damaged message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(victimID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}
}

// processMeleeKill handles death processing for melee kills
func (h *WebSocketHandler) processMeleeKill(attackerID, victimID string) {
	// Mark player as dead
	h.gameServer.MarkPlayerDead(victimID)

	// Get the actual player pointers to update stats
	attacker, attackerExists := h.gameServer.GetWorld().GetPlayer(attackerID)
	if attackerExists && attacker != nil {
		attacker.IncrementKills()
		attacker.AddXP(game.KillXPReward)
	}

	victim, victimExists := h.gameServer.GetWorld().GetPlayer(victimID)
	if victimExists && victim != nil {
		victim.IncrementDeaths()
	}

	// Create player:death message data
	deathData := map[string]interface{}{
		"victimId":   victimID,
		"attackerId": attackerID,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("player:death", deathData); err != nil {
		log.Printf("Schema validation failed for player:death: %v", err)
	}

	deathMessage := Message{
		Type:      "player:death",
		Timestamp: time.Now().UnixMilli(),
		Data:      deathData,
	}

	deathBytes, err := json.Marshal(deathMessage)
	if err != nil {
		log.Printf("Error marshaling player:death message: %v", err)
		return
	}

	room := h.roomManager.GetRoomByPlayerID(victimID)
	if room != nil {
		room.Broadcast(deathBytes, "")
	}

	// Create player:kill_credit message data
	killCreditData := map[string]interface{}{
		"killerId":    attackerID,
		"victimId":    victimID,
		"killerKills": 0,
		"killerXP":    0,
	}

	if attackerExists && attacker != nil {
		killCreditData["killerKills"] = attacker.Kills
		killCreditData["killerXP"] = attacker.XP
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("player:kill_credit", killCreditData); err != nil {
		log.Printf("Schema validation failed for player:kill_credit: %v", err)
	}

	// Broadcast kill credit
	killCreditMessage := Message{
		Type:      "player:kill_credit",
		Timestamp: time.Now().UnixMilli(),
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
		room.Match.AddKill(attackerID)

		// Check if kill target reached
		if room.Match.CheckKillTarget() {
			room.Match.EndMatch("kill_target")
			log.Printf("Match ended in room %s: kill target reached (melee)", room.ID)
			h.broadcastMatchEnded(room, h.gameServer.GetWorld())
		}
	}
}

// broadcastRollEnd broadcasts roll end event to all players in the room
func (h *WebSocketHandler) broadcastRollEnd(playerID string, reason string) {
	// Create roll:end message data
	data := map[string]interface{}{
		"playerId": playerID,
		"reason":   reason,
	}

	// Validate outgoing message schema (development mode only)
	if err := h.validateOutgoingMessage("roll:end", data); err != nil {
		log.Printf("Schema validation failed for roll:end: %v", err)
	}

	message := Message{
		Type:      "roll:end",
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling roll:end message: %v", err)
		return
	}

	// Broadcast to all players in the room
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room != nil {
		room.Broadcast(msgBytes, "")
	}
}

// getPlayerRTT retrieves a player's RTT for lag compensation (Story 4.5)
func (h *WebSocketHandler) getPlayerRTT(playerID string) int64 {
	room := h.roomManager.GetRoomByPlayerID(playerID)
	if room == nil {
		return 0
	}

	player := room.GetPlayer(playerID)
	if player == nil {
		return 0
	}

	return player.PingTracker.GetRTT()
}

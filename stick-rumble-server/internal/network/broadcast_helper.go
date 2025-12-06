package network

import (
	"encoding/json"
	"log"
	"math"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

// broadcastPlayerStates sends player position updates to all players
func (h *WebSocketHandler) broadcastPlayerStates(playerStates []game.PlayerState) {
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

	// Create player:move message
	message := Message{
		Type:      "player:move",
		Timestamp: 0, // Will be set by each client
		Data: map[string]interface{}{
			"players": playerStates,
		},
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling player:move message: %v", err)
		log.Printf("Player states that failed to marshal: %+v", playerStates)
		return
	}

	// Broadcast to all players (both in rooms and waiting)
	// This ensures all connected clients receive game state updates
	for i := range playerStates {
		room := h.roomManager.GetRoomByPlayerID(playerStates[i].ID)
		if room != nil {
			// Player is in a room - broadcast to room
			room.Broadcast(msgBytes, "")
		} else {
			// Player is not in a room yet (waiting) - send directly to their channel
			h.roomManager.SendToWaitingPlayer(playerStates[i].ID, msgBytes)
		}
	}
}

// broadcastProjectileSpawn sends projectile spawn event to all clients
func (h *WebSocketHandler) broadcastProjectileSpawn(proj *game.Projectile) {
	message := Message{
		Type:      "projectile:spawn",
		Timestamp: 0,
		Data: map[string]interface{}{
			"id":       proj.ID,
			"ownerId":  proj.OwnerID,
			"position": proj.Position,
			"velocity": proj.Velocity,
		},
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

		// Create match:timer message
		timerMessage := Message{
			Type:      "match:timer",
			Timestamp: 0,
			Data: map[string]interface{}{
				"remainingSeconds": remainingSeconds,
			},
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
			// TODO Story 2.6.2: Broadcast match:ended message
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
	message := Message{
		Type:      "weapon:state",
		Timestamp: 0,
		Data: map[string]interface{}{
			"currentAmmo": current,
			"maxAmmo":     max,
			"isReloading": ws.IsReloading,
			"canShoot":    ws.CanShoot(),
		},
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
	message := Message{
		Type:      "shoot:failed",
		Timestamp: 0,
		Data: map[string]interface{}{
			"reason": reason,
		},
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

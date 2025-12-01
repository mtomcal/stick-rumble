package game

import (
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Player represents a connected player
type Player struct {
	ID       string
	SendChan chan []byte
}

// Room represents a game room with multiple players
type Room struct {
	ID         string
	Players    []*Player
	MaxPlayers int
	mu         sync.RWMutex
}

// NewRoom creates a new room with a unique ID
func NewRoom() *Room {
	return &Room{
		ID:         uuid.New().String(),
		Players:    make([]*Player, 0, 8),
		MaxPlayers: 8,
	}
}

// AddPlayer adds a player to the room
func (r *Room) AddPlayer(player *Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.Players) >= r.MaxPlayers {
		return errors.New("room is full")
	}

	r.Players = append(r.Players, player)
	return nil
}

// RemovePlayer removes a player from the room by ID
func (r *Room) RemovePlayer(playerID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, player := range r.Players {
		if player.ID == playerID {
			// Remove player from slice
			r.Players = append(r.Players[:i], r.Players[i+1:]...)
			return true
		}
	}
	return false
}

// IsEmpty returns true if the room has no players (thread-safe)
func (r *Room) IsEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players) == 0
}

// PlayerCount returns the number of players in the room (thread-safe)
func (r *Room) PlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players)
}

// Broadcast sends a message to all players in the room, optionally excluding a sender
func (r *Room) Broadcast(message []byte, excludePlayerID string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, player := range r.Players {
		if player.ID != excludePlayerID {
			// Use recover to handle closed channel panics gracefully
			func() {
				defer func() {
					if rec := recover(); rec != nil {
						log.Printf("Warning: Could not send message to player %s (channel closed)", player.ID)
					}
				}()

				select {
				case player.SendChan <- message:
					// Message sent successfully
				default:
					log.Printf("Warning: Could not send message to player %s (channel full)", player.ID)
				}
			}()
		}
	}
}

// RoomManager manages all game rooms and player assignments
type RoomManager struct {
	rooms          map[string]*Room
	waitingPlayers []*Player
	playerToRoom   map[string]string // Maps player ID to room ID
	mu             sync.RWMutex
}

// NewRoomManager creates a new room manager
func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms:          make(map[string]*Room),
		waitingPlayers: make([]*Player, 0),
		playerToRoom:   make(map[string]string),
	}
}

// AddPlayer adds a player and creates a room if we have 2 waiting players
func (rm *RoomManager) AddPlayer(player *Player) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Add to waiting list
	rm.waitingPlayers = append(rm.waitingPlayers, player)

	// If we have 2 players, create a room
	if len(rm.waitingPlayers) >= 2 {
		// Create new room
		room := NewRoom()

		// Add both waiting players to the room
		player1 := rm.waitingPlayers[0]
		player2 := rm.waitingPlayers[1]

		room.AddPlayer(player1)
		room.AddPlayer(player2)

		// Clear waiting list
		rm.waitingPlayers = rm.waitingPlayers[2:]

		// Register room
		rm.rooms[room.ID] = room
		rm.playerToRoom[player1.ID] = room.ID
		rm.playerToRoom[player2.ID] = room.ID

		// Log room creation
		log.Printf("Room created: %s with players: [%s, %s]", room.ID, player1.ID, player2.ID)

		// Send room:joined messages to both players
		rm.sendRoomJoinedMessage(player1, room)
		rm.sendRoomJoinedMessage(player2, room)

		return room
	}

	// Not enough players yet
	return nil
}

// sendRoomJoinedMessage sends a room:joined message to a player
func (rm *RoomManager) sendRoomJoinedMessage(player *Player, room *Room) {
	message := map[string]interface{}{
		"type":      "room:joined",
		"timestamp": time.Now().UnixMilli(),
		"data": map[string]interface{}{
			"roomId":   room.ID,
			"playerId": player.ID,
		},
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling room:joined message: %v", err)
		return
	}

	// Use recover to handle closed channel panics gracefully
	func() {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("Warning: Could not send room:joined message to player %s (channel closed)", player.ID)
			}
		}()

		select {
		case player.SendChan <- msgBytes:
			// Message sent successfully
		default:
			log.Printf("Warning: Could not send room:joined message to player %s (channel full)", player.ID)
		}
	}()
}

// RemovePlayer removes a player from their room and notifies other players
func (rm *RoomManager) RemovePlayer(playerID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Find and remove from waiting list if present
	for i, player := range rm.waitingPlayers {
		if player.ID == playerID {
			rm.waitingPlayers = append(rm.waitingPlayers[:i], rm.waitingPlayers[i+1:]...)
			return
		}
	}

	// Find player's room
	roomID, exists := rm.playerToRoom[playerID]
	if !exists {
		return
	}

	room, exists := rm.rooms[roomID]
	if !exists {
		return
	}

	// Remove player from room
	room.RemovePlayer(playerID)

	// Send player:left message to remaining players
	message := map[string]interface{}{
		"type":      "player:left",
		"timestamp": time.Now().UnixMilli(),
		"data": map[string]interface{}{
			"playerId": playerID,
		},
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling player:left message: %v", err)
	} else {
		room.Broadcast(msgBytes, "")
	}

	// Clean up player to room mapping
	delete(rm.playerToRoom, playerID)

	// If room is empty, remove it
	if room.IsEmpty() {
		delete(rm.rooms, roomID)
		log.Printf("Room %s removed (no players remaining)", roomID)
	}
}

// GetRoomByPlayerID finds a room by player ID
func (rm *RoomManager) GetRoomByPlayerID(playerID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	roomID, exists := rm.playerToRoom[playerID]
	if !exists {
		return nil
	}

	return rm.rooms[roomID]
}

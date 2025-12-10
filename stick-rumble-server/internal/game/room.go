package game

import (
	"encoding/json"
	"errors"
	"log"
	"os"
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
	Match      *Match // Match state tracking
	mu         sync.RWMutex
}

// NewRoom creates a new room with a unique ID
func NewRoom() *Room {
	match := NewMatch()

	// Enable test mode if TEST_MODE environment variable is set
	if os.Getenv("TEST_MODE") == "true" {
		match.SetTestMode()
		log.Println("Match created in TEST MODE (kill target: 2, time limit: 10s)")
	}

	return &Room{
		ID:         uuid.New().String(),
		Players:    make([]*Player, 0, 8),
		MaxPlayers: 8,
		Match:      match,
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

// GetPlayer returns a player by ID, or nil if not found
func (r *Room) GetPlayer(playerID string) *Player {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, player := range r.Players {
		if player.ID == playerID {
			return player
		}
	}
	return nil
}

// GetPlayers returns a copy of all players in the room
func (r *Room) GetPlayers() []*Player {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Return a copy to avoid race conditions
	players := make([]*Player, len(r.Players))
	copy(players, r.Players)
	return players
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

		// Start the match
		room.Match.Start()

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

// SendToWaitingPlayer sends a message to a waiting player (not in a room yet)
func (rm *RoomManager) SendToWaitingPlayer(playerID string, msgBytes []byte) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	for _, player := range rm.waitingPlayers {
		if player.ID == playerID {
			// Use recover to handle closed channel panics gracefully
			func() {
				defer func() {
					if rec := recover(); rec != nil {
						log.Printf("Warning: Could not send message to waiting player %s (channel closed)", playerID)
					}
				}()

				select {
				case player.SendChan <- msgBytes:
					// Message sent successfully
				default:
					log.Printf("Warning: Could not send message to waiting player %s (channel full)", playerID)
				}
			}()
			return
		}
	}
}

// SendToPlayer sends a message to any player (in room or waiting)
// Returns true if player was found and message was queued, false otherwise
func (rm *RoomManager) SendToPlayer(playerID string, msgBytes []byte) bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	// First, check if player is in a room
	roomID, inRoom := rm.playerToRoom[playerID]
	if inRoom {
		room, roomExists := rm.rooms[roomID]
		if roomExists {
			player := room.GetPlayer(playerID)
			if player != nil {
				// Use recover to handle closed channel panics gracefully
				func() {
					defer func() {
						if rec := recover(); rec != nil {
							log.Printf("Warning: Could not send message to player %s (channel closed)", playerID)
						}
					}()

					select {
					case player.SendChan <- msgBytes:
						// Message sent successfully
					default:
						log.Printf("Warning: Could not send message to player %s (channel full)", playerID)
					}
				}()
				return true
			}
		}
	}

	// Second, check waiting players
	for _, player := range rm.waitingPlayers {
		if player.ID == playerID {
			// Use recover to handle closed channel panics gracefully
			func() {
				defer func() {
					if rec := recover(); rec != nil {
						log.Printf("Warning: Could not send message to waiting player %s (channel closed)", playerID)
					}
				}()

				select {
				case player.SendChan <- msgBytes:
					// Message sent successfully
				default:
					log.Printf("Warning: Could not send message to waiting player %s (channel full)", playerID)
				}
			}()
			return true
		}
	}

	// Player not found
	return false
}

// BroadcastToAll sends a message to all players (in rooms and waiting)
func (rm *RoomManager) BroadcastToAll(msgBytes []byte) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	// Broadcast to all rooms
	for _, room := range rm.rooms {
		room.Broadcast(msgBytes, "")
	}

	// Send to all waiting players
	for _, player := range rm.waitingPlayers {
		// Use recover to handle closed channel panics gracefully
		func() {
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("Warning: Could not send message to waiting player %s (channel closed)", player.ID)
				}
			}()

			select {
			case player.SendChan <- msgBytes:
				// Message sent successfully
			default:
				log.Printf("Warning: Could not send message to waiting player %s (channel full)", player.ID)
			}
		}()
	}
}

// GetAllRooms returns a snapshot of all active rooms (thread-safe)
func (rm *RoomManager) GetAllRooms() []*Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	rooms := make([]*Room, 0, len(rm.rooms))
	for _, room := range rm.rooms {
		rooms = append(rooms, room)
	}
	return rooms
}

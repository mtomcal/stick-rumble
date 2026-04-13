package game

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	MinPlayersToStart   = 2
	MinRoomCodeLen      = 3
	MaxRoomCodeLen      = 12
	MaxDisplayNameLen   = 16
	FallbackDisplayName = "Guest"
)

type RoomKind string

const (
	RoomKindPublic RoomKind = "public"
	RoomKindCode   RoomKind = "code"
)

type RoomCodeErrorReason string

const (
	RoomCodeMissing  RoomCodeErrorReason = "missing"
	RoomCodeTooShort RoomCodeErrorReason = "too_short"
	RoomCodeTooLong  RoomCodeErrorReason = "too_long"
)

var (
	controlCharsPattern  = regexp.MustCompile(`[\x00-\x1F\x7F]`)
	internalSpacePattern = regexp.MustCompile(`\s+`)
	roomCodeStripPattern = regexp.MustCompile(`[^A-Z0-9]`)
)

// Player represents a connected player.
type Player struct {
	ID          string
	DisplayName string
	HelloSeen   bool
	SendChan    chan []byte
	PingTracker *PingTracker // Tracks RTT for lag compensation
}

// NewPlayer creates a new player with initialized ping tracker.
func NewPlayer(id string, sendChan chan []byte) *Player {
	return &Player{
		ID:          id,
		DisplayName: FallbackDisplayName,
		SendChan:    sendChan,
		PingTracker: NewPingTracker(),
	}
}

// Room represents a game room with multiple players.
type Room struct {
	ID         string
	Kind       RoomKind
	Code       string
	Players    []*Player
	MaxPlayers int
	MapID      string
	Match      *Match
	CreatedAt  time.Time
	UpdatedAt  time.Time
	EmptySince *time.Time
	mu         sync.RWMutex
}

func NewRoom(mapIDs ...string) *Room {
	return NewTypedRoom(RoomKindPublic, "", mapIDs...)
}

// NewTypedRoom creates a room with an explicit kind and optional named-room code.
func NewTypedRoom(kind RoomKind, code string, mapIDs ...string) *Room {
	match := NewMatch()
	mapID := DefaultMapID
	if len(mapIDs) > 0 && mapIDs[0] != "" {
		mapID = mapIDs[0]
	}

	if os.Getenv("TEST_MODE") == "true" {
		match.SetTestMode()
		log.Println("Match created in TEST MODE (kill target: 2, time limit: 10s)")
	}

	now := time.Now()

	return &Room{
		ID:         uuid.New().String(),
		Kind:       kind,
		Code:       code,
		Players:    make([]*Player, 0, 8),
		MaxPlayers: 8,
		MapID:      mapID,
		Match:      match,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

// AddPlayer adds a player to the room.
func (r *Room) AddPlayer(player *Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.Players) >= r.MaxPlayers {
		return errors.New("room is full")
	}

	r.Players = append(r.Players, player)
	r.UpdatedAt = time.Now()
	r.EmptySince = nil
	return nil
}

// RemovePlayer removes a player from the room by ID.
func (r *Room) RemovePlayer(playerID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i, player := range r.Players {
		if player.ID == playerID {
			r.Players = append(r.Players[:i], r.Players[i+1:]...)
			now := time.Now()
			r.UpdatedAt = now
			if len(r.Players) == 0 {
				r.EmptySince = &now
			}
			return true
		}
	}
	return false
}

func (r *Room) IsEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players) == 0
}

func (r *Room) PlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players)
}

func (r *Room) Broadcast(message []byte, excludePlayerID string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, player := range r.Players {
		if player.ID == excludePlayerID {
			continue
		}

		func() {
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("Warning: Could not send message to player %s (channel closed)", player.ID)
				}
			}()

			select {
			case player.SendChan <- message:
			default:
				log.Printf("Warning: Could not send message to player %s (channel full)", player.ID)
			}
		}()
	}
}

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

func (r *Room) GetPlayers() []*Player {
	r.mu.RLock()
	defer r.mu.RUnlock()

	players := make([]*Player, len(r.Players))
	copy(players, r.Players)
	return players
}

type RoomManager struct {
	rooms          map[string]*Room
	waitingPlayers []*Player
	playerToRoom   map[string]string
	codeIndex      map[string]string
	defaultMapID   string
	mu             sync.RWMutex
}

func NewRoomManager(defaultMapIDs ...string) *RoomManager {
	defaultMapID := DefaultMapID
	if len(defaultMapIDs) > 0 && defaultMapIDs[0] != "" {
		defaultMapID = defaultMapIDs[0]
	}

	return &RoomManager{
		rooms:          make(map[string]*Room),
		waitingPlayers: make([]*Player, 0),
		playerToRoom:   make(map[string]string),
		codeIndex:      make(map[string]string),
		defaultMapID:   defaultMapID,
	}
}

func SanitizeDisplayName(raw any) string {
	name, ok := raw.(string)
	if !ok {
		return FallbackDisplayName
	}

	name = strings.TrimSpace(name)
	name = controlCharsPattern.ReplaceAllString(name, "")
	name = internalSpacePattern.ReplaceAllString(name, " ")
	name = strings.TrimSpace(name)
	if name == "" {
		return FallbackDisplayName
	}

	runes := []rune(name)
	if len(runes) > MaxDisplayNameLen {
		name = string(runes[:MaxDisplayNameLen])
	}

	return name
}

func NormalizeRoomCode(raw any) (string, RoomCodeErrorReason, bool) {
	value, ok := raw.(string)
	if !ok {
		return "", RoomCodeMissing, false
	}

	code := strings.TrimSpace(strings.ToUpper(value))
	code = roomCodeStripPattern.ReplaceAllString(code, "")
	switch {
	case len(code) < MinRoomCodeLen:
		return "", RoomCodeTooShort, false
	case len(code) > MaxRoomCodeLen:
		return "", RoomCodeTooLong, false
	default:
		return code, "", true
	}
}

// AddPublicPlayer processes a successful public-mode hello.
func (rm *RoomManager) AddPublicPlayer(player *Player) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for _, room := range rm.rooms {
		if room.Kind == RoomKindPublic && room.PlayerCount() == 1 && !room.Match.IsEnded() {
			if err := room.AddPlayer(player); err != nil {
				continue
			}
			rm.playerToRoom[player.ID] = room.ID
			room.Match.RegisterPlayer(player.ID)
			if room.PlayerCount() >= MinPlayersToStart && !room.Match.IsStarted() {
				room.Match.Start()
			}
			rm.sendRoomJoinedMessage(player, room)
			return room
		}
	}

	rm.waitingPlayers = append(rm.waitingPlayers, player)
	if len(rm.waitingPlayers) < MinPlayersToStart {
		return nil
	}

	room := NewTypedRoom(RoomKindPublic, "", rm.defaultMapID)
	player1 := rm.waitingPlayers[0]
	player2 := rm.waitingPlayers[1]
	rm.waitingPlayers = rm.waitingPlayers[2:]

	_ = room.AddPlayer(player1)
	_ = room.AddPlayer(player2)
	room.Match.RegisterPlayer(player1.ID)
	room.Match.RegisterPlayer(player2.ID)
	room.Match.Start()

	rm.rooms[room.ID] = room
	rm.playerToRoom[player1.ID] = room.ID
	rm.playerToRoom[player2.ID] = room.ID

	rm.sendRoomJoinedMessage(player1, room)
	rm.sendRoomJoinedMessage(player2, room)

	return room
}

// AddPlayer preserves the old public-room API for callers that still use it.
func (rm *RoomManager) AddPlayer(player *Player) *Room {
	return rm.AddPublicPlayer(player)
}

// AddCodePlayer processes a successful code-mode hello.
func (rm *RoomManager) AddCodePlayer(player *Player, normalizedCode string) (*Room, bool) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if existingRoomID, ok := rm.codeIndex[normalizedCode]; ok {
		if existingRoom, exists := rm.rooms[existingRoomID]; exists {
			if existingRoom.Match.IsEnded() {
				delete(rm.codeIndex, normalizedCode)
			} else if existingRoom.PlayerCount() >= existingRoom.MaxPlayers {
				return existingRoom, false
			} else {
				if err := existingRoom.AddPlayer(player); err != nil {
					return existingRoom, false
				}
				rm.playerToRoom[player.ID] = existingRoom.ID
				existingRoom.Match.RegisterPlayer(player.ID)
				if existingRoom.PlayerCount() >= MinPlayersToStart && !existingRoom.Match.IsStarted() {
					existingRoom.Match.Start()
				}
				rm.sendRoomJoinedMessage(player, existingRoom)
				return existingRoom, true
			}
		}
	}

	room := NewTypedRoom(RoomKindCode, normalizedCode, rm.defaultMapID)
	_ = room.AddPlayer(player)
	room.Match.RegisterPlayer(player.ID)
	rm.rooms[room.ID] = room
	rm.playerToRoom[player.ID] = room.ID
	rm.codeIndex[normalizedCode] = room.ID
	rm.sendRoomJoinedMessage(player, room)
	return room, true
}

func (rm *RoomManager) sendRoomJoinedMessage(player *Player, room *Room) {
	data := map[string]any{
		"roomId":      room.ID,
		"playerId":    player.ID,
		"mapId":       room.MapID,
		"displayName": player.DisplayName,
	}
	if room.Kind == RoomKindCode && room.Code != "" {
		data["code"] = room.Code
	}

	message := map[string]any{
		"type":      "room:joined",
		"timestamp": time.Now().UnixMilli(),
		"data":      data,
	}

	msgBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling room:joined message: %v", err)
		return
	}

	func() {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("Warning: Could not send room:joined message to player %s (channel closed)", player.ID)
			}
		}()

		select {
		case player.SendChan <- msgBytes:
		default:
			log.Printf("Warning: Could not send room:joined message to player %s (channel full)", player.ID)
		}
	}()
}

func (rm *RoomManager) RemovePlayer(playerID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for i, player := range rm.waitingPlayers {
		if player.ID == playerID {
			rm.waitingPlayers = append(rm.waitingPlayers[:i], rm.waitingPlayers[i+1:]...)
			return
		}
	}

	roomID, exists := rm.playerToRoom[playerID]
	if !exists {
		return
	}

	room, exists := rm.rooms[roomID]
	if !exists {
		delete(rm.playerToRoom, playerID)
		return
	}

	room.RemovePlayer(playerID)

	message := map[string]any{
		"type":      "player:left",
		"timestamp": time.Now().UnixMilli(),
		"data": map[string]any{
			"playerId": playerID,
		},
	}

	if msgBytes, err := json.Marshal(message); err != nil {
		log.Printf("Error marshaling player:left message: %v", err)
	} else {
		room.Broadcast(msgBytes, "")
	}

	delete(rm.playerToRoom, playerID)

	if !room.IsEmpty() {
		return
	}

	// Empty, unstarted code rooms are retained for TTL cleanup.
	if room.Kind == RoomKindCode && !room.Match.IsStarted() {
		return
	}

	delete(rm.rooms, roomID)
	if room.Kind == RoomKindCode && room.Code != "" {
		if indexedID, ok := rm.codeIndex[room.Code]; ok && indexedID == room.ID {
			delete(rm.codeIndex, room.Code)
		}
	}
	log.Printf("Room %s removed (no players remaining)", roomID)
}

func (rm *RoomManager) GetRoomByPlayerID(playerID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	roomID, exists := rm.playerToRoom[playerID]
	if !exists {
		return nil
	}

	return rm.rooms[roomID]
}

func (rm *RoomManager) SendToWaitingPlayer(playerID string, msgBytes []byte) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	for _, player := range rm.waitingPlayers {
		if player.ID == playerID {
			func() {
				defer func() {
					if rec := recover(); rec != nil {
						log.Printf("Warning: Could not send message to waiting player %s (channel closed)", playerID)
					}
				}()

				select {
				case player.SendChan <- msgBytes:
				default:
					log.Printf("Warning: Could not send message to waiting player %s (channel full)", playerID)
				}
			}()
			return
		}
	}
}

func (rm *RoomManager) SendToPlayer(playerID string, msgBytes []byte) bool {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	roomID, inRoom := rm.playerToRoom[playerID]
	if inRoom {
		if room, roomExists := rm.rooms[roomID]; roomExists {
			if player := room.GetPlayer(playerID); player != nil {
				func() {
					defer func() {
						if rec := recover(); rec != nil {
							log.Printf("Warning: Could not send message to player %s (channel closed)", playerID)
						}
					}()

					select {
					case player.SendChan <- msgBytes:
					default:
						log.Printf("Warning: Could not send message to player %s (channel full)", playerID)
					}
				}()
				return true
			}
		}
	}

	for _, player := range rm.waitingPlayers {
		if player.ID == playerID {
			func() {
				defer func() {
					if rec := recover(); rec != nil {
						log.Printf("Warning: Could not send message to waiting player %s (channel closed)", playerID)
					}
				}()

				select {
				case player.SendChan <- msgBytes:
				default:
					log.Printf("Warning: Could not send message to waiting player %s (channel full)", playerID)
				}
			}()
			return true
		}
	}

	return false
}

func (rm *RoomManager) BroadcastToAll(msgBytes []byte) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	for _, room := range rm.rooms {
		room.Broadcast(msgBytes, "")
	}

	for _, player := range rm.waitingPlayers {
		func() {
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("Warning: Could not send message to waiting player %s (channel closed)", player.ID)
				}
			}()

			select {
			case player.SendChan <- msgBytes:
			default:
				log.Printf("Warning: Could not send message to waiting player %s (channel full)", player.ID)
			}
		}()
	}
}

func (rm *RoomManager) GetAllRooms() []*Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	rooms := make([]*Room, 0, len(rm.rooms))
	for _, room := range rm.rooms {
		rooms = append(rooms, room)
	}
	return rooms
}

func (rm *RoomManager) RemoveRoomIfIdle(roomID string) bool {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	room, exists := rm.rooms[roomID]
	if !exists {
		return false
	}
	if room.Kind != RoomKindCode || room.Match.IsStarted() || !room.IsEmpty() || room.EmptySince == nil {
		return false
	}
	if room.Code != "" {
		if indexedID, ok := rm.codeIndex[room.Code]; ok && indexedID == room.ID {
			delete(rm.codeIndex, room.Code)
		}
	}
	delete(rm.rooms, roomID)
	return true
}

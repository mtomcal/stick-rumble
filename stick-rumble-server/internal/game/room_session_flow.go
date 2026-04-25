package game

type RoomSessionActivation struct {
	Player *Player
	Room   *Room
}

type RoomSessionPublication struct {
	Player *Player
	Room   *Room
	State  SessionStatusState
}

type RoomSessionRejectionKind string

const (
	RoomSessionRejectionBadRoomCode  RoomSessionRejectionKind = "bad_room_code"
	RoomSessionRejectionRoomFull     RoomSessionRejectionKind = "room_full"
	RoomSessionRejectionInvalidHello RoomSessionRejectionKind = "invalid_hello"
)

type RoomSessionRejection struct {
	Kind   RoomSessionRejectionKind
	Reason string
	Code   string
}

type RoomSessionResult struct {
	Room         *Room
	Publications []RoomSessionPublication
	Activations  []RoomSessionActivation
	LeftSession  bool
	Rejection    *RoomSessionRejection
}

type RoomSessionFlow struct {
	roomManager *RoomManager
}

func NewRoomSessionFlow(roomManager *RoomManager) *RoomSessionFlow {
	return &RoomSessionFlow{roomManager: roomManager}
}

func (f *RoomSessionFlow) HandleHello(player *Player, data map[string]any) RoomSessionResult {
	player.DisplayName = FallbackDisplayName
	if rawDisplayName, exists := data["displayName"]; exists {
		player.DisplayName = SanitizeDisplayName(rawDisplayName)
	}

	mode, _ := data["mode"].(string)
	switch mode {
	case string(RoomKindPublic):
		return f.joinPublic(player)
	case string(RoomKindCode):
		code, reason, normalized := NormalizeRoomCode(data["code"])
		if !normalized {
			return RoomSessionResult{
				Rejection: &RoomSessionRejection{
					Kind:   RoomSessionRejectionBadRoomCode,
					Reason: string(reason),
				},
			}
		}
		return f.joinCode(player, code)
	default:
		return RoomSessionResult{
			Rejection: &RoomSessionRejection{Kind: RoomSessionRejectionInvalidHello},
		}
	}
}

func (f *RoomSessionFlow) joinPublic(player *Player) RoomSessionResult {
	rm := f.roomManager
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for _, room := range rm.rooms {
		if room.Kind != RoomKindPublic || room.PlayerCount() != 1 || room.Match.IsEnded() {
			continue
		}
		if err := room.AddPlayer(player); err != nil {
			continue
		}
		rm.playerToRoom[player.ID] = room.ID
		room.Match.RegisterPlayer(player.ID)
		if room.PlayerCount() >= MinPlayersToStart && !room.Match.IsStarted() {
			room.Match.Start()
		}
		return RoomSessionResult{
			Room:         room,
			Publications: sessionPublicationsForRoom(room, SessionStatusMatchReady),
			Activations:  sessionActivationsForRoom(room),
		}
	}

	rm.waitingPlayers = append(rm.waitingPlayers, player)
	result := RoomSessionResult{
		Publications: []RoomSessionPublication{{
			Player: player,
			State:  SessionStatusSearchingForMatch,
		}},
	}
	if len(rm.waitingPlayers) < MinPlayersToStart {
		return result
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

	return RoomSessionResult{
		Room:         room,
		Publications: sessionPublicationsForRoom(room, SessionStatusMatchReady),
		Activations:  sessionActivationsForRoom(room),
	}
}

func (f *RoomSessionFlow) joinCode(player *Player, normalizedCode string) RoomSessionResult {
	rm := f.roomManager
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if existingRoomID, ok := rm.codeIndex[normalizedCode]; ok {
		if existingRoom, exists := rm.rooms[existingRoomID]; exists {
			if existingRoom.Match.IsEnded() {
				delete(rm.codeIndex, normalizedCode)
			} else if existingRoom.PlayerCount() >= existingRoom.MaxPlayers {
				return RoomSessionResult{
					Room: existingRoom,
					Rejection: &RoomSessionRejection{
						Kind: RoomSessionRejectionRoomFull,
						Code: normalizedCode,
					},
				}
			} else {
				if err := existingRoom.AddPlayer(player); err != nil {
					return RoomSessionResult{
						Room: existingRoom,
						Rejection: &RoomSessionRejection{
							Kind: RoomSessionRejectionRoomFull,
							Code: normalizedCode,
						},
					}
				}
				rm.playerToRoom[player.ID] = existingRoom.ID
				existingRoom.Match.RegisterPlayer(player.ID)
				if existingRoom.PlayerCount() >= MinPlayersToStart && !existingRoom.Match.IsStarted() {
					existingRoom.Match.Start()
					return RoomSessionResult{
						Room:         existingRoom,
						Publications: sessionPublicationsForRoom(existingRoom, SessionStatusMatchReady),
						Activations:  sessionActivationsForRoom(existingRoom),
					}
				}
				if existingRoom.Match.IsStarted() {
					return RoomSessionResult{
						Room: existingRoom,
						Publications: []RoomSessionPublication{{
							Player: player,
							Room:   existingRoom,
							State:  SessionStatusMatchReady,
						}},
						Activations: []RoomSessionActivation{{
							Player: player,
							Room:   existingRoom,
						}},
					}
				}
				return RoomSessionResult{
					Room: existingRoom,
					Publications: []RoomSessionPublication{{
						Player: player,
						Room:   existingRoom,
						State:  SessionStatusWaitingForPlayers,
					}},
				}
			}
		}
	}

	room := NewTypedRoom(RoomKindCode, normalizedCode, rm.defaultMapID)
	_ = room.AddPlayer(player)
	room.Match.RegisterPlayer(player.ID)
	rm.rooms[room.ID] = room
	rm.playerToRoom[player.ID] = room.ID
	rm.codeIndex[normalizedCode] = room.ID

	return RoomSessionResult{
		Room: room,
		Publications: []RoomSessionPublication{{
			Player: player,
			Room:   room,
			State:  SessionStatusWaitingForPlayers,
		}},
	}
}

func (f *RoomSessionFlow) LeaveSession(playerID string) RoomSessionResult {
	rm := f.roomManager
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for i, player := range rm.waitingPlayers {
		if player.ID != playerID {
			continue
		}
		rm.waitingPlayers = append(rm.waitingPlayers[:i], rm.waitingPlayers[i+1:]...)
		return RoomSessionResult{LeftSession: true}
	}

	roomID, exists := rm.playerToRoom[playerID]
	if !exists {
		return RoomSessionResult{}
	}

	room, exists := rm.rooms[roomID]
	if !exists || room.Match.IsStarted() {
		return RoomSessionResult{}
	}

	room.RemovePlayer(playerID)
	delete(rm.playerToRoom, playerID)

	if room.IsEmpty() {
		delete(rm.rooms, roomID)
		if room.Kind == RoomKindCode && room.Code != "" {
			if indexedID, ok := rm.codeIndex[room.Code]; ok && indexedID == room.ID {
				delete(rm.codeIndex, room.Code)
			}
		}
		return RoomSessionResult{LeftSession: true}
	}

	return RoomSessionResult{
		LeftSession:  true,
		Publications: sessionPublicationsForRoom(room, SessionStatusWaitingForPlayers),
	}
}

func sessionPublicationsForRoom(room *Room, state SessionStatusState) []RoomSessionPublication {
	players := room.GetPlayers()
	publications := make([]RoomSessionPublication, 0, len(players))
	for _, player := range players {
		publications = append(publications, RoomSessionPublication{
			Player: player,
			Room:   room,
			State:  state,
		})
	}
	return publications
}

func sessionActivationsForRoom(room *Room) []RoomSessionActivation {
	players := room.GetPlayers()
	activations := make([]RoomSessionActivation, 0, len(players))
	for _, player := range players {
		activations = append(activations, RoomSessionActivation{
			Player: player,
			Room:   room,
		})
	}
	return activations
}

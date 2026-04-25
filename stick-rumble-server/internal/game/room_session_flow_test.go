package game

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newSessionFlowPlayer(id string) *Player {
	return &Player{
		ID:       id,
		SendChan: make(chan []byte, 10),
	}
}

func publicationStatesForPlayer(publications []RoomSessionPublication, playerID string) []SessionStatusState {
	states := make([]SessionStatusState, 0)
	for _, publication := range publications {
		if publication.Player.ID == playerID {
			states = append(states, publication.State)
		}
	}
	return states
}

func activationIDs(activations []RoomSessionActivation) []string {
	ids := make([]string, 0, len(activations))
	for _, activation := range activations {
		ids = append(ids, activation.Player.ID)
	}
	return ids
}

func TestRoomSessionFlowPublicHelloTransitionsToSearchingThenMatchReady(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player1 := newSessionFlowPlayer("player-1")
	player2 := newSessionFlowPlayer("player-2")

	first := flow.HandleHello(player1, map[string]any{
		"displayName": "Alice",
		"mode":        "public",
	})
	require.Nil(t, first.Rejection)
	assert.Nil(t, first.Room)
	assert.Equal(t, []SessionStatusState{SessionStatusSearchingForMatch}, publicationStatesForPlayer(first.Publications, player1.ID))
	assert.Empty(t, first.Activations)
	assert.Equal(t, "Alice", player1.DisplayName)

	second := flow.HandleHello(player2, map[string]any{
		"displayName": "Bob",
		"mode":        "public",
	})
	require.Nil(t, second.Rejection)
	require.NotNil(t, second.Room)
	assert.True(t, second.Room.Match.IsStarted())
	assert.ElementsMatch(t, []string{player1.ID, player2.ID}, activationIDs(second.Activations))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(second.Publications, player1.ID))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(second.Publications, player2.ID))
	assert.Empty(t, manager.waitingPlayers)
	assert.Equal(t, second.Room.ID, manager.playerToRoom[player1.ID])
	assert.Equal(t, second.Room.ID, manager.playerToRoom[player2.ID])
}

func TestRoomSessionFlowCodeHelloTransitionsToWaitingThenMatchReady(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player1 := newSessionFlowPlayer("player-1")
	player2 := newSessionFlowPlayer("player-2")

	first := flow.HandleHello(player1, map[string]any{
		"displayName": "  Alpha  ",
		"mode":        "code",
		"code":        " pizza ",
	})
	require.Nil(t, first.Rejection)
	require.NotNil(t, first.Room)
	assert.False(t, first.Room.Match.IsStarted())
	assert.Equal(t, "PIZZA", first.Room.Code)
	assert.Equal(t, []SessionStatusState{SessionStatusWaitingForPlayers}, publicationStatesForPlayer(first.Publications, player1.ID))
	assert.Empty(t, first.Activations)
	assert.Equal(t, "Alpha", player1.DisplayName)

	second := flow.HandleHello(player2, map[string]any{
		"displayName": "Bravo",
		"mode":        "code",
		"code":        "PIZZA",
	})
	require.Nil(t, second.Rejection)
	require.NotNil(t, second.Room)
	assert.True(t, second.Room.Match.IsStarted())
	assert.ElementsMatch(t, []string{player1.ID, player2.ID}, activationIDs(second.Activations))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(second.Publications, player1.ID))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(second.Publications, player2.ID))
}

func TestRoomSessionFlowRejectsBadRoomCode(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player := newSessionFlowPlayer("player-1")

	result := flow.HandleHello(player, map[string]any{
		"displayName": "Bad Code",
		"mode":        "code",
		"code":        "!!",
	})

	require.NotNil(t, result.Rejection)
	assert.Equal(t, RoomSessionRejectionBadRoomCode, result.Rejection.Kind)
	assert.Equal(t, string(RoomCodeTooShort), result.Rejection.Reason)
	assert.Empty(t, result.Publications)
	assert.Empty(t, result.Activations)
	assert.Empty(t, manager.rooms)
	assert.Empty(t, manager.codeIndex)
}

func TestRoomSessionFlowRejectsInvalidHelloMode(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player := newSessionFlowPlayer("player-1")

	result := flow.HandleHello(player, map[string]any{
		"displayName": "Player",
		"mode":        "bogus",
	})

	require.NotNil(t, result.Rejection)
	assert.Equal(t, RoomSessionRejectionInvalidHello, result.Rejection.Kind)
	assert.Empty(t, result.Publications)
	assert.Empty(t, result.Activations)
	assert.Empty(t, manager.waitingPlayers)
	assert.Empty(t, manager.playerToRoom)
}

func TestRoomSessionFlowRejectsFullCodeRoom(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()

	for i := 0; i < 8; i++ {
		player := newSessionFlowPlayer(string(rune('a' + i)))
		result := flow.HandleHello(player, map[string]any{
			"displayName": "Packed",
			"mode":        "code",
			"code":        "PACKED",
		})
		require.Nil(t, result.Rejection)
	}

	rejected := flow.HandleHello(newSessionFlowPlayer("overflow"), map[string]any{
		"displayName": "Overflow",
		"mode":        "code",
		"code":        "PACKED",
	})

	require.NotNil(t, rejected.Rejection)
	assert.Equal(t, RoomSessionRejectionRoomFull, rejected.Rejection.Kind)
	assert.Equal(t, "PACKED", rejected.Rejection.Code)
	assert.Empty(t, rejected.Publications)
	assert.Empty(t, rejected.Activations)
	assert.Empty(t, manager.playerToRoom["overflow"])
	roomID := manager.codeIndex["PACKED"]
	require.NotEmpty(t, roomID)
	require.Len(t, manager.rooms[roomID].GetPlayers(), 8)
	assert.Nil(t, manager.rooms[roomID].GetPlayer("overflow"))
}

func TestRoomSessionFlowLeaveRemovesWaitingPlayer(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player := newSessionFlowPlayer("player-1")

	joined := flow.HandleHello(player, map[string]any{
		"displayName": "Queue Player",
		"mode":        "public",
	})
	require.Nil(t, joined.Rejection)

	left := flow.LeaveSession(player.ID)
	assert.True(t, left.LeftSession)
	assert.Empty(t, left.Publications)
	assert.Empty(t, manager.waitingPlayers)
	assert.Empty(t, manager.playerToRoom)
}

func TestRoomSessionFlowPublicHelloCanJoinExistingSinglePlayerRoom(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	existingPlayer := newSessionFlowPlayer("player-1")
	existingPlayer.DisplayName = "Existing"
	room := NewTypedRoom(RoomKindPublic, "", manager.defaultMapID)
	require.NoError(t, room.AddPlayer(existingPlayer))
	room.Match.RegisterPlayer(existingPlayer.ID)
	manager.rooms[room.ID] = room
	manager.playerToRoom[existingPlayer.ID] = room.ID

	joiningPlayer := newSessionFlowPlayer("player-2")
	result := flow.HandleHello(joiningPlayer, map[string]any{
		"displayName": "Joiner",
		"mode":        "public",
	})

	require.Nil(t, result.Rejection)
	require.NotNil(t, result.Room)
	assert.Equal(t, room.ID, result.Room.ID)
	assert.True(t, result.Room.Match.IsStarted())
	assert.ElementsMatch(t, []string{existingPlayer.ID, joiningPlayer.ID}, activationIDs(result.Activations))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(result.Publications, existingPlayer.ID))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(result.Publications, joiningPlayer.ID))
}

func TestRoomSessionFlowPublicHelloDoesNotReuseCodeRoom(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	host := newSessionFlowPlayer("host")
	host.DisplayName = "Host"
	codeRoom := NewTypedRoom(RoomKindCode, "PIZZA", manager.defaultMapID)
	require.NoError(t, codeRoom.AddPlayer(host))
	codeRoom.Match.RegisterPlayer(host.ID)
	manager.rooms[codeRoom.ID] = codeRoom
	manager.playerToRoom[host.ID] = codeRoom.ID
	manager.codeIndex["PIZZA"] = codeRoom.ID

	publicPlayer := newSessionFlowPlayer("public-player")
	result := flow.HandleHello(publicPlayer, map[string]any{
		"displayName": "Public",
		"mode":        "public",
	})

	require.Nil(t, result.Rejection)
	assert.Nil(t, result.Room)
	assert.Equal(t, []SessionStatusState{SessionStatusSearchingForMatch}, publicationStatesForPlayer(result.Publications, publicPlayer.ID))
	assert.Len(t, manager.waitingPlayers, 1)
	assert.Same(t, publicPlayer, manager.waitingPlayers[0])
	assert.Equal(t, codeRoom.ID, manager.codeIndex["PIZZA"])
	assert.Equal(t, codeRoom.ID, manager.playerToRoom[host.ID])
}

func TestRoomSessionFlowLeaveRemovesSoloCodeRoomAndClearsIndex(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player := newSessionFlowPlayer("player-1")

	joined := flow.HandleHello(player, map[string]any{
		"displayName": "Code Player",
		"mode":        "code",
		"code":        "PIZZA",
	})
	require.Nil(t, joined.Rejection)
	require.NotNil(t, joined.Room)

	left := flow.LeaveSession(player.ID)
	assert.True(t, left.LeftSession)
	assert.Empty(t, left.Publications)
	assert.Empty(t, manager.playerToRoom)
	assert.Empty(t, manager.codeIndex)
	assert.Empty(t, manager.rooms)
}

func TestRoomSessionFlowLeaveIgnoredForActiveMatch(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player1 := newSessionFlowPlayer("player-1")
	player2 := newSessionFlowPlayer("player-2")

	require.Nil(t, flow.HandleHello(player1, map[string]any{
		"displayName": "Alpha",
		"mode":        "public",
	}).Rejection)
	ready := flow.HandleHello(player2, map[string]any{
		"displayName": "Bravo",
		"mode":        "public",
	})
	require.Nil(t, ready.Rejection)
	require.NotNil(t, ready.Room)

	left := flow.LeaveSession(player1.ID)
	assert.False(t, left.LeftSession)
	assert.Empty(t, left.Publications)
	assert.Equal(t, ready.Room.ID, manager.playerToRoom[player1.ID])
	assert.NotNil(t, ready.Room.GetPlayer(player1.ID))
}

func TestRoomSessionFlowActivationsOnlyIncludeNewlyActivePlayers(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	player1 := newSessionFlowPlayer("player-1")
	player2 := newSessionFlowPlayer("player-2")
	player3 := newSessionFlowPlayer("player-3")

	first := flow.HandleHello(player1, map[string]any{
		"displayName": "Alpha",
		"mode":        "code",
		"code":        "REMATCH",
	})
	require.Nil(t, first.Rejection)
	assert.Empty(t, first.Activations)

	second := flow.HandleHello(player2, map[string]any{
		"displayName": "Bravo",
		"mode":        "code",
		"code":        "REMATCH",
	})
	require.Nil(t, second.Rejection)
	assert.ElementsMatch(t, []string{player1.ID, player2.ID}, activationIDs(second.Activations))

	lateJoin := flow.HandleHello(player3, map[string]any{
		"displayName": "Charlie",
		"mode":        "code",
		"code":        "REMATCH",
	})
	require.Nil(t, lateJoin.Rejection)
	assert.Equal(t, []string{player3.ID}, activationIDs(lateJoin.Activations))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(lateJoin.Publications, player3.ID))
}

func TestRoomSessionFlowEndedCodeRoomCreatesFreshRoomAndPreservesReplacementIndexDuringTeardown(t *testing.T) {
	manager := NewRoomManager()
	flow := manager.SessionFlow()
	legacyPlayer := newSessionFlowPlayer("legacy-player")
	legacyRoom := NewTypedRoom(RoomKindCode, "REMATCH", manager.defaultMapID)
	require.NoError(t, legacyRoom.AddPlayer(legacyPlayer))
	legacyRoom.Match.RegisterPlayer(legacyPlayer.ID)
	legacyRoom.Match.Start()
	legacyRoom.Match.EndMatch("time_limit")
	manager.rooms[legacyRoom.ID] = legacyRoom
	manager.playerToRoom[legacyPlayer.ID] = legacyRoom.ID
	manager.codeIndex["REMATCH"] = legacyRoom.ID

	rematchHost := newSessionFlowPlayer("rematch-host")
	created := flow.HandleHello(rematchHost, map[string]any{
		"displayName": "Rematch Host",
		"mode":        "code",
		"code":        "rematch",
	})

	require.Nil(t, created.Rejection)
	require.NotNil(t, created.Room)
	assert.NotEqual(t, legacyRoom.ID, created.Room.ID)
	assert.Equal(t, RoomKindCode, created.Room.Kind)
	assert.Equal(t, "REMATCH", created.Room.Code)
	assert.Equal(t, []SessionStatusState{SessionStatusWaitingForPlayers}, publicationStatesForPlayer(created.Publications, rematchHost.ID))
	assert.Equal(t, created.Room.ID, manager.codeIndex["REMATCH"])

	manager.RemovePlayer(legacyPlayer.ID)

	assert.NotContains(t, manager.rooms, legacyRoom.ID)
	assert.Equal(t, created.Room.ID, manager.codeIndex["REMATCH"])

	lateJoiner := newSessionFlowPlayer("late-joiner")
	joined := flow.HandleHello(lateJoiner, map[string]any{
		"displayName": "Late Joiner",
		"mode":        "code",
		"code":        "REMATCH",
	})

	require.Nil(t, joined.Rejection)
	require.NotNil(t, joined.Room)
	assert.Same(t, created.Room, joined.Room)
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(joined.Publications, rematchHost.ID))
	assert.Equal(t, []SessionStatusState{SessionStatusMatchReady}, publicationStatesForPlayer(joined.Publications, lateJoiner.ID))
}

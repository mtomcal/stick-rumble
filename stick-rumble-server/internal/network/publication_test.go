package network

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/mtomcal/stick-rumble-server/internal/game"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubEnvelopeBuilder struct {
	buildCalls []stubBuildCall
	buildErr   error
	timestamp  int64
}

type stubBuildCall struct {
	messageType string
	data        any
}

func (b *stubEnvelopeBuilder) Build(messageType string, data any) ([]byte, error) {
	b.buildCalls = append(b.buildCalls, stubBuildCall{
		messageType: messageType,
		data:        data,
	})

	if b.buildErr != nil {
		return nil, b.buildErr
	}

	return json.Marshal(Message{
		Type:      messageType,
		Timestamp: b.timestamp,
		Data:      data,
	})
}

func TestServerToClientPublicationPublishesSessionStatusStates(t *testing.T) {
	builder := &stubEnvelopeBuilder{timestamp: 4242}
	roomManager := game.NewRoomManager()
	publication := newServerToClientPublication(builder, roomManager)

	waitingPlayer := game.NewPlayer("waiting-player", make(chan []byte, 1))
	roomManager.AddPlayer(waitingPlayer)

	matchReadyRoom := game.NewTypedRoom(game.RoomKindCode, "ABCD")
	matchReadyRoom.MapID = "arena-alpha"
	roomPlayer := game.NewPlayer("room-player", make(chan []byte, 1))
	roomPlayer.DisplayName = "Room Player"
	require.NoError(t, matchReadyRoom.AddPlayer(roomPlayer))

	testCases := []struct {
		name          string
		player        *game.Player
		room          *game.Room
		state         game.SessionStatusState
		expectedState string
		expectedMode  string
		expectRoomID  bool
		expectCode    bool
		expectMapID   bool
	}{
		{
			name:          "searching for match",
			player:        waitingPlayer,
			room:          nil,
			state:         game.SessionStatusSearchingForMatch,
			expectedState: "searching_for_match",
			expectedMode:  "public",
		},
		{
			name:          "waiting for players",
			player:        roomPlayer,
			room:          matchReadyRoom,
			state:         game.SessionStatusWaitingForPlayers,
			expectedState: "waiting_for_players",
			expectedMode:  "code",
			expectRoomID:  true,
			expectCode:    true,
		},
		{
			name:          "match ready",
			player:        roomPlayer,
			room:          matchReadyRoom,
			state:         game.SessionStatusMatchReady,
			expectedState: "match_ready",
			expectedMode:  "code",
			expectRoomID:  true,
			expectCode:    true,
			expectMapID:   true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := publication.PublishSessionStatus(tc.player, tc.room, tc.state)
			require.NoError(t, err)

			var msg Message
			select {
			case msgBytes := <-tc.player.SendChan:
				require.NoError(t, json.Unmarshal(msgBytes, &msg))
			case <-time.After(2 * time.Second):
				t.Fatal("timed out waiting for published session:status")
			}

			assert.Equal(t, "session:status", msg.Type)
			assert.Equal(t, builder.timestamp, msg.Timestamp)

			data, ok := msg.Data.(map[string]any)
			require.True(t, ok)
			assert.Equal(t, tc.expectedState, data["state"])
			assert.Equal(t, tc.player.ID, data["playerId"])
			assert.Equal(t, tc.expectedMode, data["joinMode"])

			if tc.expectRoomID {
				assert.Equal(t, tc.room.ID, data["roomId"])
			} else {
				assert.NotContains(t, data, "roomId")
			}

			if tc.expectCode {
				assert.Equal(t, tc.room.Code, data["code"])
			} else {
				assert.NotContains(t, data, "code")
			}

			if tc.expectMapID {
				assert.Equal(t, tc.room.MapID, data["mapId"])
			} else {
				assert.NotContains(t, data, "mapId")
			}
		})
	}

	require.Len(t, builder.buildCalls, len(testCases))
	for _, call := range builder.buildCalls {
		assert.Equal(t, "session:status", call.messageType)
	}
}

func TestServerToClientPublicationPublishesPlayerLeftAndDirectErrors(t *testing.T) {
	builder := &stubEnvelopeBuilder{timestamp: 5150}
	roomManager := game.NewRoomManager()
	publication := newServerToClientPublication(builder, roomManager)

	player1 := game.NewPlayer("player-1", make(chan []byte, 2))
	player2 := game.NewPlayer("player-2", make(chan []byte, 2))
	room := game.NewTypedRoom(game.RoomKindPublic, "")
	require.NoError(t, room.AddPlayer(player1))
	require.NoError(t, room.AddPlayer(player2))

	require.NoError(t, publication.PublishPlayerLeft(room, player1.ID))

	var leftMsg Message
	select {
	case msgBytes := <-player2.SendChan:
		require.NoError(t, json.Unmarshal(msgBytes, &leftMsg))
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for player:left")
	}

	assert.Equal(t, "player:left", leftMsg.Type)
	assert.Equal(t, builder.timestamp, leftMsg.Timestamp)
	leftData, ok := leftMsg.Data.(map[string]any)
	require.True(t, ok)
	assert.Equal(t, player1.ID, leftData["playerId"])

	waitingPlayer := game.NewPlayer("waiting-player", make(chan []byte, 3))
	require.NoError(t, publication.SendNoHelloError(waitingPlayer, "input:state"))
	require.NoError(t, publication.SendBadRoomCodeError(waitingPlayer, string(game.RoomCodeTooShort)))
	require.NoError(t, publication.SendRoomFullError(waitingPlayer, "ABCD"))

	expectedTypes := []string{"error:no_hello", "error:bad_room_code", "error:room_full"}
	for _, expectedType := range expectedTypes {
		var msg Message
		select {
		case msgBytes := <-waitingPlayer.SendChan:
			require.NoError(t, json.Unmarshal(msgBytes, &msg))
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for %s", expectedType)
		}

		assert.Equal(t, expectedType, msg.Type)
		assert.Equal(t, builder.timestamp, msg.Timestamp)
	}
}

func TestServerToClientPublicationPublishesGameplayEvents(t *testing.T) {
	builder := &stubEnvelopeBuilder{timestamp: 8080}
	roomManager := game.NewRoomManager()
	publication := newServerToClientPublication(builder, roomManager)

	attacker := game.NewPlayer("attacker", make(chan []byte, 8))
	victim := game.NewPlayer("victim", make(chan []byte, 8))
	roomManager.AddPlayer(attacker)
	room := roomManager.AddPlayer(victim)
	require.NotNil(t, room)

	require.NoError(t, publication.BroadcastPlayerDamaged(room, playerDamagedData{
		VictimID:     victim.ID,
		AttackerID:   attacker.ID,
		Damage:       25,
		NewHealth:    75,
		ProjectileID: "proj-1",
	}))
	require.NoError(t, publication.SendHitConfirmed(attacker.ID, hitConfirmedData{
		VictimID:     victim.ID,
		Damage:       25,
		ProjectileID: "proj-1",
	}))
	require.NoError(t, publication.BroadcastPlayerDeath(room, playerDeathData{
		VictimID:   victim.ID,
		AttackerID: attacker.ID,
	}))
	require.NoError(t, publication.BroadcastPlayerKillCredit(room, playerKillCreditData{
		KillerID:    attacker.ID,
		VictimID:    victim.ID,
		KillerKills: 1,
		KillerXP:    100,
	}))
	require.NoError(t, publication.BroadcastPlayerRespawn(room, playerRespawnData{
		PlayerID: victim.ID,
		Position: game.Vector2{X: 10, Y: 20},
		Health:   game.PlayerMaxHealth,
	}))
	require.NoError(t, publication.SendWeaponState(attacker.ID, weaponStateData{
		CurrentAmmo: 5,
		MaxAmmo:     8,
		IsReloading: false,
		CanShoot:    true,
		WeaponType:  "Pistol",
		IsMelee:     false,
	}))
	require.NoError(t, publication.BroadcastMatchEnded(room, matchEndedData{
		Winners: []game.WinnerSummary{{
			PlayerID:    attacker.ID,
			DisplayName: "Winner",
		}},
		FinalScores: []game.PlayerScore{{
			PlayerID:    attacker.ID,
			DisplayName: "Winner",
			Kills:       1,
			Deaths:      0,
			XP:          100,
		}},
		Reason: "kill_target",
	}))

	assert.GreaterOrEqual(t, len(builder.buildCalls), 7)
	assert.Equal(t, "player:damaged", builder.buildCalls[0].messageType)
	assert.Equal(t, "hit:confirmed", builder.buildCalls[1].messageType)
	assert.Equal(t, "player:death", builder.buildCalls[2].messageType)
	assert.Equal(t, "player:kill_credit", builder.buildCalls[3].messageType)
	assert.Equal(t, "player:respawn", builder.buildCalls[4].messageType)
	assert.Equal(t, "weapon:state", builder.buildCalls[5].messageType)
	assert.Equal(t, "match:ended", builder.buildCalls[6].messageType)
}

func TestServerToClientPublicationReturnsBuilderErrors(t *testing.T) {
	sentinel := errors.New("builder failed")
	publication := newServerToClientPublication(&stubEnvelopeBuilder{
		buildErr: sentinel,
	}, game.NewRoomManager())

	player := game.NewPlayer("player-1", make(chan []byte, 1))

	err := publication.SendNoHelloError(player, "input:state")
	require.ErrorIs(t, err, sentinel)

	select {
	case <-player.SendChan:
		t.Fatal("expected no message to be sent when builder fails")
	default:
	}
}

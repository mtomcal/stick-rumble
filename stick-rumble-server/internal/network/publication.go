package network

import (
	"fmt"

	"github.com/mtomcal/stick-rumble-server/internal/game"
)

type outgoingEnvelopeBuilder interface {
	Build(messageType string, data any) ([]byte, error)
}

type serverToClientPublication struct {
	builder     outgoingEnvelopeBuilder
	roomManager *game.RoomManager
}

type sessionStatusData struct {
	State       string `json:"state"`
	PlayerID    string `json:"playerId"`
	DisplayName string `json:"displayName"`
	JoinMode    string `json:"joinMode"`
	RoomID      string `json:"roomId,omitempty"`
	Code        string `json:"code,omitempty"`
	RosterSize  int    `json:"rosterSize,omitempty"`
	MinPlayers  int    `json:"minPlayers,omitempty"`
	MapID       string `json:"mapId,omitempty"`
}

type playerLeftData struct {
	PlayerID string `json:"playerId"`
}

type errorNoHelloData struct {
	OffendingType string `json:"offendingType"`
}

type errorBadRoomCodeData struct {
	Reason string `json:"reason"`
}

type errorRoomFullData struct {
	Code string `json:"code"`
}

type playerDamagedData struct {
	VictimID     string `json:"victimId"`
	AttackerID   string `json:"attackerId"`
	Damage       int    `json:"damage"`
	NewHealth    int    `json:"newHealth"`
	ProjectileID string `json:"projectileId"`
}

type hitConfirmedData struct {
	VictimID     string `json:"victimId"`
	Damage       int    `json:"damage"`
	ProjectileID string `json:"projectileId"`
}

type playerDeathData struct {
	VictimID   string `json:"victimId"`
	AttackerID string `json:"attackerId"`
}

type playerKillCreditData struct {
	KillerID    string `json:"killerId"`
	VictimID    string `json:"victimId"`
	KillerKills int    `json:"killerKills"`
	KillerXP    int    `json:"killerXP"`
}

type playerRespawnData struct {
	PlayerID string       `json:"playerId"`
	Position game.Vector2 `json:"position"`
	Health   int          `json:"health"`
}

type weaponStateData struct {
	CurrentAmmo int    `json:"currentAmmo"`
	MaxAmmo     int    `json:"maxAmmo"`
	IsReloading bool   `json:"isReloading"`
	CanShoot    bool   `json:"canShoot"`
	WeaponType  string `json:"weaponType"`
	IsMelee     bool   `json:"isMelee"`
}

type matchEndedData struct {
	Winners     []game.WinnerSummary `json:"winners"`
	FinalScores []game.PlayerScore   `json:"finalScores"`
	Reason      string               `json:"reason"`
}

func newServerToClientPublication(builder outgoingEnvelopeBuilder, roomManager *game.RoomManager) *serverToClientPublication {
	return &serverToClientPublication{
		builder:     builder,
		roomManager: roomManager,
	}
}

func (p *serverToClientPublication) PublishSessionStatus(player *game.Player, room *game.Room, state game.SessionStatusState) error {
	msgBytes, err := p.builder.Build("session:status", p.buildSessionStatusData(player, room, state))
	if err != nil {
		return err
	}

	return p.sendDirect(player, msgBytes)
}

func (p *serverToClientPublication) PublishPlayerLeft(room *game.Room, playerID string) error {
	msgBytes, err := p.builder.Build("player:left", playerLeftData{PlayerID: playerID})
	if err != nil {
		return err
	}

	room.Broadcast(msgBytes, "")
	return nil
}

func (p *serverToClientPublication) SendNoHelloError(player *game.Player, offendingType string) error {
	msgBytes, err := p.builder.Build("error:no_hello", errorNoHelloData{OffendingType: offendingType})
	if err != nil {
		return err
	}

	return p.sendDirect(player, msgBytes)
}

func (p *serverToClientPublication) SendBadRoomCodeError(player *game.Player, reason string) error {
	msgBytes, err := p.builder.Build("error:bad_room_code", errorBadRoomCodeData{Reason: reason})
	if err != nil {
		return err
	}

	return p.sendDirect(player, msgBytes)
}

func (p *serverToClientPublication) SendRoomFullError(player *game.Player, code string) error {
	msgBytes, err := p.builder.Build("error:room_full", errorRoomFullData{Code: code})
	if err != nil {
		return err
	}

	return p.sendDirect(player, msgBytes)
}

func (p *serverToClientPublication) BroadcastPlayerDamaged(room *game.Room, data playerDamagedData) error {
	return p.broadcastToRoom(room, "player:damaged", data)
}

func (p *serverToClientPublication) SendHitConfirmed(playerID string, data hitConfirmedData) error {
	return p.sendToPlayerID(playerID, "hit:confirmed", data)
}

func (p *serverToClientPublication) BroadcastPlayerDeath(room *game.Room, data playerDeathData) error {
	return p.broadcastToRoom(room, "player:death", data)
}

func (p *serverToClientPublication) BroadcastPlayerKillCredit(room *game.Room, data playerKillCreditData) error {
	return p.broadcastToRoom(room, "player:kill_credit", data)
}

func (p *serverToClientPublication) BroadcastPlayerRespawn(room *game.Room, data playerRespawnData) error {
	return p.broadcastToRoom(room, "player:respawn", data)
}

func (p *serverToClientPublication) SendWeaponState(playerID string, data weaponStateData) error {
	return p.sendToPlayerID(playerID, "weapon:state", data)
}

func (p *serverToClientPublication) BroadcastMatchEnded(room *game.Room, data matchEndedData) error {
	return p.broadcastToRoom(room, "match:ended", data)
}

func (p *serverToClientPublication) buildSessionStatusData(player *game.Player, room *game.Room, state game.SessionStatusState) sessionStatusData {
	data := sessionStatusData{
		State:       string(state),
		PlayerID:    player.ID,
		DisplayName: player.DisplayName,
		JoinMode:    string(game.RoomKindPublic),
		MinPlayers:  game.MinPlayersToStart,
	}

	if room == nil {
		return data
	}

	data.JoinMode = string(room.Kind)
	data.RoomID = room.ID
	data.RosterSize = room.PlayerCount()

	if room.Kind == game.RoomKindCode && room.Code != "" {
		data.Code = room.Code
	}
	if state == game.SessionStatusMatchReady {
		data.MapID = room.MapID
	}

	return data
}

func (p *serverToClientPublication) sendDirect(player *game.Player, msgBytes []byte) (err error) {
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("send direct to player %s: channel closed", player.ID)
		}
	}()

	select {
	case player.SendChan <- msgBytes:
		return nil
	default:
		return fmt.Errorf("send direct to player %s: channel full", player.ID)
	}
}

func (p *serverToClientPublication) sendToPlayerID(playerID, messageType string, data any) error {
	msgBytes, err := p.builder.Build(messageType, data)
	if err != nil {
		return err
	}

	if p.roomManager == nil || !p.roomManager.SendToPlayer(playerID, msgBytes) {
		return fmt.Errorf("player %s not found for %s", playerID, messageType)
	}

	return nil
}

func (p *serverToClientPublication) broadcastToRoom(room *game.Room, messageType string, data any) error {
	msgBytes, err := p.builder.Build(messageType, data)
	if err != nil {
		return err
	}

	room.Broadcast(msgBytes, "")
	return nil
}

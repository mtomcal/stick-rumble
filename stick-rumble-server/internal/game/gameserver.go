package game

import (
	"context"
	"log"
	"sync"
	"time"
)

// Shoot failure reasons
const (
	ShootFailedNoPlayer = "no_player"
	ShootFailedCooldown = "cooldown"
	ShootFailedEmpty    = "empty"
	ShootFailedReload   = "reloading"
)

// ShootResult contains the result of a shoot attempt
type ShootResult struct {
	Success    bool
	Reason     string
	Projectile *Projectile
}

// GameServer manages the game loop and physics simulation
type GameServer struct {
	world             *World
	physics           *Physics
	projectileManager *ProjectileManager
	weaponStates      map[string]*WeaponState
	weaponMu          sync.RWMutex
	tickRate          time.Duration
	updateRate        time.Duration // Rate at which to broadcast updates to clients

	// Broadcast function to send state updates to clients
	broadcastFunc func(playerStates []PlayerState)

	// Callback for when a player's reload completes
	onReloadComplete func(playerID string)

	// Callback for when a projectile hits a player
	onHit func(hit HitEvent)

	// Callback for when a player respawns
	onRespawn func(playerID string, position Vector2)

	// Callback for match timer updates
	onMatchTimer func(roomID string, remainingSeconds int)

	// Callback for checking time limit across all rooms
	onCheckTimeLimit func()

	running bool
	mu      sync.RWMutex
	wg      sync.WaitGroup
}

// NewGameServer creates a new game server
func NewGameServer(broadcastFunc func(playerStates []PlayerState)) *GameServer {
	return &GameServer{
		world:             NewWorld(),
		physics:           NewPhysics(),
		projectileManager: NewProjectileManager(),
		weaponStates:      make(map[string]*WeaponState),
		tickRate:          time.Duration(ServerTickInterval) * time.Millisecond,
		updateRate:        time.Duration(ClientUpdateInterval) * time.Millisecond,
		broadcastFunc:     broadcastFunc,
		running:           false,
	}
}

// Start begins the game loop
func (gs *GameServer) Start(ctx context.Context) {
	gs.mu.Lock()
	if gs.running {
		gs.mu.Unlock()
		return
	}
	gs.running = true
	gs.mu.Unlock()

	gs.wg.Add(2)
	go gs.tickLoop(ctx)
	go gs.broadcastLoop(ctx)
}

// Stop gracefully stops the game server
func (gs *GameServer) Stop() {
	gs.mu.Lock()
	gs.running = false
	gs.mu.Unlock()

	gs.wg.Wait()
}

// tickLoop runs the physics simulation at ServerTickRate (60Hz)
func (gs *GameServer) tickLoop(ctx context.Context) {
	defer gs.wg.Done()

	ticker := time.NewTicker(gs.tickRate)
	defer ticker.Stop()

	lastTick := time.Now()

	for {
		select {
		case <-ctx.Done():
			log.Println("Game tick loop stopped")
			return
		case now := <-ticker.C:
			// Calculate delta time in seconds
			deltaTime := now.Sub(lastTick).Seconds()
			lastTick = now

			// Update all players
			gs.updateAllPlayers(deltaTime)

			// Update all projectiles
			gs.projectileManager.Update(deltaTime)

			// Check for projectile-player collisions (hit detection)
			gs.checkHitDetection()

			// Check for reload completions
			gs.checkReloads()

			// Check for respawns
			gs.checkRespawns()

			// Update invulnerability status
			gs.updateInvulnerability()
		}
	}
}

// broadcastLoop sends state updates to clients at ClientUpdateRate (20Hz)
func (gs *GameServer) broadcastLoop(ctx context.Context) {
	defer gs.wg.Done()

	ticker := time.NewTicker(gs.updateRate)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Game broadcast loop stopped")
			return
		case <-ticker.C:
			// Get all player states and broadcast
			if gs.broadcastFunc != nil {
				playerStates := gs.world.GetAllPlayers()
				if len(playerStates) > 0 {
					gs.broadcastFunc(playerStates)
				}
			}
		}
	}
}

// updateAllPlayers updates physics for all players
func (gs *GameServer) updateAllPlayers(deltaTime float64) {
	// Get all players (this is thread-safe and returns pointers)
	gs.world.mu.RLock()
	players := make([]*PlayerState, 0, len(gs.world.players))
	for _, player := range gs.world.players {
		players = append(players, player)
	}
	gs.world.mu.RUnlock()

	// Update each player's physics
	for _, player := range players {
		gs.physics.UpdatePlayer(player, deltaTime)
	}
}

// AddPlayer adds a new player to the game world
func (gs *GameServer) AddPlayer(playerID string) *PlayerState {
	player := gs.world.AddPlayer(playerID)

	// Create weapon state for the player (everyone starts with a pistol)
	gs.weaponMu.Lock()
	gs.weaponStates[playerID] = NewWeaponState(NewPistol())
	gs.weaponMu.Unlock()

	return player
}

// RemovePlayer removes a player from the game world
func (gs *GameServer) RemovePlayer(playerID string) {
	gs.world.RemovePlayer(playerID)

	// Remove weapon state
	gs.weaponMu.Lock()
	delete(gs.weaponStates, playerID)
	gs.weaponMu.Unlock()
}

// UpdatePlayerInput updates a player's input state
func (gs *GameServer) UpdatePlayerInput(playerID string, input InputState) bool {
	return gs.world.UpdatePlayerInput(playerID, input)
}

// GetPlayerState returns a snapshot of a player's state
func (gs *GameServer) GetPlayerState(playerID string) (PlayerState, bool) {
	player, exists := gs.world.GetPlayer(playerID)
	if !exists {
		return PlayerState{}, false
	}
	return player.Snapshot(), true
}

// IsRunning returns whether the game server is currently running
func (gs *GameServer) IsRunning() bool {
	gs.mu.RLock()
	defer gs.mu.RUnlock()
	return gs.running
}

// GetWorld returns the game world
func (gs *GameServer) GetWorld() *World {
	return gs.world
}

// SetOnReloadComplete sets the callback for when a player's reload completes
func (gs *GameServer) SetOnReloadComplete(callback func(playerID string)) {
	gs.onReloadComplete = callback
}

// GetWeaponState returns the weapon state for a player
func (gs *GameServer) GetWeaponState(playerID string) *WeaponState {
	gs.weaponMu.RLock()
	defer gs.weaponMu.RUnlock()
	return gs.weaponStates[playerID]
}

// PlayerShoot attempts to fire a projectile for the given player
func (gs *GameServer) PlayerShoot(playerID string, aimAngle float64) ShootResult {
	// Check if player exists
	player, exists := gs.world.GetPlayer(playerID)
	if !exists {
		return ShootResult{Success: false, Reason: ShootFailedNoPlayer}
	}

	// Get weapon state
	gs.weaponMu.RLock()
	ws := gs.weaponStates[playerID]
	gs.weaponMu.RUnlock()

	if ws == nil {
		return ShootResult{Success: false, Reason: ShootFailedNoPlayer}
	}

	// Check if reloading
	if ws.IsReloading {
		return ShootResult{Success: false, Reason: ShootFailedReload}
	}

	// Check if magazine is empty
	if ws.IsEmpty() {
		return ShootResult{Success: false, Reason: ShootFailedEmpty}
	}

	// Check fire rate cooldown
	if !ws.CanShoot() {
		return ShootResult{Success: false, Reason: ShootFailedCooldown}
	}

	// Create projectile at player position
	pos := player.GetPosition()
	proj := gs.projectileManager.CreateProjectile(
		playerID,
		pos,
		aimAngle,
		ws.Weapon.ProjectileSpeed,
	)

	// Record the shot (decrements ammo, sets cooldown)
	ws.RecordShot()

	return ShootResult{
		Success:    true,
		Projectile: proj,
	}
}

// PlayerReload starts the reload process for a player
func (gs *GameServer) PlayerReload(playerID string) bool {
	gs.weaponMu.RLock()
	ws := gs.weaponStates[playerID]
	gs.weaponMu.RUnlock()

	if ws == nil {
		return false
	}

	// Check if magazine is already full
	if ws.CurrentAmmo >= ws.Weapon.MagazineSize {
		return false
	}

	ws.StartReload()
	return ws.IsReloading
}

// checkReloads checks all players for completed reloads
func (gs *GameServer) checkReloads() {
	gs.weaponMu.RLock()
	defer gs.weaponMu.RUnlock()

	for playerID, ws := range gs.weaponStates {
		if ws.CheckReloadComplete() {
			// Reload just completed - notify via callback
			if gs.onReloadComplete != nil {
				gs.onReloadComplete(playerID)
			}
		}
	}
}

// GetActiveProjectiles returns snapshots of all active projectiles
func (gs *GameServer) GetActiveProjectiles() []ProjectileSnapshot {
	return gs.projectileManager.GetProjectileSnapshots()
}

// SetOnHit sets the callback for when a projectile hits a player
func (gs *GameServer) SetOnHit(callback func(hit HitEvent)) {
	gs.onHit = callback
}

// SetOnRespawn sets the callback for when a player respawns
func (gs *GameServer) SetOnRespawn(callback func(playerID string, position Vector2)) {
	gs.onRespawn = callback
}

// MarkPlayerDead marks a player as dead
func (gs *GameServer) MarkPlayerDead(playerID string) {
	player, exists := gs.world.GetPlayer(playerID)
	if exists {
		player.MarkDead()
	}
}

// DamagePlayer applies damage to a player (for testing purposes)
func (gs *GameServer) DamagePlayer(playerID string, damage int) {
	player, exists := gs.world.GetPlayer(playerID)
	if exists {
		player.TakeDamage(damage)
	}
}

// checkHitDetection checks for projectile-player collisions and processes hits
func (gs *GameServer) checkHitDetection() {
	// Get all active projectiles
	projectiles := gs.projectileManager.GetActiveProjectiles()
	if len(projectiles) == 0 {
		return
	}

	// Get all players
	gs.world.mu.RLock()
	players := make([]*PlayerState, 0, len(gs.world.players))
	for _, player := range gs.world.players {
		players = append(players, player)
	}
	gs.world.mu.RUnlock()

	if len(players) == 0 {
		return
	}

	// Check for collisions
	hits := gs.physics.CheckAllProjectileCollisions(projectiles, players)

	// Process each hit
	for _, hit := range hits {
		// Get the attacker's weapon to determine damage
		gs.weaponMu.RLock()
		weaponState := gs.weaponStates[hit.AttackerID]
		gs.weaponMu.RUnlock()

		if weaponState == nil {
			continue
		}

		damage := weaponState.Weapon.Damage

		// Apply damage to victim
		victim, exists := gs.world.GetPlayer(hit.VictimID)
		if !exists {
			continue
		}

		victim.TakeDamage(damage)

		// Deactivate the projectile
		gs.projectileManager.RemoveProjectile(hit.ProjectileID)

		// Notify via callback
		if gs.onHit != nil {
			gs.onHit(hit)
		}
	}
}

// checkRespawns checks all dead players and respawns them if ready
func (gs *GameServer) checkRespawns() {
	// Get all players
	gs.world.mu.RLock()
	players := make([]*PlayerState, 0, len(gs.world.players))
	for _, player := range gs.world.players {
		players = append(players, player)
	}
	gs.world.mu.RUnlock()

	// Check each player for respawn
	for _, player := range players {
		if player.IsDead() && player.CanRespawn() {
			// Get balanced spawn point
			spawnPos := gs.world.GetBalancedSpawnPoint(player.ID)

			// Respawn the player
			player.Respawn(spawnPos)

			// Reset weapon state to default pistol (AC: "respawn with default pistol")
			gs.mu.Lock()
			gs.weaponStates[player.ID] = NewWeaponState(NewPistol())
			gs.mu.Unlock()

			// Notify via callback
			if gs.onRespawn != nil {
				gs.onRespawn(player.ID, spawnPos)
			}
		}
	}
}

// updateInvulnerability updates invulnerability status for all players
func (gs *GameServer) updateInvulnerability() {
	// Get all players
	gs.world.mu.RLock()
	players := make([]*PlayerState, 0, len(gs.world.players))
	for _, player := range gs.world.players {
		players = append(players, player)
	}
	gs.world.mu.RUnlock()

	// Update each player's invulnerability
	for _, player := range players {
		player.UpdateInvulnerability()
	}
}

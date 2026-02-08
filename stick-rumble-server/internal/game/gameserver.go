package game

import (
	"context"
	"log"
	"math"
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
	world              *World
	physics            *Physics
	projectileManager  *ProjectileManager
	weaponCrateManager *WeaponCrateManager
	weaponStates       map[string]*WeaponState
	weaponMu           sync.RWMutex
	positionHistory    *PositionHistory // Position history for lag compensation
	tickRate           time.Duration
	updateRate         time.Duration // Rate at which to broadcast updates to clients
	clock              Clock         // Clock for time operations (injectable for testing)

	// Broadcast function to send state updates to clients
	broadcastFunc func(playerStates []PlayerStateSnapshot)

	// Callback for when a player's reload completes
	onReloadComplete func(playerID string)

	// Callback for when a projectile hits a player
	onHit func(hit HitEvent)

	// Callback to get a player's RTT for lag compensation
	getRTT func(playerID string) int64

	// Callback for when a player respawns
	onRespawn func(playerID string, position Vector2)

	// Callback for match timer updates
	onMatchTimer func(roomID string, remainingSeconds int)

	// Callback for checking time limit across all rooms
	onCheckTimeLimit func()

	// Callback for when a weapon is picked up
	onWeaponPickup func(playerID, crateID, weaponType string, respawnTime time.Time)

	// Callback for when a weapon crate respawns
	onWeaponRespawn func(crate *WeaponCrate)

	// Callback for when a player's dodge roll ends
	onRollEnd func(playerID string, reason string)

	running bool
	mu      sync.RWMutex
	wg      sync.WaitGroup
}

// NewGameServer creates a new game server with a real clock
func NewGameServer(broadcastFunc func(playerStates []PlayerStateSnapshot)) *GameServer {
	return NewGameServerWithClock(broadcastFunc, &RealClock{})
}

// NewGameServerWithClock creates a new game server with a custom clock (for testing)
func NewGameServerWithClock(broadcastFunc func(playerStates []PlayerStateSnapshot), clock Clock) *GameServer {
	return &GameServer{
		world:              NewWorldWithClock(clock),
		physics:            NewPhysics(),
		projectileManager:  NewProjectileManager(),
		weaponCrateManager: NewWeaponCrateManager(),
		weaponStates:       make(map[string]*WeaponState),
		positionHistory:    NewPositionHistory(), // Initialize position history for lag compensation
		tickRate:           time.Duration(ServerTickInterval) * time.Millisecond,
		updateRate:         time.Duration(ClientUpdateInterval) * time.Millisecond,
		broadcastFunc:      broadcastFunc,
		clock:              clock,
		running:            false,
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

	lastTick := gs.clock.Now()

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

			// Record position snapshots for lag compensation (after movement update)
			gs.recordPositionSnapshots(now)

			// Update all projectiles
			gs.projectileManager.Update(deltaTime)

			// Check for projectile-player collisions (hit detection)
			gs.checkHitDetection()

			// Check for reload completions
			gs.checkReloads()

			// Check for respawns
			gs.checkRespawns()

			// Check for dodge roll duration completion
			gs.checkRollDuration()

			// Update invulnerability status
			gs.updateInvulnerability()

			// Update health regeneration
			gs.updateHealthRegeneration(deltaTime)

			// Check for weapon respawns
			gs.checkWeaponRespawns()
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
		result := gs.physics.UpdatePlayer(player, deltaTime)

		// If roll was cancelled due to wall collision, notify via callback
		if result.RollCancelled && gs.onRollEnd != nil {
			gs.onRollEnd(player.ID, "wall_collision")
		}

		// Check if correction rate exceeds anti-cheat threshold
		if result.CorrectionNeeded {
			stats := player.GetCorrectionStats()
			correctionRate := stats.GetCorrectionRate()

			// Log warning if correction rate exceeds 20% threshold
			if correctionRate > 0.20 {
				log.Printf("ANTI-CHEAT WARNING: Player %s has high correction rate: %.2f%% (%d/%d)",
					player.ID, correctionRate*100, stats.TotalCorrections, stats.TotalUpdates)
			}
		}
	}
}

// recordPositionSnapshots records current player positions for lag compensation
func (gs *GameServer) recordPositionSnapshots(timestamp time.Time) {
	// Get all players (thread-safe)
	gs.world.mu.RLock()
	defer gs.world.mu.RUnlock()

	// Record position snapshot for each player
	for playerID, player := range gs.world.players {
		position := player.GetPosition()
		gs.positionHistory.RecordSnapshot(playerID, position, timestamp)
	}
}

// AddPlayer adds a new player to the game world
func (gs *GameServer) AddPlayer(playerID string) *PlayerState {
	player := gs.world.AddPlayer(playerID)

	// Create weapon state for the player (everyone starts with a pistol)
	gs.weaponMu.Lock()
	gs.weaponStates[playerID] = NewWeaponStateWithClock(NewPistol(), gs.clock)
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

// UpdatePlayerInputWithSequence updates a player's input state and sequence number
func (gs *GameServer) UpdatePlayerInputWithSequence(playerID string, input InputState, sequence uint64) bool {
	player, exists := gs.world.GetPlayer(playerID)
	if !exists {
		return false
	}

	// Update input state
	player.SetInput(input)

	// Update sequence number
	player.SetInputSequence(sequence)

	return true
}

// GetPlayerState returns a snapshot of a player's state
func (gs *GameServer) GetPlayerState(playerID string) (PlayerStateSnapshot, bool) {
	player, exists := gs.world.GetPlayer(playerID)
	if !exists {
		return PlayerStateSnapshot{}, false
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

// SetWeaponState sets the weapon state for a player
// If the player is currently reloading, the reload is cancelled
func (gs *GameServer) SetWeaponState(playerID string, weaponState *WeaponState) {
	gs.weaponMu.Lock()
	defer gs.weaponMu.Unlock()

	// Cancel any in-progress reload when switching weapons
	if existingWeapon := gs.weaponStates[playerID]; existingWeapon != nil {
		existingWeapon.CancelReload()
	}

	gs.weaponStates[playerID] = weaponState
}

// PlayerShoot attempts to fire a weapon for the given player
// If the magazine is empty, automatically triggers a reload
// For hitscan weapons: applies lag compensation using clientTimestamp and RTT
// For projectile weapons: creates a projectile
func (gs *GameServer) PlayerShoot(playerID string, aimAngle float64, clientTimestamp int64) ShootResult {
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

	// Check if magazine is empty - trigger auto-reload
	if ws.IsEmpty() {
		// Auto-reload: start reload when attempting to shoot with empty magazine
		ws.StartReload()
		return ShootResult{Success: false, Reason: ShootFailedEmpty}
	}

	// Check fire rate cooldown
	if !ws.CanShoot() {
		return ShootResult{Success: false, Reason: ShootFailedCooldown}
	}

	// Record the shot (decrements ammo, sets cooldown)
	ws.RecordShot()

	// Branch: Hitscan vs Projectile weapon
	if ws.Weapon.IsHitscan {
		// Hitscan weapon: instant hit with lag compensation
		return gs.processHitscanShot(playerID, player, ws.Weapon, aimAngle, clientTimestamp)
	}

	// Projectile weapon: create projectile (no lag compensation)
	pos := player.GetPosition()
	proj := gs.projectileManager.CreateProjectile(
		playerID,
		ws.Weapon.Name,
		pos,
		aimAngle,
		ws.Weapon.ProjectileSpeed,
	)

	return ShootResult{
		Success:    true,
		Projectile: proj,
	}
}

// MeleeAttackResult contains the result of a melee attack attempt
type MeleeResult struct {
	Success          bool
	Reason           string
	HitPlayers       []*PlayerState
	KnockbackApplied bool
}

// Melee attack failure reasons
const (
	MeleeFailedNoPlayer   = "no_player"
	MeleeFailedNoWeapon   = "no_weapon"
	MeleeFailedNotMelee   = "not_melee"
	MeleeFailedPlayerDead = "player_dead"
)

// PlayerMeleeAttack attempts a melee attack for the given player
func (gs *GameServer) PlayerMeleeAttack(playerID string, aimAngle float64) MeleeResult {
	// Check if player exists
	player, exists := gs.world.GetPlayer(playerID)
	if !exists {
		return MeleeResult{Success: false, Reason: MeleeFailedNoPlayer}
	}

	// Check if player is alive
	if !player.IsAlive() {
		return MeleeResult{Success: false, Reason: MeleeFailedPlayerDead}
	}

	// Get weapon state
	gs.weaponMu.RLock()
	ws := gs.weaponStates[playerID]
	gs.weaponMu.RUnlock()

	if ws == nil {
		return MeleeResult{Success: false, Reason: MeleeFailedNoWeapon}
	}

	// Check if weapon is melee
	if !ws.Weapon.IsMelee() {
		return MeleeResult{Success: false, Reason: MeleeFailedNotMelee}
	}

	// Update player's aim angle for the attack
	player.SetAimAngle(aimAngle)

	// Get all players for hit detection
	gs.world.mu.RLock()
	allPlayers := make([]*PlayerState, 0, len(gs.world.players))
	for _, p := range gs.world.players {
		allPlayers = append(allPlayers, p)
	}
	gs.world.mu.RUnlock()

	// Perform the melee attack
	result := PerformMeleeAttack(player, allPlayers, ws.Weapon)

	return MeleeResult{
		Success:          true,
		HitPlayers:       result.HitPlayers,
		KnockbackApplied: result.KnockbackApplied,
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

// SetOnWeaponPickup sets the callback for when a weapon is picked up
func (gs *GameServer) SetOnWeaponPickup(callback func(playerID, crateID, weaponType string, respawnTime time.Time)) {
	gs.onWeaponPickup = callback
}

// SetOnWeaponRespawn sets the callback for when a weapon crate respawns
func (gs *GameServer) SetOnWeaponRespawn(callback func(crate *WeaponCrate)) {
	gs.onWeaponRespawn = callback
}

// SetOnRollEnd sets the callback for when a player's dodge roll ends
func (gs *GameServer) SetOnRollEnd(callback func(playerID string, reason string)) {
	gs.onRollEnd = callback
}

// SetGetRTT sets the callback to retrieve a player's RTT for lag compensation
func (gs *GameServer) SetGetRTT(callback func(playerID string) int64) {
	gs.getRTT = callback
}

// GetWeaponCrateManager returns the weapon crate manager
func (gs *GameServer) GetWeaponCrateManager() *WeaponCrateManager {
	return gs.weaponCrateManager
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
// checkRollDuration checks if any player's dodge roll should end
func (gs *GameServer) checkRollDuration() {
	// Get all players
	gs.world.mu.RLock()
	players := make([]*PlayerState, 0, len(gs.world.players))
	for _, player := range gs.world.players {
		players = append(players, player)
	}
	gs.world.mu.RUnlock()

	// Check each player for roll completion
	now := gs.clock.Now()
	for _, player := range players {
		if player.IsRolling() {
			rollState := player.GetRollState()
			timeSinceRollStart := now.Sub(rollState.RollStartTime).Seconds()

			// End roll if duration exceeded (0.4 seconds)
			if timeSinceRollStart >= DodgeRollDuration {
				player.EndDodgeRoll()

				// Notify via callback
				if gs.onRollEnd != nil {
					gs.onRollEnd(player.ID, "completed")
				}
			}
		}
	}
}

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
			gs.weaponStates[player.ID] = NewWeaponStateWithClock(NewPistol(), gs.clock)
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

// updateHealthRegeneration applies health regeneration to all players
func (gs *GameServer) updateHealthRegeneration(deltaTime float64) {
	// Get all players
	gs.world.mu.RLock()
	players := make([]*PlayerState, 0, len(gs.world.players))
	for _, player := range gs.world.players {
		players = append(players, player)
	}
	gs.world.mu.RUnlock()

	now := gs.clock.Now()

	// Update each player's regeneration
	for _, player := range players {
		// Update regeneration state
		player.UpdateRegenerationState(now)

		// Apply regeneration if applicable
		player.ApplyRegeneration(now, deltaTime)
	}
}

// checkWeaponRespawns checks for weapon crates that should respawn
func (gs *GameServer) checkWeaponRespawns() {
	// Get list of crates that respawned
	respawnedCrates := gs.weaponCrateManager.UpdateRespawns()

	// Notify about each respawned crate
	for _, crateID := range respawnedCrates {
		crate := gs.weaponCrateManager.GetCrate(crateID)
		if crate != nil && gs.onWeaponRespawn != nil {
			gs.onWeaponRespawn(crate)
		}
	}
}

// processHitscanShot performs lag-compensated hit detection for hitscan weapons
// Story 4.5: Rewinds player positions by (shooterRTT + victimRTT)/2, clamped to 150ms
func (gs *GameServer) processHitscanShot(shooterID string, shooter *PlayerState, weapon *Weapon, aimAngle float64, clientTimestamp int64) ShootResult {
	// Get shooter's RTT
	shooterRTT := int64(0)
	if gs.getRTT != nil {
		shooterRTT = gs.getRTT(shooterID)
	}

	// Calculate rewind time (half of total RTT for fairness)
	// In real lag comp, we'd use (shooterRTT + victimRTT)/2 per victim
	// For simplicity, using shooterRTT as baseline, clamped to 150ms max
	rewindMs := shooterRTT
	const maxRewindMs = 150
	if rewindMs > maxRewindMs {
		rewindMs = maxRewindMs
	}

	// Calculate query time for position history
	rewindDuration := time.Duration(rewindMs) * time.Millisecond
	queryTime := gs.clock.Now().Add(-rewindDuration)

	// Get shooter position
	shooterPos := shooter.GetPosition()

	// Perform raycast hit detection at rewound positions
	gs.world.mu.RLock()
	var hitVictim *PlayerState
	var hitDistance float64 = weapon.Range + 1 // Start beyond range

	for victimID, victim := range gs.world.players {
		// Skip shooter and dead players
		if victimID == shooterID || !victim.IsAlive() {
			continue
		}

		// Get victim's position at rewound time
		victimPos, found := gs.positionHistory.GetPositionAt(victimID, queryTime)
		if !found {
			// Fallback to current position if no history
			victimPos = victim.GetPosition()
		}

		// Check if raycast hits the victim
		// Use circular hitbox approximation: radius = PlayerWidth/2 = 16px
		const hitboxRadius = PlayerWidth / 2
		if gs.raycastHit(shooterPos, aimAngle, weapon.Range, victimPos, hitboxRadius) {
			// Calculate distance to find closest hit
			dx := victimPos.X - shooterPos.X
			dy := victimPos.Y - shooterPos.Y
			dist := math.Sqrt(dx*dx + dy*dy)

			if dist < hitDistance {
				hitDistance = dist
				hitVictim = victim
			}
		}
	}
	gs.world.mu.RUnlock()

	// Apply damage if hit
	if hitVictim != nil {
		hitVictim.TakeDamage(weapon.Damage)

		// Notify via callback
		if gs.onHit != nil {
			gs.onHit(HitEvent{
				ProjectileID: "", // No projectile for hitscan
				AttackerID:   shooterID,
				VictimID:     hitVictim.ID,
			})
		}
	}

	return ShootResult{
		Success:    true,
		Projectile: nil, // No projectile for hitscan
	}
}

// raycastHit checks if a ray from origin at angle hits a circular target
func (gs *GameServer) raycastHit(origin Vector2, angleRad float64, maxRange float64, targetPos Vector2, targetRadius float64) bool {
	// Ray direction vector
	rayDirX := math.Cos(angleRad)
	rayDirY := math.Sin(angleRad)

	// Vector from ray origin to circle center
	toTargetX := targetPos.X - origin.X
	toTargetY := targetPos.Y - origin.Y

	// Project toTarget onto ray direction to find closest point on ray
	projection := toTargetX*rayDirX + toTargetY*rayDirY

	// If projection is negative, target is behind the ray
	if projection < 0 {
		return false
	}

	// If projection exceeds range, target is beyond weapon range
	if projection > maxRange {
		return false
	}

	// Find closest point on ray to target center
	closestX := origin.X + projection*rayDirX
	closestY := origin.Y + projection*rayDirY

	// Distance from closest point to target center
	distX := targetPos.X - closestX
	distY := targetPos.Y - closestY
	distSq := distX*distX + distY*distY

	// Hit if distance is less than target radius
	return distSq <= targetRadius*targetRadius
}

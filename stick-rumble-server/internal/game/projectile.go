package game

import (
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Projectile represents a bullet/projectile in the game world
type Projectile struct {
	ID            string    `json:"id"`
	OwnerID       string    `json:"ownerId"`
	WeaponType    string    `json:"weaponType"`
	Position      Vector2   `json:"position"`
	Velocity      Vector2   `json:"velocity"`
	SpawnPosition Vector2   `json:"-"` // Initial position for range validation
	CreatedAt     time.Time `json:"-"`
	Active        bool      `json:"-"`
}

// ProjectileSnapshot is the network-transmittable version of Projectile
type ProjectileSnapshot struct {
	ID         string  `json:"id"`
	OwnerID    string  `json:"ownerId"`
	WeaponType string  `json:"weaponType"`
	Position   Vector2 `json:"position"`
	Velocity   Vector2 `json:"velocity"`
}

// NewProjectile creates a new projectile with calculated velocity from angle
func NewProjectile(ownerID string, weaponType string, startPos Vector2, aimAngle float64, speed float64) *Projectile {
	return &Projectile{
		ID:            uuid.New().String(),
		OwnerID:       ownerID,
		WeaponType:    weaponType,
		Position:      startPos,
		SpawnPosition: startPos, // Store spawn position for range validation
		Velocity: Vector2{
			X: math.Cos(aimAngle) * speed,
			Y: math.Sin(aimAngle) * speed,
		},
		CreatedAt: time.Now(),
		Active:    true,
	}
}

// Update moves the projectile based on velocity and delta time
func (p *Projectile) Update(deltaTime float64) {
	p.Position.X += p.Velocity.X * deltaTime
	p.Position.Y += p.Velocity.Y * deltaTime
}

// IsExpired returns true if the projectile has exceeded its max lifetime
func (p *Projectile) IsExpired() bool {
	return time.Since(p.CreatedAt) >= ProjectileMaxLifetime
}

// IsOutOfBounds returns true if the projectile is outside the arena
func (p *Projectile) IsOutOfBounds(mapConfigs ...MapConfig) bool {
	mapConfig := resolveMapConfig(mapConfigs...)
	return p.Position.X < 0 || p.Position.X > mapConfig.Width ||
		p.Position.Y < 0 || p.Position.Y > mapConfig.Height
}

// Deactivate marks the projectile as inactive (for removal)
func (p *Projectile) Deactivate() {
	p.Active = false
}

// Snapshot returns a copy of the projectile state for network transmission
func (p *Projectile) Snapshot() ProjectileSnapshot {
	return ProjectileSnapshot{
		ID:         p.ID,
		OwnerID:    p.OwnerID,
		WeaponType: p.WeaponType,
		Position:   p.Position,
		Velocity:   p.Velocity,
	}
}

// ProjectileManager manages all active projectiles in the game
type ProjectileManager struct {
	mapConfig   MapConfig
	projectiles map[string]*Projectile
	mu          sync.RWMutex
}

// NewProjectileManager creates a new projectile manager
func NewProjectileManager(mapConfigs ...MapConfig) *ProjectileManager {
	return &ProjectileManager{
		mapConfig:   resolveMapConfig(mapConfigs...),
		projectiles: make(map[string]*Projectile),
	}
}

// CreateProjectile creates and adds a new projectile
func (pm *ProjectileManager) CreateProjectile(ownerID string, weaponType string, startPos Vector2, aimAngle float64, speed float64) *Projectile {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	proj := NewProjectile(ownerID, weaponType, startPos, aimAngle, speed)
	pm.projectiles[proj.ID] = proj
	return proj
}

// Update updates all projectiles and removes inactive ones
func (pm *ProjectileManager) Update(deltaTime float64) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Collect IDs to remove
	toRemove := make([]string, 0)

	for id, proj := range pm.projectiles {
		// Check if projectile should be removed
		if !proj.Active || proj.IsExpired() || proj.IsOutOfBounds(pm.mapConfig) {
			toRemove = append(toRemove, id)
			continue
		}

		// Update position
		previousPosition := proj.Position
		proj.Update(deltaTime)

		// Check bounds after update
		if proj.IsOutOfBounds(pm.mapConfig) || pm.intersectsProjectileObstacle(previousPosition, proj.Position) {
			toRemove = append(toRemove, id)
		}
	}

	// Remove inactive projectiles
	for _, id := range toRemove {
		delete(pm.projectiles, id)
	}
}

// GetActiveProjectiles returns a slice of all active projectiles
func (pm *ProjectileManager) GetActiveProjectiles() []*Projectile {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]*Projectile, 0, len(pm.projectiles))
	for _, proj := range pm.projectiles {
		if proj.Active {
			result = append(result, proj)
		}
	}
	return result
}

func (pm *ProjectileManager) intersectsProjectileObstacle(start, end Vector2) bool {
	for _, obstacle := range projectileBlockingObstacles(pm.mapConfig) {
		if lineIntersectsRect(start, end, rectFromObstacle(obstacle)) {
			return true
		}
	}
	return false
}

func lineIntersectsRect(start, end Vector2, area rect) bool {
	if pointInsideRect(start.X, start.Y, area) || pointInsideRect(end.X, end.Y, area) {
		return true
	}

	dx := end.X - start.X
	dy := end.Y - start.Y

	tMin := 0.0
	tMax := 1.0

	clips := [][2]float64{
		{-dx, start.X - area.x},
		{dx, area.x + area.width - start.X},
		{-dy, start.Y - area.y},
		{dy, area.y + area.height - start.Y},
	}

	for _, clip := range clips {
		p := clip[0]
		q := clip[1]
		if p == 0 {
			if q < 0 {
				return false
			}
			continue
		}

		t := q / p
		if p < 0 {
			if t > tMax {
				return false
			}
			if t > tMin {
				tMin = t
			}
		} else {
			if t < tMin {
				return false
			}
			if t < tMax {
				tMax = t
			}
		}
	}

	return true
}

// GetProjectileByID returns a projectile by its ID, or nil if not found
func (pm *ProjectileManager) GetProjectileByID(id string) *Projectile {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return pm.projectiles[id]
}

// RemoveProjectile removes a projectile by its ID
func (pm *ProjectileManager) RemoveProjectile(id string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	delete(pm.projectiles, id)
}

// GetProjectilesByOwner returns all projectiles owned by a specific player
func (pm *ProjectileManager) GetProjectilesByOwner(ownerID string) []*Projectile {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]*Projectile, 0)
	for _, proj := range pm.projectiles {
		if proj.OwnerID == ownerID && proj.Active {
			result = append(result, proj)
		}
	}
	return result
}

// GetProjectileSnapshots returns snapshots of all active projectiles for network transmission
func (pm *ProjectileManager) GetProjectileSnapshots() []ProjectileSnapshot {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]ProjectileSnapshot, 0, len(pm.projectiles))
	for _, proj := range pm.projectiles {
		if proj.Active {
			result = append(result, proj.Snapshot())
		}
	}
	return result
}

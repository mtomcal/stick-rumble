package game

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

const DefaultMapID = "default_office"

type MapObstacle struct {
	ID                string  `json:"id"`
	Type              string  `json:"type"`
	Shape             string  `json:"shape"`
	X                 float64 `json:"x"`
	Y                 float64 `json:"y"`
	Width             float64 `json:"width"`
	Height            float64 `json:"height"`
	BlocksMovement    bool    `json:"blocksMovement"`
	BlocksProjectiles bool    `json:"blocksProjectiles"`
	BlocksLineOfSight bool    `json:"blocksLineOfSight"`
}

type MapSpawnPoint struct {
	ID string  `json:"id"`
	X  float64 `json:"x"`
	Y  float64 `json:"y"`
}

type MapWeaponSpawn struct {
	ID         string  `json:"id"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	WeaponType string  `json:"weaponType"`
}

type MapVector2 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type MapVisualAcceptanceViewpoint struct {
	ID              string     `json:"id"`
	PlayerPosition  MapVector2 `json:"playerPosition"`
	AimDirection    MapVector2 `json:"aimDirection"`
	ExpectedOutcome string     `json:"expectedOutcome"`
}

type MapConfig struct {
	ID                         string                         `json:"id"`
	Name                       string                         `json:"name"`
	Width                      float64                        `json:"width"`
	Height                     float64                        `json:"height"`
	Obstacles                  []MapObstacle                  `json:"obstacles"`
	SpawnPoints                []MapSpawnPoint                `json:"spawnPoints"`
	WeaponSpawns               []MapWeaponSpawn               `json:"weaponSpawns"`
	VisualAcceptanceViewpoints []MapVisualAcceptanceViewpoint `json:"visualAcceptanceViewpoints"`
}

type MapRegistry struct {
	maps map[string]MapConfig
}

func (r *MapRegistry) Get(id string) (MapConfig, bool) {
	mapConfig, ok := r.maps[id]
	return mapConfig, ok
}

func (r *MapRegistry) MustGet(id string) MapConfig {
	mapConfig, ok := r.Get(id)
	if !ok {
		panic(fmt.Sprintf("map %q not found in registry", id))
	}
	return mapConfig
}

func (r *MapRegistry) IDs() []string {
	ids := make([]string, 0, len(r.maps))
	for id := range r.maps {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

var (
	defaultMapRegistry     *MapRegistry
	defaultMapRegistryErr  error
	defaultMapRegistryOnce sync.Once
)

func GetDefaultMapRegistry() (*MapRegistry, error) {
	defaultMapRegistryOnce.Do(func() {
		defaultMapRegistry, defaultMapRegistryErr = loadDefaultMapRegistry()
	})

	return defaultMapRegistry, defaultMapRegistryErr
}

func MustDefaultMapRegistry() *MapRegistry {
	registry, err := GetDefaultMapRegistry()
	if err != nil {
		panic(err)
	}
	return registry
}

func MustDefaultMapConfig() MapConfig {
	return MustDefaultMapRegistry().MustGet(DefaultMapID)
}

func resetDefaultMapRegistryForTests() {
	defaultMapRegistry = nil
	defaultMapRegistryErr = nil
	defaultMapRegistryOnce = sync.Once{}
}

func loadDefaultMapRegistry() (*MapRegistry, error) {
	paths := []string{
		"../maps",
		"../../maps",
		"../../../maps",
	}

	var lastErr error
	for _, path := range paths {
		registry, err := LoadMapRegistryFromDir(path)
		if err == nil {
			return registry, nil
		}
		lastErr = err
	}

	return nil, fmt.Errorf("failed to load maps from default paths: %w", lastErr)
}

func LoadMapRegistryFromDir(dir string) (*MapRegistry, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read map directory %q: %w", dir, err)
	}

	registry := &MapRegistry{maps: make(map[string]MapConfig)}
	foundJSON := false

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		foundJSON = true

		fullPath := filepath.Join(dir, entry.Name())
		mapConfig, err := loadMapConfigFromFile(fullPath)
		if err != nil {
			return nil, err
		}

		if _, exists := registry.maps[mapConfig.ID]; exists {
			return nil, fmt.Errorf("duplicate map id %q", mapConfig.ID)
		}

		registry.maps[mapConfig.ID] = mapConfig
	}

	if !foundJSON {
		return nil, fmt.Errorf("no map json files found in %q", dir)
	}

	if _, ok := registry.maps[DefaultMapID]; !ok {
		return nil, fmt.Errorf("required map %q is missing", DefaultMapID)
	}

	return registry, nil
}

func loadMapConfigFromFile(path string) (MapConfig, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return MapConfig{}, fmt.Errorf("read map file %q: %w", path, err)
	}

	var mapConfig MapConfig
	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&mapConfig); err != nil {
		return MapConfig{}, fmt.Errorf("decode map file %q: %w", path, err)
	}

	if errors := ValidateMapConfig(mapConfig); len(errors) > 0 {
		return MapConfig{}, fmt.Errorf("invalid map %q: %s", path, strings.Join(errors, "; "))
	}

	return mapConfig, nil
}

func ValidateMapConfig(mapConfig MapConfig) []string {
	errors := make([]string, 0)

	if strings.TrimSpace(mapConfig.ID) == "" {
		errors = append(errors, "map id is required")
	}
	if strings.TrimSpace(mapConfig.Name) == "" {
		errors = append(errors, "map name is required")
	}
	if mapConfig.Width <= 0 {
		errors = append(errors, "map width must be positive")
	}
	if mapConfig.Height <= 0 {
		errors = append(errors, "map height must be positive")
	}
	if len(mapConfig.SpawnPoints) == 0 {
		errors = append(errors, "map must declare at least one spawn point")
	}
	if len(mapConfig.VisualAcceptanceViewpoints) == 0 {
		errors = append(errors, "map must declare at least one visual acceptance viewpoint")
	}

	errors = append(errors, collectDuplicateIDs(mapConfig.Obstacles, "obstacle")...)
	errors = append(errors, collectDuplicateIDs(mapConfig.SpawnPoints, "spawn point")...)
	errors = append(errors, collectDuplicateIDs(mapConfig.WeaponSpawns, "weapon spawn")...)
	errors = append(errors, collectDuplicateIDs(mapConfig.VisualAcceptanceViewpoints, "visual acceptance viewpoint")...)

	for _, obstacle := range mapConfig.Obstacles {
		if strings.TrimSpace(obstacle.ID) == "" {
			errors = append(errors, "obstacle id is required")
		}
		if obstacle.Type != "wall" && obstacle.Type != "desk" && obstacle.Type != "pillar" {
			errors = append(errors, fmt.Sprintf("obstacle %q has invalid type %q", obstacle.ID, obstacle.Type))
		}
		if obstacle.Shape != "rectangle" {
			errors = append(errors, fmt.Sprintf("obstacle %q must use rectangle shape", obstacle.ID))
		}
		if obstacle.Width <= 0 || obstacle.Height <= 0 {
			errors = append(errors, fmt.Sprintf("obstacle %q must have positive width and height", obstacle.ID))
		}
		if obstacle.X < 0 || obstacle.Y < 0 ||
			obstacle.X+obstacle.Width > mapConfig.Width ||
			obstacle.Y+obstacle.Height > mapConfig.Height {
			errors = append(errors, fmt.Sprintf("obstacle %q lies outside map bounds", obstacle.ID))
		}
	}

	for i := 0; i < len(mapConfig.Obstacles); i++ {
		for j := i + 1; j < len(mapConfig.Obstacles); j++ {
			if positiveAreaOverlap(rectFromObstacle(mapConfig.Obstacles[i]), rectFromObstacle(mapConfig.Obstacles[j])) {
				errors = append(
					errors,
					fmt.Sprintf("obstacles %q and %q overlap with positive area", mapConfig.Obstacles[i].ID, mapConfig.Obstacles[j].ID),
				)
			}
		}
	}

	blockingObstacles := movementBlockingObstacles(mapConfig)

	for _, spawnPoint := range mapConfig.SpawnPoints {
		if strings.TrimSpace(spawnPoint.ID) == "" {
			errors = append(errors, "spawn point id is required")
		}
		if !pointWithinBounds(spawnPoint.X, spawnPoint.Y, mapConfig) {
			errors = append(errors, fmt.Sprintf("spawn point %q lies outside map bounds", spawnPoint.ID))
			continue
		}
		for _, obstacle := range blockingObstacles {
			if pointInsideRect(spawnPoint.X, spawnPoint.Y, rectFromObstacle(obstacle)) {
				errors = append(errors, fmt.Sprintf("spawn point %q overlaps blocking obstacle %q", spawnPoint.ID, obstacle.ID))
			}
		}
	}

	for _, weaponSpawn := range mapConfig.WeaponSpawns {
		if strings.TrimSpace(weaponSpawn.ID) == "" {
			errors = append(errors, "weapon spawn id is required")
		}
		if !isSupportedMapWeaponType(weaponSpawn.WeaponType) {
			errors = append(errors, fmt.Sprintf("weapon spawn %q has invalid weapon type %q", weaponSpawn.ID, weaponSpawn.WeaponType))
		}
		if !pointWithinBounds(weaponSpawn.X, weaponSpawn.Y, mapConfig) {
			errors = append(errors, fmt.Sprintf("weapon spawn %q lies outside map bounds", weaponSpawn.ID))
			continue
		}
		for _, obstacle := range blockingObstacles {
			if pointInsideRect(weaponSpawn.X, weaponSpawn.Y, rectFromObstacle(obstacle)) {
				errors = append(errors, fmt.Sprintf("weapon spawn %q overlaps blocking obstacle %q", weaponSpawn.ID, obstacle.ID))
			}
		}
	}

	outcomes := map[string]int{}
	for _, viewpoint := range mapConfig.VisualAcceptanceViewpoints {
		if strings.TrimSpace(viewpoint.ID) == "" {
			errors = append(errors, "visual acceptance viewpoint id is required")
		}
		if !pointWithinBounds(viewpoint.PlayerPosition.X, viewpoint.PlayerPosition.Y, mapConfig) {
			errors = append(errors, fmt.Sprintf("visual acceptance viewpoint %q has out-of-bounds playerPosition", viewpoint.ID))
		}
		if viewpoint.AimDirection.X*viewpoint.AimDirection.X+viewpoint.AimDirection.Y*viewpoint.AimDirection.Y < 0.000001 {
			errors = append(errors, fmt.Sprintf("visual acceptance viewpoint %q has zero aimDirection", viewpoint.ID))
		}
		if !isSupportedViewpointOutcome(viewpoint.ExpectedOutcome) {
			errors = append(errors, fmt.Sprintf("visual acceptance viewpoint %q has invalid expectedOutcome %q", viewpoint.ID, viewpoint.ExpectedOutcome))
			continue
		}
		outcomes[viewpoint.ExpectedOutcome]++
	}

	requiredOutcomes := []string{
		"reads_blocked",
		"reads_open",
		"pickup_clearly_visible",
		"hud_unobscured",
	}
	for _, outcome := range requiredOutcomes {
		if outcomes[outcome] == 0 {
			errors = append(errors, fmt.Sprintf("visual acceptance viewpoints must include expectedOutcome %q", outcome))
		}
	}

	return errors
}

type identified interface {
	GetID() string
}

func collectDuplicateIDs[T identified](items []T, kind string) []string {
	seen := make(map[string]struct{}, len(items))
	errors := make([]string, 0)

	for _, item := range items {
		id := item.GetID()
		if _, exists := seen[id]; exists {
			errors = append(errors, fmt.Sprintf("%s id %q is duplicated", kind, id))
			continue
		}
		seen[id] = struct{}{}
	}

	return errors
}

func (o MapObstacle) GetID() string {
	return o.ID
}

func (s MapSpawnPoint) GetID() string {
	return s.ID
}

func (s MapWeaponSpawn) GetID() string {
	return s.ID
}

func (v MapVisualAcceptanceViewpoint) GetID() string {
	return v.ID
}

type rect struct {
	x      float64
	y      float64
	width  float64
	height float64
}

func rectFromObstacle(obstacle MapObstacle) rect {
	return rect{x: obstacle.X, y: obstacle.Y, width: obstacle.Width, height: obstacle.Height}
}

func positiveAreaOverlap(a, b rect) bool {
	overlapWidth := minFloat(a.x+a.width, b.x+b.width) - maxFloat(a.x, b.x)
	overlapHeight := minFloat(a.y+a.height, b.y+b.height) - maxFloat(a.y, b.y)
	return overlapWidth > 0 && overlapHeight > 0
}

func pointInsideRect(x, y float64, area rect) bool {
	return x >= area.x && x <= area.x+area.width && y >= area.y && y <= area.y+area.height
}

func pointWithinBounds(x, y float64, mapConfig MapConfig) bool {
	return x >= 0 && x <= mapConfig.Width && y >= 0 && y <= mapConfig.Height
}

func movementBlockingObstacles(mapConfig MapConfig) []MapObstacle {
	obstacles := make([]MapObstacle, 0, len(mapConfig.Obstacles))
	for _, obstacle := range mapConfig.Obstacles {
		if obstacle.BlocksMovement {
			obstacles = append(obstacles, obstacle)
		}
	}
	return obstacles
}

func projectileBlockingObstacles(mapConfig MapConfig) []MapObstacle {
	obstacles := make([]MapObstacle, 0, len(mapConfig.Obstacles))
	for _, obstacle := range mapConfig.Obstacles {
		if obstacle.BlocksProjectiles {
			obstacles = append(obstacles, obstacle)
		}
	}
	return obstacles
}

func isSupportedMapWeaponType(weaponType string) bool {
	switch weaponType {
	case "uzi", "ak47", "shotgun", "katana", "bat":
		return true
	default:
		return false
	}
}

func isSupportedViewpointOutcome(outcome string) bool {
	switch outcome {
	case "reads_blocked", "reads_open", "pickup_clearly_visible", "hud_unobscured":
		return true
	default:
		return false
	}
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

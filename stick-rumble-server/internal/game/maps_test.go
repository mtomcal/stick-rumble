package game

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadMapRegistryFromDir_LoadsDefaultOffice(t *testing.T) {
	registry, err := LoadMapRegistryFromDir("../../../maps")
	if err != nil {
		t.Fatalf("LoadMapRegistryFromDir returned error: %v", err)
	}

	mapConfig, ok := registry.Get(DefaultMapID)
	if !ok {
		t.Fatalf("expected %q to exist in registry", DefaultMapID)
	}

	if mapConfig.Width != 1920 || mapConfig.Height != 1080 {
		t.Fatalf("unexpected default map dimensions: %+v", mapConfig)
	}
}

func TestDefaultOffice_CentralVerticalWallTouchesTopBoundary(t *testing.T) {
	registry, err := LoadMapRegistryFromDir("../../../maps")
	if err != nil {
		t.Fatalf("LoadMapRegistryFromDir returned error: %v", err)
	}

	mapConfig, ok := registry.Get(DefaultMapID)
	if !ok {
		t.Fatalf("expected %q to exist in registry", DefaultMapID)
	}

	topBoundary := findObstacleByID(t, mapConfig, "wall_top_boundary")
	centralWall := findObstacleByID(t, mapConfig, "wall_left_vertical")

	expectedTop := topBoundary.Y + topBoundary.Height
	if centralWall.Y != expectedTop {
		t.Fatalf(
			"expected obstacle %q to start at y=%v so it closes against %q, got y=%v",
			centralWall.ID,
			expectedTop,
			topBoundary.ID,
			centralWall.Y,
		)
	}
}

func TestDefaultOffice_BoundaryWallsSealOuterCorners(t *testing.T) {
	registry, err := LoadMapRegistryFromDir("../../../maps")
	if err != nil {
		t.Fatalf("LoadMapRegistryFromDir returned error: %v", err)
	}

	mapConfig, ok := registry.Get(DefaultMapID)
	if !ok {
		t.Fatalf("expected %q to exist in registry", DefaultMapID)
	}

	topBoundary := findObstacleByID(t, mapConfig, "wall_top_boundary")
	bottomBoundary := findObstacleByID(t, mapConfig, "wall_bottom_boundary")
	leftBoundary := findObstacleByID(t, mapConfig, "wall_left_boundary")
	rightBoundary := findObstacleByID(t, mapConfig, "wall_right_boundary")

	if topBoundary.X != 0 || topBoundary.Width != mapConfig.Width {
		t.Fatalf(
			"expected %q to span the full map width at the top edge, got x=%v width=%v mapWidth=%v",
			topBoundary.ID,
			topBoundary.X,
			topBoundary.Width,
			mapConfig.Width,
		)
	}

	if bottomBoundary.X != 0 || bottomBoundary.Width != mapConfig.Width {
		t.Fatalf(
			"expected %q to span the full map width at the bottom edge, got x=%v width=%v mapWidth=%v",
			bottomBoundary.ID,
			bottomBoundary.X,
			bottomBoundary.Width,
			mapConfig.Width,
		)
	}

	expectedSideWallTop := topBoundary.Y + topBoundary.Height
	if leftBoundary.Y != expectedSideWallTop || rightBoundary.Y != expectedSideWallTop {
		t.Fatalf(
			"expected side boundaries to start at y=%v directly below the top boundary, got left=%v right=%v",
			expectedSideWallTop,
			leftBoundary.Y,
			rightBoundary.Y,
		)
	}

	expectedSideWallBottom := bottomBoundary.Y
	if leftBoundary.Y+leftBoundary.Height != expectedSideWallBottom || rightBoundary.Y+rightBoundary.Height != expectedSideWallBottom {
		t.Fatalf(
			"expected side boundaries to end at y=%v directly above the bottom boundary, got left=%v right=%v",
			expectedSideWallBottom,
			leftBoundary.Y+leftBoundary.Height,
			rightBoundary.Y+rightBoundary.Height,
		)
	}
}

func TestLoadMapRegistryFromDir_FailsWhenRequiredMapMissing(t *testing.T) {
	dir := t.TempDir()
	writeMapFixture(t, dir, "side_map.json", `{
  "id": "side_map",
  "name": "Side Map",
  "width": 800,
  "height": 600,
  "obstacles": [],
  "spawnPoints": [{"id": "spawn_a", "x": 100, "y": 100}],
  "weaponSpawns": [],
  "visualAcceptanceViewpoints": [
    {"id": "vp_blocked", "playerPosition": {"x": 100, "y": 100}, "aimDirection": {"x": 1, "y": 0}, "expectedOutcome": "reads_blocked"},
    {"id": "vp_open", "playerPosition": {"x": 120, "y": 120}, "aimDirection": {"x": 0, "y": 1}, "expectedOutcome": "reads_open"},
    {"id": "vp_pickup", "playerPosition": {"x": 140, "y": 140}, "aimDirection": {"x": -1, "y": 0}, "expectedOutcome": "pickup_clearly_visible"},
    {"id": "vp_hud", "playerPosition": {"x": 160, "y": 160}, "aimDirection": {"x": 0, "y": -1}, "expectedOutcome": "hud_unobscured"}
  ]
}`)

	_, err := LoadMapRegistryFromDir(dir)
	if err == nil || !containsString(err.Error(), `required map "default_office" is missing`) {
		t.Fatalf("expected missing default map error, got %v", err)
	}
}

func TestLoadMapRegistryFromDir_FailsWhenMapInvalid(t *testing.T) {
	dir := t.TempDir()
	writeMapFixture(t, dir, "default_office.json", `{
  "id": "default_office",
  "name": "Broken Default Office",
  "width": 800,
  "height": 600,
  "obstacles": [
    {
      "id": "wall_a",
      "type": "wall",
      "shape": "rectangle",
      "x": 100,
      "y": 100,
      "width": 100,
      "height": 100,
      "blocksMovement": true,
      "blocksProjectiles": true,
      "blocksLineOfSight": true
    }
  ],
  "spawnPoints": [{"id": "spawn_inside", "x": 120, "y": 120}],
  "weaponSpawns": [],
  "visualAcceptanceViewpoints": [
    {"id": "vp_blocked", "playerPosition": {"x": 100, "y": 100}, "aimDirection": {"x": 1, "y": 0}, "expectedOutcome": "reads_blocked"},
    {"id": "vp_open", "playerPosition": {"x": 120, "y": 120}, "aimDirection": {"x": 0, "y": 1}, "expectedOutcome": "reads_open"},
    {"id": "vp_pickup", "playerPosition": {"x": 140, "y": 140}, "aimDirection": {"x": -1, "y": 0}, "expectedOutcome": "pickup_clearly_visible"},
    {"id": "vp_hud", "playerPosition": {"x": 160, "y": 160}, "aimDirection": {"x": 0, "y": -1}, "expectedOutcome": "hud_unobscured"}
  ]
}`)

	_, err := LoadMapRegistryFromDir(dir)
	if err == nil || !containsString(err.Error(), `spawn point "spawn_inside" overlaps blocking obstacle "wall_a"`) {
		t.Fatalf("expected invalid map error, got %v", err)
	}
}

func TestValidateMapConfig_DetectsOutOfBoundsGeometry(t *testing.T) {
	mapConfig := MapConfig{
		ID:     "broken",
		Name:   "Broken",
		Width:  400,
		Height: 300,
		Obstacles: []MapObstacle{
			{
				ID:                "wall_oob",
				Type:              "wall",
				Shape:             "rectangle",
				X:                 350,
				Y:                 10,
				Width:             100,
				Height:            50,
				BlocksMovement:    true,
				BlocksProjectiles: true,
				BlocksLineOfSight: true,
			},
		},
		SpawnPoints: []MapSpawnPoint{
			{ID: "spawn_oob", X: 410, Y: 200},
		},
		WeaponSpawns: []MapWeaponSpawn{
			{ID: "weapon_oob", X: 200, Y: 320, WeaponType: "uzi"},
		},
		VisualAcceptanceViewpoints: []MapVisualAcceptanceViewpoint{
			{ID: "vp_blocked", PlayerPosition: MapVector2{X: 100, Y: 100}, AimDirection: MapVector2{X: 1, Y: 0}, ExpectedOutcome: "reads_blocked"},
			{ID: "vp_open", PlayerPosition: MapVector2{X: 120, Y: 120}, AimDirection: MapVector2{X: 0, Y: 1}, ExpectedOutcome: "reads_open"},
			{ID: "vp_pickup", PlayerPosition: MapVector2{X: 140, Y: 140}, AimDirection: MapVector2{X: -1, Y: 0}, ExpectedOutcome: "pickup_clearly_visible"},
			{ID: "vp_hud", PlayerPosition: MapVector2{X: 160, Y: 160}, AimDirection: MapVector2{X: 0, Y: -1}, ExpectedOutcome: "hud_unobscured"},
		},
	}

	errors := ValidateMapConfig(mapConfig)
	expected := []string{
		`obstacle "wall_oob" lies outside map bounds`,
		`spawn point "spawn_oob" lies outside map bounds`,
		`weapon spawn "weapon_oob" lies outside map bounds`,
	}

	for _, want := range expected {
		if !containsAny(errors, want) {
			t.Fatalf("expected %q in errors: %v", want, errors)
		}
	}
}

func TestValidateMapConfig_DetectsInvalidVisualAcceptanceViewpoints(t *testing.T) {
	mapConfig := MapConfig{
		ID:     "broken_viewpoints",
		Name:   "Broken Viewpoints",
		Width:  400,
		Height: 300,
		SpawnPoints: []MapSpawnPoint{
			{ID: "spawn_ok", X: 100, Y: 100},
		},
		WeaponSpawns: []MapWeaponSpawn{
			{ID: "weapon_ok", X: 200, Y: 200, WeaponType: "uzi"},
		},
		VisualAcceptanceViewpoints: []MapVisualAcceptanceViewpoint{
			{ID: "vp1", PlayerPosition: MapVector2{X: 10, Y: 10}, AimDirection: MapVector2{X: 1, Y: 0}, ExpectedOutcome: "reads_blocked"},
			{ID: "vp2", PlayerPosition: MapVector2{X: 500, Y: 10}, AimDirection: MapVector2{X: 0, Y: 1}, ExpectedOutcome: "reads_open"},
			{ID: "vp3", PlayerPosition: MapVector2{X: 20, Y: 20}, AimDirection: MapVector2{X: 0, Y: 0}, ExpectedOutcome: "pickup_clearly_visible"},
			{ID: "vp4", PlayerPosition: MapVector2{X: 30, Y: 30}, AimDirection: MapVector2{X: -1, Y: 0}, ExpectedOutcome: "invalid_outcome"},
		},
	}

	errors := ValidateMapConfig(mapConfig)
	expected := []string{
		`visual acceptance viewpoint "vp2" has out-of-bounds playerPosition`,
		`visual acceptance viewpoint "vp3" has zero aimDirection`,
		`visual acceptance viewpoint "vp4" has invalid expectedOutcome "invalid_outcome"`,
		`visual acceptance viewpoints must include expectedOutcome "hud_unobscured"`,
	}

	for _, want := range expected {
		if !containsAny(errors, want) {
			t.Fatalf("expected %q in errors: %v", want, errors)
		}
	}
}

func writeMapFixture(t *testing.T, dir string, name string, content string) {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write fixture %s: %v", path, err)
	}
}

func findObstacleByID(t *testing.T, mapConfig MapConfig, id string) MapObstacle {
	t.Helper()

	for _, obstacle := range mapConfig.Obstacles {
		if obstacle.ID == id {
			return obstacle
		}
	}

	t.Fatalf("expected obstacle %q to exist", id)
	return MapObstacle{}
}

func containsAny(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func containsString(value string, target string) bool {
	return strings.Contains(value, target)
}

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

func TestLoadMapRegistryFromDir_FailsWhenRequiredMapMissing(t *testing.T) {
	dir := t.TempDir()
	writeMapFixture(t, dir, "side_map.json", `{
  "id": "side_map",
  "name": "Side Map",
  "width": 800,
  "height": 600,
  "obstacles": [],
  "spawnPoints": [{"id": "spawn_a", "x": 100, "y": 100}],
  "weaponSpawns": []
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
  "weaponSpawns": []
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

func writeMapFixture(t *testing.T, dir string, name string, content string) {
	t.Helper()

	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write fixture %s: %v", path, err)
	}
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

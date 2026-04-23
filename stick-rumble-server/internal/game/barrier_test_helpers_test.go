package game

func openTestMapConfig() MapConfig {
	return MapConfig{
		ID:     "test-open",
		Name:   "Open Test Map",
		Width:  ArenaWidth,
		Height: ArenaHeight,
	}
}

func setGameServerOpenMap(gs *GameServer) {
	mapConfig := openTestMapConfig()
	gs.world.mapConfig = mapConfig
	gs.physics = NewPhysics(mapConfig)
	gs.projectileManager = NewProjectileManager(mapConfig)
}

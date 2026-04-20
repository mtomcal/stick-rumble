package game

import "testing"

func TestSegmentRectContact_ReturnsNearestContactPoint(t *testing.T) {
	start := Vector2{X: 0, Y: 5}
	end := Vector2{X: 20, Y: 5}
	area := rect{x: 10, y: 0, width: 5, height: 10}

	contact, ok := segmentRectContact(start, end, area)
	if !ok {
		t.Fatal("expected segment to hit rectangle")
	}

	if contact.Point.X != 10 || contact.Point.Y != 5 {
		t.Fatalf("contact point = %+v, want {X:10 Y:5}", contact.Point)
	}
	if contact.Distance != 10 {
		t.Fatalf("distance = %v, want 10", contact.Distance)
	}
}

func TestSegmentRectContact_Miss(t *testing.T) {
	start := Vector2{X: 0, Y: 0}
	end := Vector2{X: 5, Y: 5}
	area := rect{x: 10, y: 10, width: 5, height: 5}

	if _, ok := segmentRectContact(start, end, area); ok {
		t.Fatal("expected segment to miss rectangle")
	}
}

func TestSegmentRectContact_StartInsideRectangleBlocksAtOrigin(t *testing.T) {
	start := Vector2{X: 12, Y: 6}
	end := Vector2{X: 30, Y: 6}
	area := rect{x: 10, y: 0, width: 5, height: 10}

	contact, ok := segmentRectContact(start, end, area)
	if !ok {
		t.Fatal("expected segment starting inside rectangle to be blocked")
	}

	if contact.Point != start {
		t.Fatalf("contact point = %+v, want origin %+v", contact.Point, start)
	}
	if contact.Distance != 0 {
		t.Fatalf("distance = %v, want 0", contact.Distance)
	}
}

func TestFirstObstacleContact_PicksNearestObstacle(t *testing.T) {
	obstacles := []MapObstacle{
		{ID: "far", X: 20, Y: 0, Width: 5, Height: 10, BlocksProjectiles: true},
		{ID: "near", X: 10, Y: 0, Width: 5, Height: 10, BlocksProjectiles: true},
	}

	contact, ok := firstObstacleContact(Vector2{X: 0, Y: 5}, Vector2{X: 40, Y: 5}, obstacles, func(obstacle MapObstacle) bool {
		return obstacle.BlocksProjectiles
	})
	if !ok {
		t.Fatal("expected first obstacle contact")
	}

	if contact.Obstacle == nil || contact.Obstacle.ID != "near" {
		t.Fatalf("obstacle = %+v, want near", contact.Obstacle)
	}
	if contact.Point.X != 10 || contact.Point.Y != 5 {
		t.Fatalf("contact point = %+v, want {X:10 Y:5}", contact.Point)
	}
}

func TestSegmentPlayerHitboxContact_ExposedPortionBeatsBarrierFirstContact(t *testing.T) {
	playerPos := Vector2{X: 100, Y: 100}
	playerContact, ok := segmentPlayerHitboxContact(Vector2{X: 0, Y: 100}, Vector2{X: 200, Y: 100}, playerPos)
	if !ok {
		t.Fatal("expected player hitbox contact")
	}

	if playerContact.Point.X != 84 || playerContact.Point.Y != 100 {
		t.Fatalf("player contact = %+v, want {X:84 Y:100}", playerContact.Point)
	}

	wallFirst, ok := segmentRectContact(Vector2{X: 0, Y: 100}, Vector2{X: 200, Y: 100}, rect{x: 70, y: 70, width: 10, height: 60})
	if !ok {
		t.Fatal("expected wall contact")
	}

	if wallFirst.Distance >= playerContact.Distance {
		t.Fatalf("expected wall-first contact before player, got wall=%v player=%v", wallFirst.Distance, playerContact.Distance)
	}

	if _, ok := segmentRectContact(Vector2{X: 0, Y: 85}, Vector2{X: 200, Y: 85}, rect{x: 70, y: 95, width: 10, height: 35}); ok {
		t.Fatal("expected exposed shoulder line to stay above lower wall cover")
	}
}

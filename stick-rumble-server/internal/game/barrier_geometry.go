package game

import "math"

type segmentContact struct {
	Point    Vector2
	Distance float64
	Obstacle *MapObstacle
}

func segmentRectContact(start, end Vector2, area rect) (segmentContact, bool) {
	if pointInsideRect(start.X, start.Y, area) {
		return segmentContact{Point: start, Distance: 0}, true
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
				return segmentContact{}, false
			}
			continue
		}

		t := q / p
		if p < 0 {
			if t > tMax {
				return segmentContact{}, false
			}
			if t > tMin {
				tMin = t
			}
		} else {
			if t < tMin {
				return segmentContact{}, false
			}
			if t < tMax {
				tMax = t
			}
		}
	}

	if tMin < 0 || tMin > 1 {
		return segmentContact{}, false
	}

	point := Vector2{
		X: start.X + dx*tMin,
		Y: start.Y + dy*tMin,
	}
	return segmentContact{
		Point:    point,
		Distance: calculateDistance(start, point),
	}, true
}

func firstObstacleContact(start, end Vector2, obstacles []MapObstacle, blocks func(MapObstacle) bool) (segmentContact, bool) {
	var nearest segmentContact
	found := false

	for i := range obstacles {
		obstacle := obstacles[i]
		if blocks != nil && !blocks(obstacle) {
			continue
		}

		contact, ok := segmentRectContact(start, end, rectFromObstacle(obstacle))
		if !ok {
			continue
		}

		obstacleCopy := obstacle
		contact.Obstacle = &obstacleCopy
		if !found || contact.Distance < nearest.Distance {
			nearest = contact
			found = true
		}
	}

	return nearest, found
}

func playerHitboxRect(position Vector2) rect {
	return rect{
		x:      position.X - PlayerWidth/2,
		y:      position.Y - PlayerHeight/2,
		width:  PlayerWidth,
		height: PlayerHeight,
	}
}

func segmentPlayerHitboxContact(start, end, playerPos Vector2) (segmentContact, bool) {
	return segmentRectContact(start, end, playerHitboxRect(playerPos))
}

func clampSegmentToDistance(start, end Vector2, maxDistance float64) Vector2 {
	fullDistance := calculateDistance(start, end)
	if fullDistance == 0 || fullDistance <= maxDistance {
		return end
	}

	scale := maxDistance / fullDistance
	return Vector2{
		X: start.X + (end.X-start.X)*scale,
		Y: start.Y + (end.Y-start.Y)*scale,
	}
}

func rayEnd(origin Vector2, angleRad float64, distance float64) Vector2 {
	return Vector2{
		X: origin.X + math.Cos(angleRad)*distance,
		Y: origin.Y + math.Sin(angleRad)*distance,
	}
}

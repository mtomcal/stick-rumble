package game

import "math"

const weaponGripOffset = 10.0

func getWeaponBarrelLength(weaponType string) float64 {
	switch weaponType {
	case "Uzi", "uzi":
		return 36
	case "AK47", "ak47":
		return 50
	case "Shotgun", "shotgun":
		return 47
	case "Bat", "bat":
		return 50.5
	case "Katana", "katana":
		return 65
	case "Pistol", "pistol":
		fallthrough
	default:
		return 25
	}
}

func getWeaponFireOrigin(playerPos Vector2, aimAngle float64, weaponType string) Vector2 {
	offset := weaponGripOffset + getWeaponBarrelLength(weaponType)
	return Vector2{
		X: playerPos.X + math.Cos(aimAngle)*offset,
		Y: playerPos.Y + math.Sin(aimAngle)*offset,
	}
}

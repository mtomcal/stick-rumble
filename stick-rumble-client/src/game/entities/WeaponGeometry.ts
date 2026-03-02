export function getWeaponBarrelLength(weaponType: string): number {
  switch (weaponType.toLowerCase()) {
    case 'uzi':
      return 36;
    case 'ak47':
      return 50;
    case 'shotgun':
      return 47;
    case 'bat':
      return 50.5;
    case 'katana':
      return 65;
    case 'pistol':
    default:
      return 25;
  }
}

export function getWeaponBarrelTipPosition(
  weaponX: number,
  weaponY: number,
  aimAngle: number,
  weaponType: string
): { x: number; y: number } {
  const barrelLength = getWeaponBarrelLength(weaponType);

  return {
    x: weaponX + Math.cos(aimAngle) * barrelLength,
    y: weaponY + Math.sin(aimAngle) * barrelLength,
  };
}

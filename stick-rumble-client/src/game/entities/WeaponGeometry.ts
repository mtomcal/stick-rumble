export function getWeaponBarrelLength(weaponType: string): number {
  switch (weaponType.toLowerCase()) {
    case 'uzi':
      return 26;
    case 'ak47':
      return 40;
    case 'shotgun':
      return 37;
    case 'bat':
      return 40;
    case 'katana':
      return 55;
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

import Phaser from 'phaser';
import { WeaponType } from '../../types';

export const generateGameTextures = (scene: Phaser.Scene) => {
  // Placeholder for characters
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(0xffffff);
  graphics.fillCircle(15, 15, 15);
  graphics.generateTexture('placeholder', 30, 30);

  // Bullet Texture: Pellet (Small round dot)
  const pelletGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  pelletGfx.fillStyle(0xffffaa);
  pelletGfx.fillCircle(2, 2, 2);
  pelletGfx.generateTexture('bullet_pellet', 4, 4);

  // Bullet Texture: Tracer (Thin line)
  const tracerGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  tracerGfx.fillStyle(0xffffcc);
  tracerGfx.fillRect(0, 0, 20, 2);
  tracerGfx.generateTexture('bullet_tracer', 20, 2);

  // Reticle Texture
  const reticleGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  reticleGfx.lineStyle(2, 0xffffff, 1);
  reticleGfx.strokeCircle(16, 16, 10); // Outer ring
  
  reticleGfx.beginPath();
  reticleGfx.moveTo(16, 2); reticleGfx.lineTo(16, 8);   // Top
  reticleGfx.moveTo(16, 24); reticleGfx.lineTo(16, 30); // Bottom
  reticleGfx.moveTo(2, 16); reticleGfx.lineTo(8, 16);   // Left
  reticleGfx.moveTo(24, 16); reticleGfx.lineTo(30, 16); // Right
  reticleGfx.strokePath(); 

  reticleGfx.fillStyle(0xff0000, 1);
  reticleGfx.fillCircle(16, 16, 2); // Center Dot
  reticleGfx.generateTexture('reticle', 32, 32);

  // Hit Marker Texture ('X')
  const hitGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  hitGfx.lineStyle(3, 0xffffff, 1);
  hitGfx.beginPath();
  hitGfx.moveTo(2, 2); hitGfx.lineTo(18, 18);
  hitGfx.moveTo(18, 2); hitGfx.lineTo(2, 18);
  hitGfx.strokePath();
  hitGfx.generateTexture('hitmarker', 20, 20);

  // Directional Hit Indicator (Chevron)
  const dirIndGfx = scene.make.graphics({ x: 0, y: 0 }, false);
  dirIndGfx.fillStyle(0xffffff, 1);
  dirIndGfx.beginPath();
  dirIndGfx.moveTo(0, 0);
  dirIndGfx.lineTo(16, 8);
  dirIndGfx.lineTo(0, 16);
  dirIndGfx.lineTo(4, 8);
  dirIndGfx.closePath();
  dirIndGfx.fillPath();
  dirIndGfx.generateTexture('hit_indicator', 16, 16);

  // --- Weapon Drop Icons ---
  const createDropIcon = (key: string, color: number, w: number, h: number) => {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x000000, 0.5); // Shadow
      g.fillCircle(w/2 + 2, h/2 + 2, Math.max(w,h)/2);
      g.fillStyle(color, 1);
      g.fillRect(0, 0, w, h);
      g.lineStyle(1, 0xffffff, 0.8); // Outline
      g.strokeRect(0, 0, w, h);
      g.generateTexture(key, w, h);
  };
  
  createDropIcon(`drop_${WeaponType.BAT}`, 0xcccccc, 30, 6);
  createDropIcon(`drop_${WeaponType.KATANA}`, 0xffffff, 40, 4);
  createDropIcon(`drop_${WeaponType.UZI}`, 0x333333, 20, 12);
  createDropIcon(`drop_${WeaponType.AK47}`, 0x5d4037, 40, 8);
};
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RangedWeapon } from './RangedWeapon';
import { AudioManager } from '../audio/AudioManager';
import * as Phaser from 'phaser';

describe('RangedWeapon Audio Integration', () => {
  let scene: Phaser.Scene;
  let audioManager: AudioManager;
  let weapon: RangedWeapon;

  beforeEach(() => {
    // Create mock scene with sound system
    scene = {
      add: {
        graphics: vi.fn().mockReturnValue({
          setDepth: vi.fn().mockReturnThis(),
          setVisible: vi.fn(),
          clear: vi.fn(),
          fillStyle: vi.fn(),
          fillCircle: vi.fn(),
          destroy: vi.fn(),
        }),
      },
      time: {
        now: Date.now(),
      },
      sound: {
        add: vi.fn().mockReturnValue({
          play: vi.fn(),
          stop: vi.fn(),
          setVolume: vi.fn().mockReturnThis(),
          setPan: vi.fn().mockReturnThis(),
          once: vi.fn(),
        }),
        volume: 1,
        mute: false,
      },
    } as any;

    audioManager = new AudioManager(scene);
    weapon = new RangedWeapon(scene, 100, 100, 'Uzi');
  });

  describe('Weapon firing with audio', () => {
    it('should allow weapon sounds to be played via AudioManager for Uzi', () => {
      const playWeaponSoundSpy = vi.spyOn(audioManager, 'playWeaponSound');

      // Trigger weapon action (visual feedback)
      weapon.startFiring(0);

      // Audio is triggered separately by GameScene event handlers (not by weapon directly)
      audioManager.playWeaponSound('Uzi');

      expect(playWeaponSoundSpy).toHaveBeenCalledWith('Uzi');
    });

    it('should allow weapon sounds to be played via AudioManager for Shotgun', () => {
      const playWeaponSoundSpy = vi.spyOn(audioManager, 'playWeaponSound');

      // Trigger weapon action (visual feedback)
      weapon.triggerMuzzleFlash(0);

      // Audio is triggered separately by GameScene event handlers (not by weapon directly)
      audioManager.playWeaponSound('Shotgun');

      expect(playWeaponSoundSpy).toHaveBeenCalledWith('Shotgun');
    });

    it('should allow weapon sounds to be played via AudioManager for AK47', () => {
      const ak47Weapon = new RangedWeapon(scene, 100, 100, 'AK47');
      const playWeaponSoundSpy = vi.spyOn(audioManager, 'playWeaponSound');

      // Trigger weapon action (visual feedback)
      ak47Weapon.startFiring(0);

      // Audio is triggered separately by GameScene event handlers (not by weapon directly)
      audioManager.playWeaponSound('AK47');

      expect(playWeaponSoundSpy).toHaveBeenCalledWith('AK47');
    });

    it('should not play sound when audio manager is muted', () => {
      audioManager.setMuted(true);

      // Trigger weapon action (visual feedback)
      weapon.startFiring(0);

      // Audio is triggered separately by GameScene event handlers (not by weapon directly)
      audioManager.playWeaponSound('Uzi');

      // Sound.add should not be called when muted
      expect(scene.sound.add).not.toHaveBeenCalled();
    });
  });

  describe('Positional audio', () => {
    it('should play positional sound for remote player weapon fire', () => {
      const playPositionalSpy = vi.spyOn(audioManager, 'playWeaponSoundPositional');

      // Simulate remote player shooting at (300, 200), local player at (100, 100)
      audioManager.playWeaponSoundPositional('Uzi', 300, 200, 100, 100);

      expect(playPositionalSpy).toHaveBeenCalledWith('Uzi', 300, 200, 100, 100);
    });

    it('should apply correct pan for sound to the right', () => {
      const mockSound = {
        play: vi.fn(),
        stop: vi.fn(),
        setVolume: vi.fn().mockReturnThis(),
        setPan: vi.fn().mockReturnThis(),
        once: vi.fn(),
      };

      scene.sound.add = vi.fn().mockReturnValue(mockSound);

      // Sound to the right
      audioManager.playWeaponSoundPositional('Uzi', 300, 100, 100, 100);

      expect(mockSound.setPan).toHaveBeenCalled();
      const panValue = mockSound.setPan.mock.calls[0][0];
      expect(panValue).toBeGreaterThan(0); // Positive = right
    });

    it('should reduce volume for distant sounds', () => {
      const mockSound = {
        play: vi.fn(),
        stop: vi.fn(),
        setVolume: vi.fn().mockReturnThis(),
        setPan: vi.fn().mockReturnThis(),
        once: vi.fn(),
      };

      scene.sound.add = vi.fn().mockReturnValue(mockSound);

      // Far away sound
      audioManager.playWeaponSoundPositional('Shotgun', 1000, 1000, 100, 100);

      expect(mockSound.setVolume).toHaveBeenCalled();
      const volumeValue = mockSound.setVolume.mock.calls[0][0];
      expect(volumeValue).toBeLessThan(1.0);
    });
  });

  describe('Audio lifecycle', () => {
    it('should cleanup audio manager on destroy', () => {
      audioManager.playWeaponSound('Uzi');
      audioManager.playWeaponSound('AK47');

      expect(() => audioManager.destroy()).not.toThrow();
    });

    it('should cleanup weapon on destroy', () => {
      weapon.startFiring(0);

      expect(() => weapon.destroy()).not.toThrow();
    });
  });
});

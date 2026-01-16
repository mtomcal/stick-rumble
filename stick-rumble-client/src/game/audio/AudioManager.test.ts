import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioManager } from './AudioManager';
import * as Phaser from 'phaser';

describe('AudioManager', () => {
  let scene: Phaser.Scene;
  let audioManager: AudioManager;
  let mockSound: any;

  beforeEach(() => {
    // Create mock sound object
    mockSound = {
      play: vi.fn(),
      stop: vi.fn(),
      setVolume: vi.fn(),
      destroy: vi.fn(),
      once: vi.fn(),
    };

    // Create mock scene
    scene = {
      sound: {
        add: vi.fn().mockReturnValue(mockSound),
        mute: false,
        volume: 1,
      },
    } as any;

    audioManager = new AudioManager(scene);
  });

  describe('constructor', () => {
    it('should initialize with default settings', () => {
      expect(audioManager).toBeDefined();
      expect(audioManager.isMuted()).toBe(false);
      expect(audioManager.getVolume()).toBe(1);
    });
  });

  describe('playWeaponSound', () => {
    it('should play Uzi fire sound', () => {
      audioManager.playWeaponSound('Uzi');
      expect(scene.sound.add).toHaveBeenCalledWith('uzi-fire');
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should play AK47 fire sound', () => {
      audioManager.playWeaponSound('AK47');
      expect(scene.sound.add).toHaveBeenCalledWith('ak47-fire');
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should play Shotgun fire sound', () => {
      audioManager.playWeaponSound('Shotgun');
      expect(scene.sound.add).toHaveBeenCalledWith('shotgun-fire');
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should not play sound when muted', () => {
      audioManager.setMuted(true);
      audioManager.playWeaponSound('Uzi');
      expect(scene.sound.add).not.toHaveBeenCalled();
      expect(mockSound.play).not.toHaveBeenCalled();
    });

    it('should apply volume setting to sound', () => {
      audioManager.setVolume(0.5);
      audioManager.playWeaponSound('AK47');
      expect(mockSound.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('should handle unknown weapon type with default sound', () => {
      audioManager.playWeaponSound('UnknownWeapon');
      expect(scene.sound.add).toHaveBeenCalledWith('uzi-fire');
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should cleanup sound from activeSounds when complete event fires', () => {
      audioManager.playWeaponSound('Uzi');

      // Get the 'complete' event callback
      expect(mockSound.once).toHaveBeenCalledWith('complete', expect.any(Function));
      const completeCallback = mockSound.once.mock.calls[0][1];

      // Verify sound was added to activeSounds
      expect((audioManager as any).activeSounds.length).toBe(1);

      // Trigger the complete event
      completeCallback();

      // Verify sound was removed from activeSounds
      expect((audioManager as any).activeSounds.length).toBe(0);
    });

    it('should handle sound without play method', () => {
      const soundWithoutPlay = {
        setVolume: vi.fn(),
        once: vi.fn(),
      };

      scene.sound.add = vi.fn().mockReturnValue(soundWithoutPlay);

      // Should not throw when sound doesn't have play method
      expect(() => audioManager.playWeaponSound('Uzi')).not.toThrow();

      // Sound should not be added to activeSounds
      expect((audioManager as any).activeSounds.length).toBe(0);
    });

    it('should handle complete callback when sound not in activeSounds array', () => {
      audioManager.playWeaponSound('Uzi');

      // Get the 'complete' event callback
      const completeCallback = mockSound.once.mock.calls[0][1];

      // Remove sound manually from activeSounds
      (audioManager as any).activeSounds = [];

      // Triggering complete should not throw even when sound is not in array
      expect(() => completeCallback()).not.toThrow();
    });
  });

  describe('playWeaponSoundPositional', () => {
    it('should play positional sound for Uzi', () => {
      const mockPan = vi.fn().mockReturnValue(mockSound);
      mockSound.pan = 0;
      mockSound.setPan = mockPan;

      audioManager.playWeaponSoundPositional('Uzi', 100, 100, 200, 200);

      expect(scene.sound.add).toHaveBeenCalledWith('uzi-fire');
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should not play positional sound when muted', () => {
      audioManager.setMuted(true);
      audioManager.playWeaponSoundPositional('AK47', 100, 100, 200, 200);
      expect(scene.sound.add).not.toHaveBeenCalled();
    });

    it('should calculate pan based on position', () => {
      const mockSetPan = vi.fn().mockReturnValue(mockSound);
      mockSound.setPan = mockSetPan;

      // Sound to the right of listener
      audioManager.playWeaponSoundPositional('Uzi', 300, 100, 100, 100);
      expect(mockSetPan).toHaveBeenCalled();
      const panValue = mockSetPan.mock.calls[0][0];
      expect(panValue).toBeGreaterThan(0); // Positive pan = right
    });

    it('should calculate pan for sound to the left', () => {
      const mockSetPan = vi.fn().mockReturnValue(mockSound);
      mockSound.setPan = mockSetPan;

      // Sound to the left of listener
      audioManager.playWeaponSoundPositional('AK47', -100, 100, 100, 100);
      expect(mockSetPan).toHaveBeenCalled();
      const panValue = mockSetPan.mock.calls[0][0];
      expect(panValue).toBeLessThan(0); // Negative pan = left
    });

    it('should reduce volume based on distance', () => {
      mockSound.setVolume = vi.fn().mockReturnValue(mockSound);
      mockSound.setPan = vi.fn().mockReturnValue(mockSound);

      audioManager.setVolume(1.0);

      // Far sound should be quieter
      audioManager.playWeaponSoundPositional('Shotgun', 1000, 100, 100, 100);
      expect(mockSound.setVolume).toHaveBeenCalled();
      const volumeValue = mockSound.setVolume.mock.calls[0][0];
      expect(volumeValue).toBeLessThan(1.0);
    });

    it('should not reduce volume below minimum threshold', () => {
      mockSound.setVolume = vi.fn().mockReturnValue(mockSound);
      mockSound.setPan = vi.fn().mockReturnValue(mockSound);

      audioManager.setVolume(1.0);

      // Very far sound
      audioManager.playWeaponSoundPositional('Uzi', 5000, 100, 100, 100);
      expect(mockSound.setVolume).toHaveBeenCalled();
      const volumeValue = mockSound.setVolume.mock.calls[0][0];
      expect(volumeValue).toBeGreaterThanOrEqual(0); // Should not be negative
    });

    it('should handle unknown weapon type with default sound', () => {
      mockSound.setPan = vi.fn().mockReturnValue(mockSound);
      mockSound.setVolume = vi.fn().mockReturnValue(mockSound);

      audioManager.playWeaponSoundPositional('UnknownWeapon', 100, 100, 200, 200);
      expect(scene.sound.add).toHaveBeenCalledWith('uzi-fire');
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should cleanup sound from activeSounds when complete event fires', () => {
      mockSound.setPan = vi.fn().mockReturnValue(mockSound);
      mockSound.setVolume = vi.fn().mockReturnValue(mockSound);

      audioManager.playWeaponSoundPositional('Shotgun', 300, 300, 100, 100);

      // Get the 'complete' event callback
      expect(mockSound.once).toHaveBeenCalledWith('complete', expect.any(Function));
      const completeCallback = mockSound.once.mock.calls[0][1];

      // Verify sound was added to activeSounds
      expect((audioManager as any).activeSounds.length).toBe(1);

      // Trigger the complete event
      completeCallback();

      // Verify sound was removed from activeSounds
      expect((audioManager as any).activeSounds.length).toBe(0);
    });

    it('should handle sound without play method', () => {
      const soundWithoutPlay = {
        setPan: vi.fn().mockReturnThis(),
        setVolume: vi.fn().mockReturnThis(),
        once: vi.fn(),
      };

      scene.sound.add = vi.fn().mockReturnValue(soundWithoutPlay);

      // Should not throw when sound doesn't have play method
      expect(() => audioManager.playWeaponSoundPositional('AK47', 100, 100, 200, 200)).not.toThrow();

      // Sound should not be added to activeSounds
      expect((audioManager as any).activeSounds.length).toBe(0);
    });

    it('should handle complete callback when sound not in activeSounds array', () => {
      mockSound.setPan = vi.fn().mockReturnValue(mockSound);
      mockSound.setVolume = vi.fn().mockReturnValue(mockSound);

      audioManager.playWeaponSoundPositional('Uzi', 150, 150, 100, 100);

      // Get the 'complete' event callback
      const completeCallback = mockSound.once.mock.calls[0][1];

      // Remove sound manually from activeSounds
      (audioManager as any).activeSounds = [];

      // Triggering complete should not throw even when sound is not in array
      expect(() => completeCallback()).not.toThrow();
    });
  });

  describe('volume controls', () => {
    it('should set volume', () => {
      audioManager.setVolume(0.7);
      expect(audioManager.getVolume()).toBe(0.7);
    });

    it('should clamp volume to 0-1 range', () => {
      audioManager.setVolume(1.5);
      expect(audioManager.getVolume()).toBe(1);

      audioManager.setVolume(-0.5);
      expect(audioManager.getVolume()).toBe(0);
    });

    it('should apply volume to scene sound manager', () => {
      audioManager.setVolume(0.5);
      expect(scene.sound.volume).toBe(0.5);
    });
  });

  describe('mute controls', () => {
    it('should mute audio', () => {
      audioManager.setMuted(true);
      expect(audioManager.isMuted()).toBe(true);
      expect(scene.sound.mute).toBe(true);
    });

    it('should unmute audio', () => {
      audioManager.setMuted(true);
      audioManager.setMuted(false);
      expect(audioManager.isMuted()).toBe(false);
      expect(scene.sound.mute).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should stop all active sounds on destroy', () => {
      audioManager.playWeaponSound('Uzi');
      audioManager.playWeaponSound('AK47');

      audioManager.destroy();

      // Should have called stop on active sounds
      expect(mockSound.stop).toHaveBeenCalledTimes(2);
    });

    it('should handle destroy when no active sounds', () => {
      expect(() => audioManager.destroy()).not.toThrow();
    });

    it('should handle destroy when sound does not have stop method', () => {
      // Create a sound without 'stop' method
      const soundWithoutStop = {
        play: vi.fn(),
        setVolume: vi.fn(),
        once: vi.fn(),
      };

      // Mock scene.sound.add to return sound without stop method
      scene.sound.add = vi.fn().mockReturnValue(soundWithoutStop);

      audioManager.playWeaponSound('Uzi');

      // Should not throw even when sound doesn't have stop method
      expect(() => audioManager.destroy()).not.toThrow();
    });
  });

  describe('playDodgeRollSound', () => {
    it('should play dodge roll whoosh sound', () => {
      audioManager.playDodgeRollSound();
      expect(scene.sound.add).toHaveBeenCalledWith('dodge-roll-whoosh');
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should not play sound when muted', () => {
      audioManager.setMuted(true);
      audioManager.playDodgeRollSound();
      expect(mockSound.play).not.toHaveBeenCalled();
    });

    it('should apply volume setting to dodge roll sound', () => {
      audioManager.setVolume(0.5);
      audioManager.playDodgeRollSound();
      expect(mockSound.setVolume).toHaveBeenCalledWith(0.5);
    });
  });

  describe('preload', () => {
    it('should preload weapon sound assets', () => {
      const mockLoad = {
        audio: vi.fn(),
      };
      const mockScene = {
        load: mockLoad,
      } as any;

      AudioManager.preload(mockScene);

      expect(mockLoad.audio).toHaveBeenCalledWith('uzi-fire', 'assets/audio/uzi-fire.mp3');
      expect(mockLoad.audio).toHaveBeenCalledWith('ak47-fire', 'assets/audio/ak47-fire.mp3');
      expect(mockLoad.audio).toHaveBeenCalledWith('shotgun-fire', 'assets/audio/shotgun-fire.mp3');
    });

    it('should preload effect sound assets', () => {
      const mockLoad = {
        audio: vi.fn(),
      };
      const mockScene = {
        load: mockLoad,
      } as any;

      AudioManager.preload(mockScene);

      expect(mockLoad.audio).toHaveBeenCalledWith('dodge-roll-whoosh', 'assets/audio/whoosh.mp3');
    });
  });
});

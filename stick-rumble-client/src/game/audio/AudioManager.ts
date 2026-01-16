import * as Phaser from 'phaser';

/**
 * Audio configuration for weapon sounds
 */
interface WeaponSoundConfig {
  key: string;
  path: string;
}

/**
 * Weapon sound mappings
 */
const WEAPON_SOUNDS: Record<string, WeaponSoundConfig> = {
  Uzi: {
    key: 'uzi-fire',
    path: 'assets/audio/uzi-fire.mp3',
  },
  AK47: {
    key: 'ak47-fire',
    path: 'assets/audio/ak47-fire.mp3',
  },
  Shotgun: {
    key: 'shotgun-fire',
    path: 'assets/audio/shotgun-fire.mp3',
  },
};

/**
 * Game effect sounds
 */
const EFFECT_SOUNDS: Record<string, WeaponSoundConfig> = {
  dodgeRoll: {
    key: 'dodge-roll-whoosh',
    path: 'assets/audio/whoosh.mp3',
  },
};

/**
 * AudioManager handles all game audio including weapon sounds and positional audio
 */
export class AudioManager {
  private scene: Phaser.Scene;
  private volume: number = 1;
  private muted: boolean = false;
  private activeSounds: Phaser.Sound.BaseSound[] = [];

  // Maximum distance for positional audio falloff (in pixels)
  private static readonly MAX_AUDIO_DISTANCE = 1000;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Preload weapon sound assets
   * Should be called in the scene's preload() method
   */
  static preload(scene: Phaser.Scene): void {
    Object.values(WEAPON_SOUNDS).forEach(config => {
      scene.load.audio(config.key, config.path);
    });
    Object.values(EFFECT_SOUNDS).forEach(config => {
      scene.load.audio(config.key, config.path);
    });
  }

  /**
   * Play weapon-specific firing sound (for local player)
   */
  playWeaponSound(weaponType: string): void {
    if (this.muted) {
      return;
    }

    const soundConfig = WEAPON_SOUNDS[weaponType] || WEAPON_SOUNDS.Uzi;
    const sound = this.scene.sound.add(soundConfig.key);

    if (sound && 'setVolume' in sound) {
      sound.setVolume(this.volume);
    }

    if (sound && 'play' in sound) {
      sound.play();
      this.activeSounds.push(sound);

      // Clean up when sound finishes
      sound.once('complete', () => {
        const index = this.activeSounds.indexOf(sound);
        if (index > -1) {
          this.activeSounds.splice(index, 1);
        }
      });
    }
  }

  /**
   * Play weapon sound with 3D positional audio
   * @param weaponType Type of weapon (Uzi, AK47, Shotgun)
   * @param soundX X position of the sound source
   * @param soundY Y position of the sound source
   * @param listenerX X position of the listener (usually local player)
   * @param listenerY Y position of the listener (usually local player)
   */
  playWeaponSoundPositional(
    weaponType: string,
    soundX: number,
    soundY: number,
    listenerX: number,
    listenerY: number
  ): void {
    if (this.muted) {
      return;
    }

    const soundConfig = WEAPON_SOUNDS[weaponType] || WEAPON_SOUNDS.Uzi;
    const sound = this.scene.sound.add(soundConfig.key);

    // Calculate distance and direction
    const dx = soundX - listenerX;
    const dy = soundY - listenerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate pan (-1 = left, 0 = center, +1 = right)
    const pan = Math.max(-1, Math.min(1, dx / AudioManager.MAX_AUDIO_DISTANCE));

    // Calculate volume based on distance (closer = louder)
    const distanceFalloff = Math.max(0, 1 - distance / AudioManager.MAX_AUDIO_DISTANCE);
    const finalVolume = this.volume * distanceFalloff;

    // Apply positional audio settings
    if (sound && 'setPan' in sound && 'setVolume' in sound) {
      sound.setPan(pan);
      sound.setVolume(finalVolume);
    }

    if (sound && 'play' in sound) {
      sound.play();
      this.activeSounds.push(sound);

      // Clean up when sound finishes
      sound.once('complete', () => {
        const index = this.activeSounds.indexOf(sound);
        if (index > -1) {
          this.activeSounds.splice(index, 1);
        }
      });
    }
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.scene.sound.volume = this.volume;
  }

  /**
   * Get current master volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Set mute state
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.scene.sound.mute = muted;
  }

  /**
   * Get current mute state
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Play dodge roll whoosh sound effect
   */
  playDodgeRollSound(): void {
    if (this.muted) {
      return;
    }

    const soundConfig = EFFECT_SOUNDS.dodgeRoll;
    const sound = this.scene.sound.add(soundConfig.key);

    if (sound && 'setVolume' in sound) {
      sound.setVolume(this.volume);
    }

    if (sound && 'play' in sound) {
      sound.play();
      this.activeSounds.push(sound);

      // Clean up when sound finishes
      sound.once('complete', () => {
        const index = this.activeSounds.indexOf(sound);
        if (index > -1) {
          this.activeSounds.splice(index, 1);
        }
      });
    }
  }

  /**
   * Stop all active sounds and cleanup
   */
  destroy(): void {
    this.activeSounds.forEach(sound => {
      if (sound && 'stop' in sound) {
        sound.stop();
      }
    });
    this.activeSounds = [];
  }
}

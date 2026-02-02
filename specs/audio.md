# Audio System

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-02
> **Depends On**: [constants.md](constants.md), [weapons.md](weapons.md), [dodge-roll.md](dodge-roll.md), [client-architecture.md](client-architecture.md)
> **Depended By**: None (leaf spec)

---

## Overview

The audio system provides sound feedback for player actions in Stick Rumble. All audio is client-side only—the server does not process or transmit sound data. The system implements positional audio so sounds from remote players are attenuated based on distance and panned based on horizontal position relative to the local player.

**Why client-side only?** Sound is a presentation concern. The server broadcasts game events (projectile spawn, dodge roll), and each client independently renders audio based on those events. This reduces server bandwidth and allows per-client volume preferences without server involvement.

**Current Implementation Status**: The audio system has weapon firing sounds (Uzi, AK47, Shotgun) and a dodge roll whoosh effect. Pistol, Bat, and Katana use fallback sounds. Additional sounds (hit confirmation, empty click, reload) are planned but not yet implemented.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser | 3.90.0 | WebAudio-backed sound manager |
| Web Audio API | Browser native | Positional audio (pan, volume) |

### Spec Dependencies

- [constants.md](constants.md) - MAX_AUDIO_DISTANCE constant
- [weapons.md](weapons.md) - Weapon types that have firing sounds
- [dodge-roll.md](dodge-roll.md) - Dodge roll event triggers whoosh sound
- [client-architecture.md](client-architecture.md) - AudioManager integration in GameScene

---

## Constants

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| MAX_AUDIO_DISTANCE | 1000 | px | Maximum distance for positional audio falloff |
| DEFAULT_VOLUME | 1 | ratio | Default master volume (0-1 range) |
| DEFAULT_MUTED | false | bool | Default mute state |

### Why MAX_AUDIO_DISTANCE = 1000px?

The arena is 1920x1080 pixels. A 1000px falloff distance means:
- Sounds at the same position play at full volume
- Sounds at half the arena width (~960px) are audible but quiet
- Sounds beyond 1000px are silent

This creates spatial awareness without overwhelming players with distant combat noise.

---

## Data Structures

### WeaponSoundConfig

Configuration for a single weapon's firing sound.

**TypeScript:**
```typescript
interface WeaponSoundConfig {
  key: string;   // Phaser audio cache key (e.g., 'uzi-fire')
  path: string;  // Asset path relative to public/ (e.g., 'assets/audio/uzi-fire.mp3')
}
```

### WEAPON_SOUNDS

Mapping of weapon types to their sound configurations.

**TypeScript:**
```typescript
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
```

**Why only Uzi, AK47, Shotgun?**
- **Pistol**: Falls back to Uzi sound (rapid fire, similar profile)
- **Bat/Katana**: Melee weapons—swing sound not yet implemented
- These three weapons have distinct audio profiles: rapid burst (Uzi), single crack (AK47), deep boom (Shotgun)

### EFFECT_SOUNDS

Non-weapon sound effects.

**TypeScript:**
```typescript
const EFFECT_SOUNDS: Record<string, WeaponSoundConfig> = {
  dodgeRoll: {
    key: 'dodge-roll-whoosh',
    path: 'assets/audio/whoosh.mp3',
  },
};
```

### AudioManager

Central class for all game audio.

**TypeScript:**
```typescript
class AudioManager {
  private scene: Phaser.Scene;
  private volume: number;          // Master volume (0-1)
  private muted: boolean;          // Global mute state
  private activeSounds: Phaser.Sound.BaseSound[];  // Cleanup tracking

  static readonly MAX_AUDIO_DISTANCE: number;  // 1000px

  static preload(scene: Phaser.Scene): void;

  playWeaponSound(weaponType: string): void;
  playWeaponSoundPositional(
    weaponType: string,
    soundX: number,
    soundY: number,
    listenerX: number,
    listenerY: number
  ): void;
  playDodgeRollSound(): void;

  setVolume(volume: number): void;
  getVolume(): number;
  setMuted(muted: boolean): void;
  isMuted(): boolean;

  destroy(): void;
}
```

---

## Behavior

### Audio Preloading

All audio assets must be preloaded before the game scene is ready.

**When**: During scene's `preload()` phase.

**Pseudocode:**
```
function preload(scene):
    for each config in WEAPON_SOUNDS:
        scene.load.audio(config.key, config.path)
    for each config in EFFECT_SOUNDS:
        scene.load.audio(config.key, config.path)
```

**TypeScript:**
```typescript
static preload(scene: Phaser.Scene): void {
  Object.values(WEAPON_SOUNDS).forEach(config => {
    scene.load.audio(config.key, config.path);
  });
  Object.values(EFFECT_SOUNDS).forEach(config => {
    scene.load.audio(config.key, config.path);
  });
}
```

**Why preload?** WebAudio requires audio buffers to be loaded before playback. Loading on-demand causes audible delay on first play.

---

### Local Player Weapon Sound

When the local player fires, play the weapon sound at full volume with no positional effects.

**Trigger**: `projectile:spawn` event where `ownerId === localPlayerId`

**Pseudocode:**
```
function playWeaponSound(weaponType):
    if muted:
        return

    soundConfig = WEAPON_SOUNDS[weaponType] or WEAPON_SOUNDS.Uzi
    sound = scene.sound.add(soundConfig.key)
    sound.setVolume(masterVolume)
    sound.play()
    trackActiveSound(sound)
```

**TypeScript:**
```typescript
playWeaponSound(weaponType: string): void {
  if (this.muted) return;

  const soundConfig = WEAPON_SOUNDS[weaponType] || WEAPON_SOUNDS.Uzi;
  const sound = this.scene.sound.add(soundConfig.key);

  if (sound && 'setVolume' in sound) {
    sound.setVolume(this.volume);
  }

  if (sound && 'play' in sound) {
    sound.play();
    this.activeSounds.push(sound);

    sound.once('complete', () => {
      const index = this.activeSounds.indexOf(sound);
      if (index > -1) this.activeSounds.splice(index, 1);
    });
  }
}
```

**Why no positional audio for local player?** The local player is always at the "listener" position. Pan would always be 0, volume would always be 1.0. Direct playback is simpler and avoids unnecessary calculations.

---

### Remote Player Weapon Sound (Positional Audio)

When a remote player fires, calculate pan and volume based on position relative to local player.

**Trigger**: `projectile:spawn` event where `ownerId !== localPlayerId`

**Pseudocode:**
```
function playWeaponSoundPositional(weaponType, soundX, soundY, listenerX, listenerY):
    if muted:
        return

    soundConfig = WEAPON_SOUNDS[weaponType] or WEAPON_SOUNDS.Uzi
    sound = scene.sound.add(soundConfig.key)

    // Calculate distance
    dx = soundX - listenerX
    dy = soundY - listenerY
    distance = sqrt(dx² + dy²)

    // Pan: -1 (left) to +1 (right) based on horizontal offset
    pan = clamp(dx / MAX_AUDIO_DISTANCE, -1, +1)

    // Volume: falls off linearly with distance
    distanceFalloff = max(0, 1 - distance / MAX_AUDIO_DISTANCE)
    finalVolume = masterVolume * distanceFalloff

    sound.setPan(pan)
    sound.setVolume(finalVolume)
    sound.play()
    trackActiveSound(sound)
```

**TypeScript:**
```typescript
playWeaponSoundPositional(
  weaponType: string,
  soundX: number,
  soundY: number,
  listenerX: number,
  listenerY: number
): void {
  if (this.muted) return;

  const soundConfig = WEAPON_SOUNDS[weaponType] || WEAPON_SOUNDS.Uzi;
  const sound = this.scene.sound.add(soundConfig.key);

  const dx = soundX - listenerX;
  const dy = soundY - listenerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const pan = Math.max(-1, Math.min(1, dx / AudioManager.MAX_AUDIO_DISTANCE));
  const distanceFalloff = Math.max(0, 1 - distance / AudioManager.MAX_AUDIO_DISTANCE);
  const finalVolume = this.volume * distanceFalloff;

  if (sound && 'setPan' in sound && 'setVolume' in sound) {
    sound.setPan(pan);
    sound.setVolume(finalVolume);
  }

  if (sound && 'play' in sound) {
    sound.play();
    this.activeSounds.push(sound);

    sound.once('complete', () => {
      const index = this.activeSounds.indexOf(sound);
      if (index > -1) this.activeSounds.splice(index, 1);
    });
  }
}
```

**Why linear falloff?** Simple and predictable. Players can gauge distance by volume intuitively. More complex falloff curves (logarithmic, inverse-square) didn't provide meaningful gameplay benefits in testing.

**Why pan only on X-axis?** Stereo audio has no vertical component. Using only horizontal distance for pan matches human hearing expectations for left/right localization.

---

### Dodge Roll Sound

Play a whoosh sound when any player starts a dodge roll.

**Trigger**: `roll:start` event

**Pseudocode:**
```
function playDodgeRollSound():
    if muted:
        return

    soundConfig = EFFECT_SOUNDS.dodgeRoll
    sound = scene.sound.add(soundConfig.key)
    sound.setVolume(masterVolume)
    sound.play()
    trackActiveSound(sound)
```

**TypeScript:**
```typescript
playDodgeRollSound(): void {
  if (this.muted) return;

  const soundConfig = EFFECT_SOUNDS.dodgeRoll;
  const sound = this.scene.sound.add(soundConfig.key);

  if (sound && 'setVolume' in sound) {
    sound.setVolume(this.volume);
  }

  if (sound && 'play' in sound) {
    sound.play();
    this.activeSounds.push(sound);

    sound.once('complete', () => {
      const index = this.activeSounds.indexOf(sound);
      if (index > -1) this.activeSounds.splice(index, 1);
    });
  }
}
```

**Why no positional audio for dodge roll?** Currently, dodge roll sound plays for all roll events regardless of distance. This is a simplification—future implementation could add positional audio for remote player rolls.

---

### Volume Control

**Pseudocode:**
```
function setVolume(volume):
    masterVolume = clamp(volume, 0, 1)
    scene.sound.volume = masterVolume

function getVolume():
    return masterVolume
```

**TypeScript:**
```typescript
setVolume(volume: number): void {
  this.volume = Math.max(0, Math.min(1, volume));
  this.scene.sound.volume = this.volume;
}

getVolume(): number {
  return this.volume;
}
```

**Why clamp to 0-1?** Volume values outside this range cause undefined behavior in WebAudio. Clamping ensures robustness against invalid input.

---

### Mute Control

**Pseudocode:**
```
function setMuted(muted):
    isMuted = muted
    scene.sound.mute = muted

function isMuted():
    return isMuted
```

**TypeScript:**
```typescript
setMuted(muted: boolean): void {
  this.muted = muted;
  this.scene.sound.mute = muted;
}

isMuted(): boolean {
  return this.muted;
}
```

**Why track mute state locally?** The `playX` methods check `this.muted` before creating sounds. This prevents allocating sound objects when muted, improving performance.

---

### Sound Cleanup

Stop all active sounds and release resources.

**Trigger**: Scene shutdown or AudioManager destruction

**Pseudocode:**
```
function destroy():
    for each sound in activeSounds:
        sound.stop()
    activeSounds = []
```

**TypeScript:**
```typescript
destroy(): void {
  this.activeSounds.forEach(sound => {
    if (sound && 'stop' in sound) {
      sound.stop();
    }
  });
  this.activeSounds = [];
}
```

**Why track active sounds?** Without tracking, scene cleanup wouldn't stop in-progress sounds. The `activeSounds` array enables proper cleanup on scene restart or game exit.

---

## Event Integration

The AudioManager is integrated via GameSceneEventHandlers.

### Weapon Sound Playback Flow

```
Server broadcasts projectile:spawn
    ↓
GameSceneEventHandlers receives message
    ↓
Check if ownerId === localPlayerId
    ↓
├── Yes: audioManager.playWeaponSound(currentWeaponType)
└── No:  audioManager.playWeaponSoundPositional(
             currentWeaponType,
             message.position.x, message.position.y,
             localPlayer.x, localPlayer.y
         )
```

### Dodge Roll Sound Flow

```
Server broadcasts roll:start
    ↓
GameSceneEventHandlers receives message
    ↓
audioManager.playDodgeRollSound()
```

### Weapon Type Tracking

The `currentWeaponType` is tracked by GameSceneEventHandlers:
- Defaults to `'pistol'`
- Updated on `weapon:pickup_confirmed` for local player

**Why track weapon type separately?** The `projectile:spawn` message doesn't include weapon type—it's a generic projectile. The client must remember what weapon the local player has equipped to play the correct sound.

---

## Audio Assets

### Current Assets

| File | Weapon | Description | Duration |
|------|--------|-------------|----------|
| uzi-fire.mp3 | Uzi | Rapid SMG burst | < 1s |
| ak47-fire.mp3 | AK47 | Single rifle crack | < 1s |
| shotgun-fire.mp3 | Shotgun | Deep boom | < 1s |
| whoosh.mp3 | Dodge Roll | Air movement sound | < 0.5s |

### Asset Directory

```
stick-rumble-client/public/assets/audio/
├── uzi-fire.mp3
├── ak47-fire.mp3
├── shotgun-fire.mp3
├── whoosh.mp3 (referenced but not present in directory)
└── README.md
```

### Asset Requirements

For production-ready assets:
1. **Format**: MP3 (broad compatibility) or OGG (better compression)
2. **Duration**: < 1 second for rapid-fire weapons
3. **Volume**: Normalized across all weapons (prevent jarring volume jumps)
4. **Licensing**: Royalty-free or properly licensed for commercial use
5. **File Size**: Compressed for fast loading (< 100KB per sound)

**Why MP3?** Universal browser support. OGG would be smaller but requires fallback for Safari.

---

## Error Handling

### Unknown Weapon Type

**Trigger**: `playWeaponSound('Pistol')` or any weapon not in WEAPON_SOUNDS

**Response**: Fall back to Uzi sound

**Pseudocode:**
```
soundConfig = WEAPON_SOUNDS[weaponType] || WEAPON_SOUNDS.Uzi
```

**Why fallback instead of error?** Graceful degradation. A missing sound mapping shouldn't crash the game—players hear *something* even if it's not the ideal sound.

### Missing Sound Asset

**Trigger**: Audio file fails to load (404, corrupt file)

**Detection**: Phaser's asset loader emits errors during preload

**Response**:
- Phaser logs warning to console
- Sound playback calls fail silently (no crash)
- Game continues without that sound

**Why silent failure?** Audio is enhancement, not critical path. A missing sound file shouldn't prevent gameplay.

### Muted State

**Trigger**: `playWeaponSound()` while muted

**Response**: Early return, no sound object created

**Why check first?** Avoids allocating Phaser.Sound objects that will never play, reducing memory pressure and GC load.

---

## Implementation Notes

### TypeScript (Client)

**Manager Integration:**
```typescript
// GameScene.ts
export class GameScene extends Phaser.Scene {
  private audioManager!: AudioManager;

  preload(): void {
    AudioManager.preload(this);
  }

  create(): void {
    this.audioManager = new AudioManager(this);
    this.eventHandlers.setAudioManager(this.audioManager);
  }

  cleanup(): void {
    this.audioManager?.destroy();
  }
}
```

**Event Handler Integration:**
```typescript
// GameSceneEventHandlers.ts
handleProjectileSpawn(data: ProjectileSpawnData): void {
  const isLocalPlayer = data.ownerId === this.localPlayerId;

  if (this.audioManager) {
    if (isLocalPlayer) {
      this.audioManager.playWeaponSound(this.currentWeaponType);
    } else {
      const localPos = this.playerManager.getLocalPlayerPosition();
      if (localPos) {
        this.audioManager.playWeaponSoundPositional(
          this.currentWeaponType,
          data.position.x,
          data.position.y,
          localPos.x,
          localPos.y
        );
      }
    }
  }
}
```

### Go (Server)

**No server-side audio code.** Audio is entirely client-side. The server emits game events; clients independently render audio.

---

## Future Audio (Not Yet Implemented)

These sounds are mentioned in code comments but not yet implemented:

| Sound | Trigger | Priority |
|-------|---------|----------|
| Empty click | `shoot:failed` with reason "empty" | Medium |
| Hit confirmation ding | `hit:confirmed` | Low |
| Reload sounds | `weapon:state` with isReloading=true | Medium |
| Melee swing | `melee:hit` | Medium |
| Death sound | `player:death` | Low |
| Pickup chime | `weapon:pickup_confirmed` | Low |
| Match end | `match:ended` | Low |

---

## Test Scenarios

### TS-AUDIO-001: Weapon Sound Plays for Local Player

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- AudioManager initialized
- Not muted
- Volume > 0

**Input:**
- `playWeaponSound('Uzi')`

**Expected Output:**
- Uzi fire sound plays at master volume
- Sound tracked in activeSounds array

**TypeScript (Vitest):**
```typescript
it('plays weapon sound for local player', () => {
  audioManager.playWeaponSound('Uzi');
  expect(mockScene.sound.add).toHaveBeenCalledWith('uzi-fire');
  expect(mockSound.play).toHaveBeenCalled();
});
```

---

### TS-AUDIO-002: Positional Audio Calculates Pan Correctly

**Category**: Unit
**Priority**: High

**Preconditions:**
- AudioManager initialized
- Not muted

**Input:**
- Sound position: (1500, 500)
- Listener position: (500, 500)
- dx = 1000 (sound to the right)

**Expected Output:**
- Pan = 1.0 (full right)
- Volume reduced by distance

**TypeScript (Vitest):**
```typescript
it('calculates pan for sound to the right', () => {
  audioManager.playWeaponSoundPositional('Uzi', 1500, 500, 500, 500);
  expect(mockSound.setPan).toHaveBeenCalledWith(1);
});
```

---

### TS-AUDIO-003: Distance Falloff Reduces Volume

**Category**: Unit
**Priority**: High

**Preconditions:**
- AudioManager initialized
- Master volume = 1.0
- MAX_AUDIO_DISTANCE = 1000

**Input:**
- Sound position: (1000, 500)
- Listener position: (500, 500)
- Distance = 500px

**Expected Output:**
- Volume = 0.5 (half of master, 500/1000 falloff)

**TypeScript (Vitest):**
```typescript
it('reduces volume at half distance', () => {
  audioManager.playWeaponSoundPositional('Uzi', 1000, 500, 500, 500);
  expect(mockSound.setVolume).toHaveBeenCalledWith(0.5);
});
```

---

### TS-AUDIO-004: Sound Silent Beyond MAX_AUDIO_DISTANCE

**Category**: Unit
**Priority**: High

**Preconditions:**
- AudioManager initialized
- Distance > 1000px

**Input:**
- Sound position: (1600, 500)
- Listener position: (500, 500)
- Distance = 1100px (> 1000)

**Expected Output:**
- Volume = 0 (silent)

**TypeScript (Vitest):**
```typescript
it('is silent beyond max distance', () => {
  audioManager.playWeaponSoundPositional('Uzi', 1600, 500, 500, 500);
  expect(mockSound.setVolume).toHaveBeenCalledWith(0);
});
```

---

### TS-AUDIO-005: Mute Prevents Sound Playback

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- AudioManager initialized
- `setMuted(true)` called

**Input:**
- `playWeaponSound('Uzi')`

**Expected Output:**
- No sound created or played
- `scene.sound.add` not called

**TypeScript (Vitest):**
```typescript
it('does not play when muted', () => {
  audioManager.setMuted(true);
  audioManager.playWeaponSound('Uzi');
  expect(mockScene.sound.add).not.toHaveBeenCalled();
});
```

---

### TS-AUDIO-006: Unknown Weapon Falls Back to Uzi

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- AudioManager initialized
- 'Pistol' not in WEAPON_SOUNDS

**Input:**
- `playWeaponSound('Pistol')`

**Expected Output:**
- Uzi fire sound plays (fallback)

**TypeScript (Vitest):**
```typescript
it('falls back to Uzi for unknown weapon', () => {
  audioManager.playWeaponSound('Pistol');
  expect(mockScene.sound.add).toHaveBeenCalledWith('uzi-fire');
});
```

---

### TS-AUDIO-007: Volume Clamped to 0-1 Range

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- AudioManager initialized

**Input:**
- `setVolume(1.5)` (above max)
- `setVolume(-0.5)` (below min)

**Expected Output:**
- Volume clamped to 1.0 for 1.5
- Volume clamped to 0.0 for -0.5

**TypeScript (Vitest):**
```typescript
it('clamps volume to valid range', () => {
  audioManager.setVolume(1.5);
  expect(audioManager.getVolume()).toBe(1);

  audioManager.setVolume(-0.5);
  expect(audioManager.getVolume()).toBe(0);
});
```

---

### TS-AUDIO-008: Dodge Roll Sound Plays

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- AudioManager initialized
- Not muted

**Input:**
- `playDodgeRollSound()`

**Expected Output:**
- Whoosh sound plays at master volume

**TypeScript (Vitest):**
```typescript
it('plays dodge roll whoosh', () => {
  audioManager.playDodgeRollSound();
  expect(mockScene.sound.add).toHaveBeenCalledWith('dodge-roll-whoosh');
  expect(mockSound.play).toHaveBeenCalled();
});
```

---

### TS-AUDIO-009: Destroy Stops Active Sounds

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- AudioManager initialized
- Sound currently playing

**Input:**
- `destroy()`

**Expected Output:**
- All active sounds stopped
- activeSounds array cleared

**TypeScript (Vitest):**
```typescript
it('stops all sounds on destroy', () => {
  audioManager.playWeaponSound('Uzi');
  audioManager.destroy();
  expect(mockSound.stop).toHaveBeenCalled();
});
```

---

### TS-AUDIO-010: Preload Loads All Audio Assets

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Scene in preload phase

**Input:**
- `AudioManager.preload(scene)`

**Expected Output:**
- All weapon sounds loaded (uzi-fire, ak47-fire, shotgun-fire)
- All effect sounds loaded (dodge-roll-whoosh)

**TypeScript (Vitest):**
```typescript
it('preloads all audio assets', () => {
  AudioManager.preload(mockScene);
  expect(mockScene.load.audio).toHaveBeenCalledWith('uzi-fire', expect.any(String));
  expect(mockScene.load.audio).toHaveBeenCalledWith('ak47-fire', expect.any(String));
  expect(mockScene.load.audio).toHaveBeenCalledWith('shotgun-fire', expect.any(String));
  expect(mockScene.load.audio).toHaveBeenCalledWith('dodge-roll-whoosh', expect.any(String));
});
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |

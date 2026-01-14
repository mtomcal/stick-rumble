/**
 * InputRecorder - Records player inputs for deterministic replay
 * Enables bug reproduction and scenario testing
 */

import type { InputFrame, InputState, RecordingMetadata } from './types';

/**
 * Serialized recording format
 */
interface RecordingData {
  metadata: RecordingMetadata;
  inputs: InputFrame[];
}

/**
 * InputRecorder captures player inputs at each tick for later replay
 */
export class InputRecorder {
  private frames: InputFrame[] = [];

  /**
   * Record an input frame at a specific tick
   * @param tick The game tick number
   * @param playerId The player ID
   * @param input The input state (copied to prevent mutation)
   */
  record(tick: number, playerId: string, input: InputState): void {
    // Create a copy to prevent external mutation
    const inputCopy: InputState = { ...input };

    this.frames.push({
      tick,
      playerId,
      input: inputCopy,
    });
  }

  /**
   * Get all recorded frames (returns a copy)
   */
  getRecording(): InputFrame[] {
    return this.frames.map((frame) => ({
      ...frame,
      input: { ...frame.input },
    }));
  }

  /**
   * Clear all recorded frames
   */
  clear(): void {
    this.frames = [];
  }

  /**
   * Get recording metadata
   * @param name Name for the recording
   * @param description Optional description
   */
  getMetadata(name: string, description?: string): RecordingMetadata {
    const playerIds = this.getPlayerIds();
    const duration = this.getDuration();

    return {
      name,
      description,
      recordedAt: new Date().toISOString(),
      playerCount: playerIds.length,
      duration,
    };
  }

  /**
   * Get duration of recording (maximum tick number)
   */
  getDuration(): number {
    if (this.frames.length === 0) return 0;
    return Math.max(...this.frames.map((f) => f.tick));
  }

  /**
   * Get unique player IDs in recording
   */
  getPlayerIds(): string[] {
    const uniqueIds = new Set<string>();
    for (const frame of this.frames) {
      uniqueIds.add(frame.playerId);
    }
    return Array.from(uniqueIds);
  }

  /**
   * Serialize recording to JSON string
   * @param name Name for the recording
   * @param description Optional description
   */
  toJSON(name: string, description?: string): string {
    const data: RecordingData = {
      metadata: this.getMetadata(name, description),
      inputs: this.getRecording(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Deserialize recording from JSON string
   * @param json JSON string containing recording data
   * @returns New InputRecorder instance with loaded data
   */
  static fromJSON(json: string): InputRecorder {
    let data: RecordingData;

    try {
      data = JSON.parse(json) as RecordingData;
    } catch (error) {
      throw new Error(`Failed to parse recording JSON: ${error}`);
    }

    if (!data.inputs || !Array.isArray(data.inputs)) {
      throw new Error('Invalid recording format: missing inputs array');
    }

    const recorder = new InputRecorder();
    recorder.frames = data.inputs.map((frame) => ({
      ...frame,
      input: { ...frame.input },
    }));

    return recorder;
  }
}

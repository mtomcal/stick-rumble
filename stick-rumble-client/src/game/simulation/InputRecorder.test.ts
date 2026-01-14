import { describe, it, expect, beforeEach } from 'vitest';
import { InputRecorder } from './InputRecorder';
import type { InputState } from './types';

describe('InputRecorder', () => {
  let recorder: InputRecorder;

  const neutralInput: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  beforeEach(() => {
    recorder = new InputRecorder();
  });

  describe('record', () => {
    it('should record a single input frame', () => {
      recorder.record(0, 'player1', neutralInput);

      const recording = recorder.getRecording();
      expect(recording).toHaveLength(1);
      expect(recording[0]).toEqual({
        tick: 0,
        playerId: 'player1',
        input: neutralInput,
      });
    });

    it('should record multiple input frames in order', () => {
      recorder.record(0, 'player1', { ...neutralInput, right: true });
      recorder.record(1, 'player1', { ...neutralInput, up: true });
      recorder.record(2, 'player2', { ...neutralInput, left: true });

      const recording = recorder.getRecording();
      expect(recording).toHaveLength(3);
      expect(recording[0].tick).toBe(0);
      expect(recording[1].tick).toBe(1);
      expect(recording[2].tick).toBe(2);
      expect(recording[2].playerId).toBe('player2');
    });

    it('should handle multiple players at the same tick', () => {
      recorder.record(0, 'player1', { ...neutralInput, right: true });
      recorder.record(0, 'player2', { ...neutralInput, left: true });

      const recording = recorder.getRecording();
      expect(recording).toHaveLength(2);
      expect(recording[0].playerId).toBe('player1');
      expect(recording[1].playerId).toBe('player2');
    });

    it('should create independent copies of input state', () => {
      const input = { ...neutralInput, right: true };
      recorder.record(0, 'player1', input);

      // Mutate original input
      input.right = false;
      input.left = true;

      const recording = recorder.getRecording();
      expect(recording[0].input.right).toBe(true);
      expect(recording[0].input.left).toBe(false);
    });
  });

  describe('getRecording', () => {
    it('should return empty array for new recorder', () => {
      const recording = recorder.getRecording();
      expect(recording).toEqual([]);
    });

    it('should return independent copy of frames', () => {
      recorder.record(0, 'player1', neutralInput);

      const recording1 = recorder.getRecording();
      const recording2 = recorder.getRecording();

      expect(recording1).not.toBe(recording2);
      expect(recording1).toEqual(recording2);
    });
  });

  describe('clear', () => {
    it('should clear all recorded frames', () => {
      recorder.record(0, 'player1', neutralInput);
      recorder.record(1, 'player1', neutralInput);

      recorder.clear();

      const recording = recorder.getRecording();
      expect(recording).toHaveLength(0);
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize and deserialize recording', () => {
      recorder.record(0, 'player1', { ...neutralInput, right: true });
      recorder.record(1, 'player1', { ...neutralInput, up: true });
      recorder.record(2, 'player2', { ...neutralInput, left: true });

      const json = recorder.toJSON('test-recording');
      const parsed = JSON.parse(json);

      expect(parsed.metadata.name).toBe('test-recording');
      expect(parsed.inputs[0].tick).toBe(0);
      expect(parsed.inputs[0].playerId).toBe('player1');

      const newRecorder = InputRecorder.fromJSON(json);
      const recording = newRecorder.getRecording();

      expect(recording).toHaveLength(3);
      expect(recording[0].playerId).toBe('player1');
      expect(recording[1].input.up).toBe(true);
      expect(recording[2].playerId).toBe('player2');
    });

    it('should include metadata in serialized format', () => {
      recorder.record(0, 'player1', neutralInput);
      recorder.record(1, 'player2', neutralInput);

      const json = recorder.toJSON('metadata-test', 'Test description');

      const parsed = JSON.parse(json);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.name).toBe('metadata-test');
      expect(parsed.metadata.description).toBe('Test description');
      expect(parsed.metadata.playerCount).toBe(2);
      expect(parsed.metadata.duration).toBe(1); // 0 to 1 = 1 tick
      expect(parsed.metadata.recordedAt).toBeDefined();
    });

    it('should handle empty recording', () => {
      const json = recorder.toJSON('empty-recording');
      const newRecorder = InputRecorder.fromJSON(json);

      expect(newRecorder.getRecording()).toHaveLength(0);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        InputRecorder.fromJSON('invalid json');
      }).toThrow();
    });

    it('should throw error for missing inputs array', () => {
      const invalidJson = JSON.stringify({ metadata: { name: 'test' } });

      expect(() => {
        InputRecorder.fromJSON(invalidJson);
      }).toThrow('Invalid recording format: missing inputs array');
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata for recording', () => {
      recorder.record(0, 'player1', neutralInput);
      recorder.record(5, 'player2', neutralInput);
      recorder.record(10, 'player1', neutralInput);

      const metadata = recorder.getMetadata('test-recording');

      expect(metadata.name).toBe('test-recording');
      expect(metadata.playerCount).toBe(2);
      expect(metadata.duration).toBe(10); // Max tick
      expect(metadata.recordedAt).toBeDefined();
    });

    it('should count unique players correctly', () => {
      recorder.record(0, 'player1', neutralInput);
      recorder.record(1, 'player1', neutralInput);
      recorder.record(2, 'player2', neutralInput);
      recorder.record(3, 'player3', neutralInput);

      const metadata = recorder.getMetadata('multi-player');

      expect(metadata.playerCount).toBe(3);
    });

    it('should handle empty recording', () => {
      const metadata = recorder.getMetadata('empty');

      expect(metadata.playerCount).toBe(0);
      expect(metadata.duration).toBe(0);
    });
  });

  describe('getDuration', () => {
    it('should return maximum tick number', () => {
      recorder.record(0, 'player1', neutralInput);
      recorder.record(5, 'player1', neutralInput);
      recorder.record(3, 'player2', neutralInput);

      expect(recorder.getDuration()).toBe(5);
    });

    it('should return 0 for empty recording', () => {
      expect(recorder.getDuration()).toBe(0);
    });
  });

  describe('getPlayerIds', () => {
    it('should return unique player IDs', () => {
      recorder.record(0, 'player1', neutralInput);
      recorder.record(1, 'player1', neutralInput);
      recorder.record(2, 'player2', neutralInput);
      recorder.record(3, 'player3', neutralInput);

      const playerIds = recorder.getPlayerIds();

      expect(playerIds).toHaveLength(3);
      expect(playerIds).toContain('player1');
      expect(playerIds).toContain('player2');
      expect(playerIds).toContain('player3');
    });

    it('should return empty array for empty recording', () => {
      expect(recorder.getPlayerIds()).toEqual([]);
    });
  });
});

import Phaser from 'phaser';

// A singleton event bus to bridge React UI and Phaser Game Scene
export const EventBus = new Phaser.Events.EventEmitter();
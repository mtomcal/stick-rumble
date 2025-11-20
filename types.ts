export interface GameStats {
  health: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  score: number;
  kills: number;
  isGameOver: boolean;
  wave: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSystem?: boolean;
  isPlayer?: boolean;
  timestamp: number;
}

export interface VirtualJoystickData {
  x: number; // -1 to 1
  y: number; // -1 to 1
  active: boolean;
}

export enum WeaponType {
  BAT = 'BAT',
  KATANA = 'KATANA',
  UZI = 'UZI',
  AK47 = 'AK47'
}

// Events used by the EventBus
export const EVENTS = {
  PLAYER_UPDATE: 'player-update',
  GAME_OVER: 'game-over',
  BOT_KILLED: 'bot-killed', // Trigger for Gemini
  PLAYER_DAMAGED: 'player-damaged',
  ADD_CHAT: 'add-chat',
  INPUT_MOVE: 'input-move', // Virtual Joystick
  INPUT_AIM: 'input-aim',   // Virtual Joystick
  RESTART: 'restart',
};
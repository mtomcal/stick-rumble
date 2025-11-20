import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from './game/phaserGame';
import { EventBus } from './game/EventBus';
import { EVENTS, GameStats, ChatMessage } from './types';
import { Joystick } from './components/Joystick';
import { ChatBox } from './components/ChatBox';
import { generateBotTaunt, generateAnnouncerText } from './services/geminiService';
import { Skull, Crosshair, Activity, Trophy, RefreshCw } from 'lucide-react';

const App = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [stats, setStats] = useState<GameStats>({
    health: 100,
    ammo: 0,
    maxAmmo: 0,
    isReloading: false,
    score: 0,
    kills: 0,
    isGameOver: false,
    wave: 1
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // State to trigger joystick resets
  const [resetJoysticks, setResetJoysticks] = useState(0);

  // Initialize Game
  useEffect(() => {
    if (!gameStarted) return;

    const game = createGame('game-container');
    gameRef.current = game;

    // Listeners
    EventBus.on(EVENTS.PLAYER_UPDATE, (newStats: GameStats) => {
      setStats((prev) => ({ ...prev, ...newStats }));
    });

    EventBus.on(EVENTS.GAME_OVER, (finalStats: any) => {
        setGameOver(true);
        addSystemMessage(`GAME OVER! Score: ${finalStats.score}`);
    });

    EventBus.on(EVENTS.BOT_KILLED, async (data: { name: string }) => {
        // 30% chance to trigger a taunt to avoid API spam
        if (Math.random() > 0.7) {
            const taunt = await generateBotTaunt(`I am ${data.name}. I just got killed by the player.`);
            addChatMessage(data.name, taunt);
        }
    });

    return () => {
      game.destroy(true);
      EventBus.removeAllListeners();
    };
  }, [gameStarted]);

  // Helper to add chat
  const addChatMessage = (sender: string, text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), sender, text, timestamp: Date.now() }
    ]);
  };

  const addSystemMessage = (text: string) => {
      setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), sender: 'SYSTEM', text, isSystem: true, timestamp: Date.now() }
      ]);
  };

  // Start Game Handler
  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setMessages([]);
    setResetJoysticks(prev => prev + 1); // Reset Inputs
    addSystemMessage("Welcome to Stick Rumble. Survive.");
  };

  // Restart
  const restartGame = () => {
      EventBus.emit(EVENTS.RESTART);
      setGameOver(false);
      setResetJoysticks(prev => prev + 1); // Reset Inputs
      addSystemMessage("Restarting...");
  };

  // Joystick Handlers
  const handleMove = (data: { x: number; y: number; active: boolean }) => {
    EventBus.emit(EVENTS.INPUT_MOVE, data);
  };

  const handleAim = (data: { x: number; y: number; active: boolean }) => {
    EventBus.emit(EVENTS.INPUT_AIM, data);
  };

  // Render Logic
  return (
    <div className="w-full h-screen bg-neutral-900 relative overflow-hidden select-none text-white">
      {/* Game Container */}
      <div id="game-container" className="absolute inset-0 z-0" />

      {!gameStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90">
           <h1 className="text-5xl md:text-7xl font-bold text-red-600 mb-4 pixel-font text-center tracking-tighter">STICK RUMBLE</h1>
           <p className="text-xl text-gray-400 mb-8">AI REVENGE</p>
           <button 
             onClick={startGame}
             className="px-8 py-4 bg-white text-black font-bold text-xl rounded hover:bg-gray-200 transition pixel-font"
           >
             ENTER ARENA
           </button>
           <p className="mt-8 text-sm text-gray-600 max-w-md text-center">
             WASD to Move | Mouse to Aim/Shoot <br/>
             Or use Touch Joysticks <br/>
             'R' to Reload
           </p>
        </div>
      )}

      {gameOver && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
              <h2 className="text-5xl text-white font-bold mb-4">YOU DIED</h2>
              <div className="flex items-center gap-8 mb-8 text-xl">
                  <div className="flex flex-col items-center">
                      <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
                      <span>{stats.score}</span>
                  </div>
                  <div className="flex flex-col items-center">
                      <Skull className="w-8 h-8 text-red-500 mb-2" />
                      <span>{stats.kills} Kills</span>
                  </div>
              </div>
              <button 
                  onClick={restartGame}
                  className="px-6 py-3 border-2 border-white text-white font-bold hover:bg-white hover:text-black transition pixel-font"
              >
                  TRY AGAIN
              </button>
          </div>
      )}

      {/* HUD */}
      {gameStarted && !gameOver && (
        <>
          {/* Top Bar - Shifted left padding to accommodate minimap */}
          <div className="absolute top-0 left-0 w-full p-4 pl-44 flex justify-between items-start pointer-events-none z-10">
            {/* Health & Ammo */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Activity className={`w-6 h-6 ${stats.health < 30 ? 'text-red-500 animate-pulse' : 'text-green-500'}`} />
                <div className="w-48 h-4 bg-gray-800 rounded overflow-hidden border border-gray-600">
                  <div 
                    className={`h-full ${stats.health < 30 ? 'bg-red-600' : 'bg-green-500'}`} 
                    style={{ width: `${stats.health}%`, transition: 'width 0.2s' }} 
                  />
                </div>
                <span className="font-mono font-bold">{Math.round(stats.health)}%</span>
              </div>
              <div className={`flex items-center gap-2 ${stats.isReloading ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>
                 {stats.isReloading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Crosshair className="w-6 h-6" />}
                 <span className="font-mono font-bold">
                    {stats.maxAmmo === 0 ? 'INF' : `${stats.ammo}/${stats.maxAmmo}`}
                 </span>
                 {stats.isReloading && <span className="text-sm font-mono ml-2">RELOADING...</span>}
              </div>
            </div>

            {/* Score */}
            <div className="text-right">
               <div className="text-2xl font-bold font-mono">{stats.score.toString().padStart(6, '0')}</div>
               <div className="text-sm text-red-400 font-mono">KILLS: {stats.kills}</div>
            </div>
          </div>

          {/* Chat Box */}
          <ChatBox messages={messages} />

          {/* Mobile Controls (Visible mainly on touch devices, but rendered always for this responsive demo) */}
          <div className="md:hidden block">
            <Joystick side="left" onMove={handleMove} label="MOVE" color="blue" resetKey={resetJoysticks} />
            <Joystick side="right" onMove={handleAim} label="AIM/FIRE" color="red" resetKey={resetJoysticks} />
          </div>
        </>
      )}
    </div>
  );
};

export default App;
import React, { useRef, useEffect, useState } from 'react';

interface JoystickProps {
  onMove: (data: { x: number; y: number; active: boolean }) => void;
  color?: string;
  label?: string;
  side: 'left' | 'right';
  resetKey?: number;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove, color = 'white', label, side, resetKey }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  // Config
  const maxRadius = 40;

  // State refs for event listeners to access current values
  const activeRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null); // Track specific touch

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  const updatePosition = (clientX: number, clientY: number) => {
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const clampedDist = Math.min(distance, maxRadius);
    
    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    setPos({ x: clampedX, y: clampedY });

    // Normalize output -1 to 1
    onMove({
      x: clampedX / maxRadius,
      y: clampedY / maxRadius,
      active: true
    });
  };

  const handleStart = (clientX: number, clientY: number, id: number | null) => {
    setActive(true);
    activeRef.current = true;
    touchIdRef.current = id;
    setOrigin({ x: clientX, y: clientY });
    originRef.current = { x: clientX, y: clientY };
    setPos({ x: 0, y: 0 });
    onMove({ x: 0, y: 0, active: true });
  };

  const handleEnd = () => {
    setActive(false);
    activeRef.current = false;
    touchIdRef.current = null;
    setPos({ x: 0, y: 0 });
    onMove({ x: 0, y: 0, active: false });
  };

  // Watch for reset signal
  useEffect(() => {
    if (resetKey) {
        handleEnd();
    }
  }, [resetKey]);

  // Setup Global Listeners when active
  useEffect(() => {
    if (!active) return;

    const onTouchMove = (e: TouchEvent) => {
      // FAILSAFE: Check if our tracked touch is still on the screen
      // e.touches lists all current fingers on screen.
      if (touchIdRef.current !== null) {
          let touchFound = false;
          for (let i = 0; i < e.touches.length; i++) {
              if (e.touches[i].identifier === touchIdRef.current) {
                  touchFound = true;
                  break;
              }
          }
          // If our finger isn't in the list of active touches, force stop.
          // This fixes the "sticky" bug if the browser misses a touchend.
          if (!touchFound) {
              handleEnd();
              return;
          }
      }

      // Standard update logic
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
           const touch = e.changedTouches[i];
           updatePosition(touch.clientX, touch.clientY);
           break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
       // Global Release Check: If no touches remain on screen, kill all inputs
       if (e.touches.length === 0) {
           handleEnd();
           return;
       }

       // Standard ID Check
       for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
           handleEnd();
           break;
        }
      }
    };

    // Mouse fallbacks (ID is null for mouse)
    const onMouseMove = (e: MouseEvent) => {
      if (touchIdRef.current === null) { // Only if started by mouse
         updatePosition(e.clientX, e.clientY);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
       if (touchIdRef.current === null) {
          handleEnd();
       }
    };

    // Window blur safety (e.g. alt-tab)
    const onBlur = () => {
        handleEnd();
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [active]); 

  // Local handlers just to start the interaction
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    handleStart(touch.clientX, touch.clientY, touch.identifier);
  };

  const onMouseDown = (e: React.MouseEvent) => {
     handleStart(e.clientX, e.clientY, null); // Null ID for mouse
  };

  return (
    <div
      ref={containerRef}
      className={`absolute bottom-8 ${side === 'left' ? 'left-8' : 'right-8'} w-32 h-32 flex items-center justify-center select-none touch-none z-20`}
      onTouchStart={onTouchStart}
      onMouseDown={onMouseDown}
    >
      {/* Base */}
      <div className={`w-24 h-24 rounded-full bg-black bg-opacity-40 border-2 border-${color}-500 flex items-center justify-center relative pointer-events-none`}>
        {/* Stick */}
        <div 
          className={`w-10 h-10 rounded-full bg-${color}-500 shadow-lg`}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: active ? 'none' : 'transform 0.1s ease-out'
          }}
        />
        {label && <span className="absolute -top-8 text-white font-bold text-xs opacity-70 whitespace-nowrap">{label}</span>}
      </div>
    </div>
  );
};
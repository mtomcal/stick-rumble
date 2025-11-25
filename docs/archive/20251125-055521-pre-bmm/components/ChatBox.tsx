import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface ChatBoxProps {
  messages: ChatMessage[];
}

export const ChatBox: React.FC<ChatBoxProps> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="absolute bottom-4 left-4 w-64 h-48 overflow-hidden pointer-events-none flex flex-col justify-end font-sans z-10">
      <div className="flex flex-col space-y-1 bg-black bg-opacity-30 p-2 rounded">
        {messages.slice(-5).map((msg) => (
          <div key={msg.id} className="text-sm text-shadow">
            {msg.isSystem ? (
              <span className="text-yellow-400 font-bold">[SYSTEM] {msg.text}</span>
            ) : (
              <>
                <span className="font-bold text-red-500">{msg.sender}:</span> <span className="text-white">{msg.text}</span>
              </>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};
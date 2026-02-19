import React, { useEffect, useState, useRef } from 'react';

interface TerminalProps {
  logs: string[];
  isProcessing: boolean;
}

const TerminalInterface: React.FC<TerminalProps> = ({ logs, isProcessing }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [matrixChars, setMatrixChars] = useState<string>('');

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Matrix Effect Simulation
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setMatrixChars(Math.random().toString(36).substring(2, 15));
    }, 100);
    return () => clearInterval(interval);
  }, [isProcessing]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-black border border-neon-cyan/30 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.1)] font-mono text-sm relative">

      {/* Header */}
      <div className="bg-gray-900/80 p-2 border-b border-gray-800 flex justify-between items-center text-xs text-gray-400">
        <div className="flex gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/50"></span>
          <span className="w-3 h-3 rounded-full bg-yellow-500/50"></span>
          <span className="w-3 h-3 rounded-full bg-green-500/50"></span>
        </div>
        <div className="tracking-widest">[ROOT_ACCESS]: GRANTED</div>
      </div>

      {/* Terminal Body */}
      <div className="p-4 h-96 overflow-y-auto font-mono relative">

        {/* Scanlines Overlay */}
        <div className="scanlines absolute inset-0 pointer-events-none"></div>

        {/* Startup ASCII Art */}
        <div className="text-neon-pink mb-4 opacity-80 whitespace-pre text-[10px] md:text-xs">
{`
   _____  _______      ________ _   _ _______ _    _
  / ____||______ \\    |  ____| \\ | |__   __| |  | |
 | (___     ___/ /    | |__  |  \\| |  | |  | |__| |
  \\___ \\   / _  /     |  __| | . \` |  | |  |  __  |
  ____) | | |_) |     | |____| |\\  |  | |  | |  | |
 |_____/  |____/      |______|_| \\_|  |_|  |_|  |_|
                                SHADOW PROTOCOL
`}
        </div>

        {/* Logs */}
        <div className="space-y-1">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-2">
              <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>
              <span className="text-neon-cyan">➜</span>
              <span className="text-gray-300 glitch-text" style={{ animationDelay: `${index * 0.1}s` }}>
                {log}
              </span>
            </div>
          ))}

          {isProcessing && (
            <div className="flex gap-2 animate-pulse">
              <span className="text-neon-pink">➜</span>
              <span className="text-neon-pink">PROCESSING DATA STREAM... [{matrixChars}]</span>
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default TerminalInterface;

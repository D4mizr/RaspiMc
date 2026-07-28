/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Send, 
  Trash2, 
  Info, 
  AlertTriangle, 
  Check, 
  ChevronLeft,
  X,
  Play,
  HelpCircle,
  Command,
  ArrowRight
} from 'lucide-react';
import { MinecraftServer, ConsoleLog } from '../types';

interface McConsoleProps {
  server: MinecraftServer;
  logs: ConsoleLog[];
  onSendCommand: (serverName: string, command: string) => void;
  onClearLogs: (serverName: string) => void;
  navigate: (path: string) => void;
}

export default function McConsole({
  server,
  logs,
  onSendCommand,
  onClearLogs,
  navigate
}: McConsoleProps) {
  const [command, setCommand] = useState('');
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const isOnline = server.status === 'online';
  const isStarting = server.status === 'starting';

  // Auto scroll terminal to bottom on logs update
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    onSendCommand(server.name, command.trim());
    setCommand('');
  };

  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case 'WARN':
        return 'text-yellow-400 font-bold';
      case 'ERROR':
        return 'text-rose-500 font-extrabold';
      default:
        return 'text-cyan-400 font-bold';
    }
  };

  const getLogMessageStyle = (message: string) => {
    if (message.includes('joined the game')) {
      return 'text-emerald-400 font-medium';
    }
    if (message.includes('left the game')) {
      return 'text-amber-400/80 italic';
    }
    if (message.includes('[Server]')) {
      return 'text-pink-300 font-semibold';
    }
    if (message.includes('Can\'t keep up!')) {
      return 'text-yellow-200 italic';
    }
    return 'text-slate-100';
  };

  return (
    <div className="space-y-6" id="mc-console-container">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4" id="mc-console-header">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate(`/mc/${encodeURIComponent(server.name)}`)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition"
            title="Volver"
            id="console-back-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-mono">Consola interactiva: {server.name}</h2>
            <p className="text-sm text-slate-400">Ejecuta comandos directos y monitorea los logs del servidor de Minecraft.</p>
          </div>
        </div>

        <button
          onClick={() => onClearLogs(server.name)}
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-transparent text-xs font-semibold rounded-lg transition"
          id="clear-logs-btn"
        >
          <Trash2 size={13} />
          <span>Limpiar pantalla</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="console-grid">
        {/* Left Console Block (3 columns) */}
        <div className="lg:col-span-3 space-y-4" id="console-block">
          
          {/* Terminal Box */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl p-4 flex flex-col h-[480px] font-mono text-xs overflow-hidden relative" id="console-box">
            
            {/* Terminal Status Overlay Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3 text-[10px] text-slate-500">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="uppercase font-bold tracking-wider">
                  Terminal Socket: {isOnline ? 'CONECTADO' : 'DESCONECTADO'}
                </span>
              </div>
              <span>Minecraft StdOut Stream</span>
            </div>

            {/* Scrollable logs */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin select-text" id="logs-stream">
              {logs && logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="leading-relaxed hover:bg-slate-900/40 px-1 py-0.5 rounded transition">
                    <span className="text-slate-600 mr-2">[{log.timestamp}]</span>
                    <span className="text-slate-500 mr-1">[</span>
                    <span className={getLogLevelStyle(log.level)}>{log.level}</span>
                    <span className="text-slate-500 mr-2">]</span>
                    <span className={getLogMessageStyle(log.message)}>{log.message}</span>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 italic">
                  <span>No hay logs disponibles para este servidor.</span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Inactive Alert Overlay */}
            {!isOnline && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10" id="console-offline-alert">
                <Terminal size={32} className="text-slate-700 mb-2.5 animate-pulse" />
                <h4 className="font-bold text-white text-sm">La consola está desconectada</h4>
                <p className="text-slate-500 text-xs max-w-[280px] mt-1.5">
                  Debes encender el servidor de Minecraft para poder ver los logs en directo y ejecutar comandos.
                </p>
                {isStarting && (
                  <div className="mt-4 flex items-center space-x-2 text-amber-400 font-semibold text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span>Iniciando servidor... Espere un momento.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Command input box */}
          <form onSubmit={handleSend} className="flex gap-2.5" id="command-form">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={isOnline ? "Escribe un comando... (ej. /say ¡Hola a todos!)" : "El servidor debe estar en línea para enviar comandos"}
              disabled={!isOnline}
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm font-mono placeholder:text-slate-600 text-slate-200 disabled:bg-slate-950/20 disabled:text-slate-600 disabled:cursor-not-allowed"
              id="command-input"
            />
            <button
              type="submit"
              disabled={!isOnline || !command.trim()}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 disabled:bg-slate-950/20 disabled:text-slate-600 disabled:border-slate-900 disabled:cursor-not-allowed rounded-lg shadow transition flex items-center gap-1.5"
              id="send-command-btn"
            >
              <Send size={14} />
              <span className="font-bold text-sm hidden sm:inline">Enviar</span>
            </button>
          </form>

        </div>

        {/* Right side helper Panel (1 column) */}
        <div className="space-y-6 font-sans" id="console-help-sidebar">
          
          {/* Minecraft command syntax help */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-2.5 text-slate-300" id="console-help-card">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1">
              <HelpCircle size={14} className="text-indigo-400" />
              <span>Ayuda de Sintaxis</span>
            </h4>
            <div className="text-[11px] space-y-2 leading-relaxed">
              <p className="text-slate-400">Puedes escribir comandos de Minecraft directamente en la consola. No necesitas añadir la barra `/` si ejecutas desde consola local, pero la interfaz la acepta.</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 font-mono text-[10px]">
                <li><strong className="text-slate-300">/op &lt;nombre&gt;</strong>: Dar administrador</li>
                <li><strong className="text-slate-300">/kick &lt;nombre&gt;</strong>: Expulsar</li>
                <li><strong className="text-slate-300">/ban &lt;nombre&gt;</strong>: Banear</li>
                <li><strong className="text-slate-300">/say &lt;mensaje&gt;</strong>: Anuncio global</li>
                <li><strong className="text-slate-300">/damage &lt;jugador&gt; &lt;pts&gt;</strong>: Daño directo</li>
                <li><strong className="text-slate-300">/effect give &lt;jugador&gt; hunger</strong>: Hambre</li>
                <li><strong className="text-slate-300">/tp &lt;jugador&gt; &lt;x&gt; &lt;y&gt; &lt;z&gt;</strong>: Teletransporte</li>
              </ul>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

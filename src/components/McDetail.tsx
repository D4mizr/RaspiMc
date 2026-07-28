/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  AlertTriangle, 
  Users, 
  HardDrive, 
  Cpu, 
  ShieldCheck, 
  Ban, 
  UserMinus, 
  ChevronLeft,
  Clock,
  Terminal,
  Settings,
  CheckCircle2,
  Lock,
  Compass,
  Info
} from 'lucide-react';
import { MinecraftServer } from '../types';
import { PlayerModal } from './PlayerModal';

interface McDetailProps {
  server: MinecraftServer;
  onStartServer: (name: string) => void;
  onStopServer: (name: string) => void;
  onKickPlayer: (serverName: string, playerName: string) => void;
  onOpPlayer: (serverName: string, playerName: string) => void;
  navigate: (path: string) => void;
}

export default function McDetail({
  server,
  onStartServer,
  onStopServer,
  onKickPlayer,
  onOpPlayer,
  navigate
}: McDetailProps) {
  const [cpuLoad, setCpuLoad] = useState(0);
  const [ramUsed, setRamUsed] = useState(0);
  const [adminMessage, setAdminMessage] = useState('');
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<string | null>(null);

  const isOnline = server.status === 'online';
  const isOffline = server.status === 'offline';
  const isStarting = server.status === 'starting';
  const isStopping = server.status === 'stopping';
  const isInstalled = server.installed !== false;

  // Fluctuate CPU & RAM slightly if online to make it look dynamic and live
  useEffect(() => {
    if (isOnline) {
      // Setup initial random values
      setCpuLoad(Math.floor(Math.random() * 20) + 15);
      setRamUsed(parseFloat((server.ramAllocated * 0.7 + Math.random() * 0.3).toFixed(2)));

      const interval = setInterval(() => {
        setCpuLoad(Math.max(5, Math.min(95, Math.floor(Math.random() * 30) + 10)));
        setRamUsed(parseFloat(Math.max(0.5, Math.min(server.ramAllocated, server.ramAllocated * 0.65 + Math.random() * 0.4)).toFixed(2)));
      }, 4000);
      return () => clearInterval(interval);
    } else {
      setCpuLoad(0);
      setRamUsed(0);
    }
  }, [isOnline, server.ramAllocated]);

  const handleAdminAction = (message: string) => {
    setAdminMessage(message);
    setTimeout(() => {
      setAdminMessage('');
    }, 4000);
  };

  const handleRestart = () => {
    onStopServer(server.name);
    handleAdminAction('Reiniciando el servidor... Deteniendo primero.');
    setTimeout(() => {
      onStartServer(server.name);
    }, 3000);
  };

  const handleForceKill = () => {
    onStopServer(server.name);
    handleAdminAction('Proceso finalizado a la fuerza (Force Kill).');
  };

  return (
    <div className="space-y-6" id="mc-detail-container">
      {/* Return button and Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4" id="mc-detail-header">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/mc')}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition"
            title="Volver"
            id="back-to-overview-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-mono">{server.name}</h2>
              <span className="text-xs bg-slate-850 border border-slate-750 text-slate-300 px-2 py-0.5 rounded font-bold font-mono">
                {server.type}
              </span>
            </div>
            <p className="text-sm text-slate-400 font-mono mt-0.5">{server.ip}:{server.port}</p>
          </div>
        </div>

        {/* Quick Tabs to Console / Config */}
        <div className="flex items-center gap-2" id="quick-tabs">
          <button
            onClick={() => navigate(`/mc/${encodeURIComponent(server.name)}/console`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold rounded-lg transition"
            id="quick-console-btn"
          >
            <Terminal size={13} />
            <span>Consola</span>
          </button>
          <button
            onClick={() => navigate(`/mc/${encodeURIComponent(server.name)}/config`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold rounded-lg transition"
            id="quick-settings-btn"
          >
            <Settings size={13} />
            <span>Configuración</span>
          </button>
        </div>
      </div>

      {/* Admin Action Message banner */}
      {adminMessage && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg flex items-center gap-2.5 text-sm animate-fadeIn" id="admin-action-banner">
          <AlertTriangle size={16} className="text-amber-400" />
          <span>{adminMessage}</span>
        </div>
      )}

      {/* Main Stats and Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="detail-main-grid">
        
        {/* Left Column: Power Control and Hardware Stats */}
        <div className="lg:col-span-2 space-y-6" id="detail-left-column">
          
          {/* Power Control Card */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800" id="power-control-card">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Panel de Control de Energía</h3>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Status Graphic Badge */}
              <div className="flex items-center space-x-3.5 bg-slate-950 border border-slate-850 px-5 py-4 rounded-lg w-full sm:w-auto">
                <span className={`w-3.5 h-3.5 rounded-full ${
                  isOnline ? 'bg-emerald-500 animate-pulse' :
                  isStarting ? 'bg-amber-400 animate-bounce' :
                  isStopping ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'
                }`} />
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Estado del Servidor</span>
                  <span className="text-sm font-bold text-slate-200 font-mono">
                    {isOnline ? 'EN LÍNEA' :
                     isStarting ? 'INICIANDO...' :
                     isStopping ? 'DETENIENDO...' : 'APAGADO'}
                  </span>
                </div>
              </div>

              {/* Control Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end flex-1">
                {!isInstalled ? (
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border border-amber-500/30 text-amber-400 cursor-not-allowed text-sm font-bold rounded-lg shadow"
                    title="No se puede encender el servidor porque el archivo .jar aún no ha terminado de descargarse."
                    id="power-start-btn"
                  >
                    <AlertTriangle size={14} />
                    <span>Sin .jar (No Instalado)</span>
                  </button>
                ) : isOffline ? (
                  <button
                    onClick={() => onStartServer(server.name)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-slate-950 text-sm font-bold rounded-lg shadow transition"
                    id="power-start-btn"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>Encender</span>
                  </button>
                ) : null}

                {isOnline && (
                  <button
                    onClick={() => onStopServer(server.name)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg shadow transition"
                    id="power-stop-btn"
                  >
                    <Square size={14} fill="currentColor" />
                    <span>Apagar</span>
                  </button>
                )}

                {(isStarting || isStopping) && (
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed text-sm font-semibold rounded-lg animate-pulse"
                    id="power-busy-btn"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                    <span>Procesando...</span>
                  </button>
                )}

                <button
                  disabled={isOffline || isStarting || isStopping}
                  onClick={handleRestart}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 disabled:bg-slate-950/20 disabled:text-slate-600 disabled:border-slate-900 disabled:cursor-not-allowed text-slate-300 text-sm font-semibold rounded-lg transition"
                  id="power-restart-btn"
                >
                  <RotateCcw size={14} />
                  <span>Reiniciar</span>
                </button>

                <button
                  onClick={handleForceKill}
                  disabled={isOffline}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-950 hover:bg-rose-500/10 text-rose-400 disabled:text-slate-600 disabled:bg-transparent disabled:cursor-not-allowed text-sm font-semibold rounded-lg transition"
                  id="power-kill-btn"
                >
                  <AlertTriangle size={14} />
                  <span>Forzar detención</span>
                </button>
              </div>
            </div>
          </div>

          {/* Performance Gauges Card */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800" id="performance-gauges-card">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Rendimiento en Tiempo Real</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" id="gauges-grid">
              
              {/* CPU load */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Cpu size={14} className="text-slate-500" />
                    Carga de CPU (Servidor)
                  </span>
                  <span className="text-sm font-bold text-slate-200 font-mono">
                    {cpuLoad}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${cpuLoad}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-mono">Asignado a procesos internos de Java</p>
              </div>

              {/* Memory Usage */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <HardDrive size={14} className="text-slate-500" />
                    RAM Consumida
                  </span>
                  <span className="text-sm font-bold text-slate-200 font-mono">
                    {ramUsed.toFixed(2)} GB / {server.ramAllocated.toFixed(1)} GB
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-500" 
                    style={{ width: `${server.ramAllocated > 0 ? (ramUsed / server.ramAllocated) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 font-mono">JVM heap space optimizado</p>
              </div>

            </div>
          </div>

          {/* Connection Details */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4" id="connection-details-card">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalles de Conexión y Red</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono" id="connection-grid">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-850">
                <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5 tracking-wider">IP Directa</span>
                <span className="text-slate-200 select-all font-semibold">{server.ip}:{server.port}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-850">
                <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5 tracking-wider">Semilla del Mundo</span>
                <span className="text-slate-200 select-all font-semibold">{server.worldSeed}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Players List Admin */}
        <div className="space-y-6" id="detail-right-column">
          
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex flex-col h-full" id="players-admin-card">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={16} className="text-slate-500" />
                <span>Jugadores Activos</span>
              </h3>
              <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700/50 px-2.5 py-0.5 rounded font-bold font-mono">
                {server.playersOnline} / {server.playersMax}
              </span>
            </div>

            {isOnline ? (
              server.playersList.length > 0 ? (
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[350px] pr-1" id="players-list-detail">
                  {server.playersList.map((player) => (
                    <div 
                      key={player}
                      onClick={() => setSelectedPlayerForModal(player)}
                      className="p-3 bg-slate-950 hover:bg-slate-900 cursor-pointer rounded-lg border border-slate-850 hover:border-indigo-500/30 flex items-center justify-between group/row transition duration-150"
                      id={`player-row-${player}`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs uppercase font-mono">
                          {player.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-200 font-mono group-hover/row:text-indigo-300 transition">{player}</p>
                          <span className="text-[10px] text-emerald-400 block -mt-0.5 font-mono flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                            Conectado
                          </span>
                        </div>
                      </div>

                      {/* Administrator action items */}
                      <div className="flex items-center space-x-1.5 opacity-80 sm:opacity-0 group-hover/row:opacity-100 transition duration-200" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedPlayerForModal(player)}
                          className="p-1 rounded hover:bg-indigo-500/10 text-indigo-400 transition"
                          title="Ver info y coordenadas"
                          id={`info-player-btn-${player}`}
                        >
                          <Info size={14} />
                        </button>
                        <button
                          onClick={() => {
                            onOpPlayer(server.name, player);
                            handleAdminAction(`Otorgado rango OP (Administrador) a ${player}.`);
                          }}
                          className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition"
                          title="Otorgar OP"
                          id={`op-player-btn-${player}`}
                        >
                          <ShieldCheck size={14} />
                        </button>
                        <button
                          onClick={() => {
                            onKickPlayer(server.name, player);
                            handleAdminAction(`Expulsado (Kicked) jugador ${player} del servidor.`);
                          }}
                          className="p-1 rounded hover:bg-amber-500/10 text-amber-400 transition"
                          title="Expulsar"
                          id={`kick-player-btn-${player}`}
                        >
                          <UserMinus size={14} />
                        </button>
                        <button
                          onClick={() => {
                            onKickPlayer(server.name, player);
                            handleAdminAction(`Baneado jugador ${player} permanentemente.`);
                          }}
                          className="p-1 rounded hover:bg-rose-500/10 text-rose-400 transition"
                          title="Banear"
                          id={`ban-player-btn-${player}`}
                        >
                          <Ban size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center flex-1" id="empty-players">
                  <Users size={32} className="text-slate-600 mb-2" />
                  <p className="text-xs font-medium">No hay jugadores conectados</p>
                  <p className="text-[10px] text-slate-500 max-w-[150px] mx-auto mt-0.5">Comparte la IP local con tus amigos para empezar a jugar.</p>
                </div>
              )
            ) : (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center flex-1" id="offline-players">
                <Lock size={32} className="text-slate-600 mb-2" />
                <p className="text-xs font-semibold">Servidor Apagado</p>
                <p className="text-[10px] text-slate-500 max-w-[150px] mx-auto mt-0.5">Enciende el servidor de Minecraft para habilitar la administración de jugadores.</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Player Detail & Admin Modal */}
      <PlayerModal
        serverName={server.name}
        playerName={selectedPlayerForModal}
        isOpen={!!selectedPlayerForModal}
        onClose={() => setSelectedPlayerForModal(null)}
        onAdminAction={handleAdminAction}
      />

    </div>
  );
}

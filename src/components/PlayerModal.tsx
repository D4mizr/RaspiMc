import React, { useState, useEffect, useCallback } from 'react';
import { PlayerData } from '../types';
import {
  X,
  Heart,
  Utensils,
  MapPin,
  RefreshCw,
  Send,
  UserMinus,
  Ban,
  Navigation,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface PlayerModalProps {
  serverName: string;
  playerName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAdminAction?: (msg: string) => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  serverName,
  playerName,
  isOpen,
  onClose,
  onAdminAction
}) => {
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Editable health and hunger states
  const [healthInput, setHealthInput] = useState<number>(20);
  const [hungerInput, setHungerInput] = useState<number>(20);

  // Editable coordinate states for teleportation
  const [posX, setPosX] = useState<string>('0');
  const [posY, setPosY] = useState<string>('64');
  const [posZ, setPosZ] = useState<string>('0');
  const [teleporting, setTeleporting] = useState<boolean>(false);

  // Custom chat message
  const [customMessage, setCustomMessage] = useState('');
  
  // Feedback & Confirm states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'kick' | 'ban' | null>(null);

  // Fetch real player data from server API
  const fetchPlayerData = useCallback(async (isManualRefresh = false) => {
    if (!serverName || !playerName) return;
    if (isManualRefresh) setRefreshing(true);

    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/players/${encodeURIComponent(playerName)}`);
      if (!res.ok) throw new Error('Error al obtener datos del jugador');
      const json: PlayerData = await res.json();
      
      setData(json);
      if (json.health !== null && json.health !== undefined) setHealthInput(json.health);
      if (json.hunger !== null && json.hunger !== undefined) setHungerInput(json.hunger);

      if (json.coordinates) {
        setPosX(String(json.coordinates.x));
        setPosY(String(json.coordinates.y));
        setPosZ(String(json.coordinates.z));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverName, playerName]);

  // Load player data when opened & auto-refresh coordinates every 30 seconds
  useEffect(() => {
    if (isOpen && playerName) {
      setLoading(true);
      setFeedback(null);
      setConfirmAction(null);
      fetchPlayerData();

      const timer = setInterval(() => {
        fetchPlayerData();
      }, 30000);

      return () => clearInterval(timer);
    } else {
      setData(null);
    }
  }, [isOpen, playerName, fetchPlayerData]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !playerName) return null;

  // 1. Health Administration (Real Command)
  const handleApplyHealth = async () => {
    if (!serverName || !playerName) return;
    setFeedback(null);
    const currHp = data?.health !== undefined && data?.health !== null ? data.health : healthInput;
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/players/${encodeURIComponent(playerName)}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ health: healthInput, currentHealth: currHp })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Fallo al actualizar la salud');
      
      setFeedback({ type: 'success', msg: result.message || `Salud de ${playerName} actualizada.` });
      if (onAdminAction) onAdminAction(result.message);
      fetchPlayerData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    }
  };

  // 2. Hunger Administration (Real Command)
  const handleApplyHunger = async () => {
    if (!serverName || !playerName) return;
    setFeedback(null);
    const currFood = data?.hunger !== undefined && data?.hunger !== null ? data.hunger : hungerInput;
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/players/${encodeURIComponent(playerName)}/hunger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hunger: hungerInput, currentHunger: currFood })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Fallo al actualizar el hambre');
      
      setFeedback({ type: 'success', msg: result.message || `Hambre de ${playerName} actualizada.` });
      if (onAdminAction) onAdminAction(result.message);
      fetchPlayerData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    }
  };

  // 3. Teleport to Editable Coordinates (Real Command)
  const handleTeleport = async () => {
    if (!serverName || !playerName) return;
    const numX = parseFloat(posX);
    const numY = parseFloat(posY);
    const numZ = parseFloat(posZ);

    if (isNaN(numX) || isNaN(numY) || isNaN(numZ)) {
      setFeedback({ type: 'error', msg: 'Por favor ingresa coordenadas numéricas válidas en X, Y y Z.' });
      return;
    }

    setTeleporting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/players/${encodeURIComponent(playerName)}/teleport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: numX, y: numY, z: numZ })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al teletransportar');

      setFeedback({ type: 'success', msg: result.message || `Teletransportado a X:${numX}, Y:${numY}, Z:${numZ}` });
      if (onAdminAction) onAdminAction(result.message);
      fetchPlayerData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setTeleporting(false);
    }
  };

  // 4. Send Message
  const handleSendMessage = async () => {
    if (!customMessage.trim()) return;
    setFeedback(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/players/${encodeURIComponent(playerName)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: customMessage })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error enviando mensaje');

      setFeedback({ type: 'success', msg: `Mensaje enviado a ${playerName}.` });
      setCustomMessage('');
      if (onAdminAction) onAdminAction(`Mensaje enviado a ${playerName}: ${customMessage}`);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    }
  };

  // 5. Kick Action
  const handleExecuteKick = async () => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/players/${encodeURIComponent(playerName)}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Expulsado por administrador' })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al expulsar');

      if (onAdminAction) onAdminAction(`Jugador ${playerName} expulsado del servidor.`);
      onClose();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
      setConfirmAction(null);
    }
  };

  // 6. Ban Action
  const handleExecuteBan = async () => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(serverName)}/players/${encodeURIComponent(playerName)}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Baneado por administrador' })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al banear');

      if (onAdminAction) onAdminAction(`Jugador ${playerName} baneado permanentemente.`);
      onClose();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
      setConfirmAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      id="player-modal-backdrop"
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
        id="player-modal-container"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 font-mono text-lg shadow-inner">
              {playerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 font-mono text-base">{playerName}</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  Conectado
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Servidor: <span className="text-indigo-300 font-semibold">{serverName}</span></p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => fetchPlayerData(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
              title="Refrescar datos en tiempo real (auto-refresco cada 30s)"
              id="refresh-player-data-btn"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Cerrar"
              id="close-player-modal-btn"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Section 1: Editable Coordinates / Teleport */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <MapPin size={14} className="text-indigo-400" />
                <span>Coordenadas y Teletransporte</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {refreshing ? 'Actualizando...' : data?.lastUpdated ? `Refrescado: ${data.lastUpdated}` : 'Sincronizado'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-sans block mb-1 font-semibold">Eje X</label>
                <input
                  type="number"
                  step="any"
                  value={posX}
                  onChange={(e) => setPosX(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 text-center font-bold focus:outline-none"
                  id="coord-x-input"
                  placeholder="X"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-sans block mb-1 font-semibold">Eje Y</label>
                <input
                  type="number"
                  step="any"
                  value={posY}
                  onChange={(e) => setPosY(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 text-center font-bold focus:outline-none"
                  id="coord-y-input"
                  placeholder="Y"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-sans block mb-1 font-semibold">Eje Z</label>
                <input
                  type="number"
                  step="any"
                  value={posZ}
                  onChange={(e) => setPosZ(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 text-center font-bold focus:outline-none"
                  id="coord-z-input"
                  placeholder="Z"
                />
              </div>
            </div>

            <button
              onClick={handleTeleport}
              disabled={teleporting}
              className="w-full mt-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow"
              id="teleport-player-btn"
            >
              <Navigation size={13} className={teleporting ? 'animate-spin' : ''} />
              <span>{teleporting ? 'Teletransportando...' : 'Teletransportar Jugador'}</span>
            </button>
          </div>

          {/* Section 2: Health & Hunger Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Health (HP) */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                  <Heart size={14} className="text-rose-500" />
                  <span>Salud (HP)</span>
                </span>
                <span className="text-xs font-mono font-bold text-rose-400">
                  {data?.health !== null && data?.health !== undefined ? `${data.health} / 20` : `${healthInput} / 20`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-rose-600 to-rose-400 h-full transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, (healthInput / 20) * 100))}%` }}
                ></div>
              </div>

              {/* Step Controls & Quick Presets */}
              <div className="flex items-center space-x-1 pt-1">
                <button
                  onClick={() => setHealthInput(prev => Math.max(0, prev - 1))}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded font-bold text-xs"
                  title="Restar 1 HP"
                >
                  -1
                </button>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={healthInput}
                  onChange={(e) => setHealthInput(Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-14 bg-slate-900 border border-slate-700 rounded py-1 text-xs font-mono text-center text-slate-100 font-bold focus:outline-none focus:border-rose-500"
                  id="health-input-modal"
                />
                <button
                  onClick={() => setHealthInput(prev => Math.min(20, prev + 1))}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded font-bold text-xs"
                  title="Sumar 1 HP"
                >
                  +1
                </button>
                <button
                  onClick={handleApplyHealth}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-1 px-2 rounded text-xs font-semibold transition"
                  id="apply-health-btn"
                >
                  Aplicar
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex justify-between gap-1 pt-0.5">
                <button onClick={() => setHealthInput(1)} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 px-2 py-0.5 rounded font-mono">1 HP</button>
                <button onClick={() => setHealthInput(10)} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 px-2 py-0.5 rounded font-mono">10 HP</button>
                <button onClick={() => setHealthInput(20)} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 px-2 py-0.5 rounded font-mono">20 HP (Max)</button>
              </div>
            </div>

            {/* Hunger */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                  <Utensils size={14} className="text-amber-500" />
                  <span>Hambre</span>
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {data?.hunger !== null && data?.hunger !== undefined ? `${data.hunger} / 20` : `${hungerInput} / 20`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, (hungerInput / 20) * 100))}%` }}
                ></div>
              </div>

              {/* Step Controls & Quick Presets */}
              <div className="flex items-center space-x-1 pt-1">
                <button
                  onClick={() => setHungerInput(prev => Math.max(0, prev - 1))}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded font-bold text-xs"
                  title="Restar 1"
                >
                  -1
                </button>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={hungerInput}
                  onChange={(e) => setHungerInput(Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-14 bg-slate-900 border border-slate-700 rounded py-1 text-xs font-mono text-center text-slate-100 font-bold focus:outline-none focus:border-amber-500"
                  id="hunger-input-modal"
                />
                <button
                  onClick={() => setHungerInput(prev => Math.min(20, prev + 1))}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded font-bold text-xs"
                  title="Sumar 1"
                >
                  +1
                </button>
                <button
                  onClick={handleApplyHunger}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-1 px-2 rounded text-xs font-semibold transition"
                  id="apply-hunger-btn"
                >
                  Aplicar
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex justify-between gap-1 pt-0.5">
                <button onClick={() => setHungerInput(0)} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono">0 (Sin comida)</button>
                <button onClick={() => setHungerInput(10)} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono">10</button>
                <button onClick={() => setHungerInput(20)} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono">20 (Lleno)</button>
              </div>
            </div>
          </div>

          {/* Section 3: Send Direct Message */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">Enviar Mensaje Privado</span>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Escribe un mensaje privado para el jugador..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-slate-900 border border-slate-750 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                id="send-message-player-input"
              />
              <button
                onClick={handleSendMessage}
                disabled={!customMessage.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 shrink-0"
                id="send-message-player-btn"
              >
                <Send size={13} />
                <span>Enviar</span>
              </button>
            </div>
          </div>

          {/* Section 4: Admin Action Buttons */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Acciones de Administración</span>

            {confirmAction === 'kick' ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <p className="text-xs text-amber-200">¿Estás seguro de expulsar a <strong className="font-mono">{playerName}</strong>?</p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleExecuteKick}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-1 px-2 rounded text-xs font-semibold transition"
                    id="confirm-kick-btn"
                  >
                    Sí, Expulsar
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 px-3 rounded text-xs transition"
                    id="cancel-kick-btn"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : confirmAction === 'ban' ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                <p className="text-xs text-rose-200">¿Estás seguro de banear permanentemente a <strong className="font-mono">{playerName}</strong>?</p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleExecuteBan}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-1 px-2 rounded text-xs font-semibold transition"
                    id="confirm-ban-btn"
                  >
                    Sí, Banear
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 px-3 rounded text-xs transition"
                    id="cancel-ban-btn"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmAction('kick')}
                  className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                  id="trigger-kick-btn"
                >
                  <UserMinus size={14} />
                  <span>Expulsar (Kick)</span>
                </button>
                <button
                  onClick={() => setConfirmAction('ban')}
                  className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                  id="trigger-ban-btn"
                >
                  <Ban size={14} />
                  <span>Banear (Ban)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

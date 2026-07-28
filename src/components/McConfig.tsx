/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Sliders, 
  Save, 
  CheckCircle2, 
  ChevronLeft,
  Settings,
  Database,
  Sparkles,
  Upload,
  Trash2,
  Image as ImageIcon,
  HardDrive,
  Globe,
  Package,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { MinecraftServer } from '../types';

interface McConfigProps {
  server: MinecraftServer;
  onUpdateConfig: (name: string, updatedFields: Partial<MinecraftServer>) => void;
  navigate: (path: string) => void;
}

export default function McConfig({
  server,
  onUpdateConfig,
  navigate
}: McConfigProps) {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [iconTimestamp, setIconTimestamp] = useState<number>(Date.now());

  // Local form states
  const [motd, setMotd] = useState(server.motd || 'A RaspiMC server -- Kai');
  const [gameMode, setGameMode] = useState(server.gameMode);
  const [difficulty, setDifficulty] = useState(server.difficulty);
  const [pvp, setPvp] = useState(server.pvp);
  const [spawnProtection, setSpawnProtection] = useState(server.spawnProtection);
  const [viewDistance, setViewDistance] = useState(server.viewDistance);
  const [allowFlight, setAllowFlight] = useState(server.allowFlight);
  const [enableCommandBlocks, setEnableCommandBlocks] = useState(server.enableCommandBlocks);
  const [playersMax, setPlayersMax] = useState(server.playersMax);
  const [worldName, setWorldName] = useState(server.worldName);

  // New Rule States
  const [whiteList, setWhiteList] = useState<boolean>(server.whiteList ?? false);
  const [onlineMode, setOnlineMode] = useState<boolean>(server.onlineMode ?? true);
  const [spawnAnimals, setSpawnAnimals] = useState<boolean>(server.spawnAnimals ?? true);
  const [spawnMonsters, setSpawnMonsters] = useState<boolean>(server.spawnMonsters ?? true);
  const [spawnNpcs, setSpawnNpcs] = useState<boolean>(server.spawnNpcs ?? true);
  const [allowNether, setAllowNether] = useState<boolean>(server.allowNether ?? true);
  const [forceGamemode, setForceGamemode] = useState<boolean>(server.forceGamemode ?? false);

  // Resource Pack States
  const [requireResourcePack, setRequireResourcePack] = useState<boolean>(server.requireResourcePack ?? false);
  const [resourcePack, setResourcePack] = useState<string>(server.resourcePack || '');
  const [resourcePackPrompt, setResourcePackPrompt] = useState<string>(server.resourcePackPrompt || '');

  // RAM Allocation States
  const [ramMinAllocated, setRamMinAllocated] = useState<number>(server.ramMinAllocated ?? 1);
  const [ramAllocated, setRamAllocated] = useState<number>(server.ramAllocated ?? 2);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload & resize server icon to 64x64 PNG
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona un archivo de imagen válido (.png, .jpg, .webp).');
      return;
    }

    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        // Draw image resized onto a 64x64 canvas
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, 0, 0, 64, 64);
          const resizedDataUrl = canvas.toDataURL('image/png');

          try {
            const res = await fetch(`/api/servers/${encodeURIComponent(server.name)}/icon`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ iconBase64: resizedDataUrl })
            });

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || 'Error al guardar la imagen.');
            }

            setIconTimestamp(Date.now());
            setSuccessMessage('¡Icono de servidor (server-icon.png) actualizado con éxito a 64x64 PNG!');
            setTimeout(() => setSuccessMessage(''), 4500);
          } catch (err: any) {
            setErrorMessage(err.message || 'Error guardando el icono del servidor.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteIcon = async () => {
    try {
      await fetch(`/api/servers/${encodeURIComponent(server.name)}/icon`, { method: 'DELETE' });
      setIconTimestamp(Date.now());
      setSuccessMessage('Icono personalizado eliminado. Se utilizará la imagen predeterminada.');
      setTimeout(() => setSuccessMessage(''), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error eliminando el icono.');
    }
  };

  // Helper function to render Minecraft color codes in live preview
  const renderMotdPreview = (text: string) => {
    const parts = text.split(/(§[0-9a-fk-or])/g);
    let currentColorClass = 'text-white';
    let isBold = false;
    let isItalic = false;

    const colorMap: Record<string, string> = {
      '§0': 'text-black',
      '§1': 'text-blue-900',
      '§2': 'text-emerald-700',
      '§3': 'text-cyan-700',
      '§4': 'text-red-700',
      '§5': 'text-purple-700',
      '§6': 'text-amber-500',
      '§7': 'text-slate-300',
      '§8': 'text-slate-500',
      '§9': 'text-blue-500',
      '§a': 'text-emerald-400',
      '§b': 'text-cyan-400',
      '§c': 'text-rose-500',
      '§d': 'text-pink-400',
      '§e': 'text-yellow-300',
      '§f': 'text-white',
    };

    return parts.map((part, index) => {
      if (part.startsWith('§')) {
        const code = part.toLowerCase();
        if (colorMap[code]) {
          currentColorClass = colorMap[code];
        } else if (code === '§l') {
          isBold = true;
        } else if (code === '§o') {
          isItalic = true;
        } else if (code === '§r') {
          currentColorClass = 'text-white';
          isBold = false;
          isItalic = false;
        }
        return null;
      }

      return (
        <span 
          key={index} 
          className={`${currentColorClass} ${isBold ? 'font-bold' : ''} ${isItalic ? 'italic' : ''}`}
        >
          {part}
        </span>
      );
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (ramMinAllocated > ramAllocated) {
      setErrorMessage('La memoria RAM mínima no puede superar la memoria RAM máxima.');
      return;
    }

    setErrorMessage('');
    onUpdateConfig(server.name, {
      motd,
      gameMode,
      difficulty,
      pvp,
      spawnProtection,
      viewDistance,
      allowFlight,
      enableCommandBlocks,
      playersMax,
      worldName,
      whiteList,
      onlineMode,
      spawnAnimals,
      spawnMonsters,
      spawnNpcs,
      allowNether,
      forceGamemode,
      requireResourcePack,
      resourcePack,
      resourcePackPrompt,
      ramMinAllocated,
      ramAllocated
    });

    setSuccessMessage('¡Configuraciones guardadas y escritas directamente en `server.properties` y `config.json`!');
    setTimeout(() => {
      setSuccessMessage('');
    }, 4500);
  };

  const iconUrl = `/api/servers/${encodeURIComponent(server.name)}/icon?t=${iconTimestamp}`;

  return (
    <div className="space-y-6" id="mc-config-container">
      {/* Return button & Title */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-4" id="mc-config-header">
        <button 
          onClick={() => navigate(`/mc/${encodeURIComponent(server.name)}`)}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-850 transition"
          title="Volver"
          id="config-back-btn"
        >
          <ChevronLeft size={16} />
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight font-mono">
            Ajustes del Servidor: {server.name}
          </h2>
          <p className="text-sm text-slate-400">
            Administra las reglas principales en `server.properties`, icono de la lista, RAM y paquetes de recursos.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2.5 text-sm animate-fadeIn" id="config-success-banner">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-2.5 text-sm" id="config-error-banner">
          <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6" id="config-form">
        
        {/* Section 1: Custom Icon & MOTD Live Preview */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-5" id="config-section-icon-motd">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={16} className="text-indigo-400" />
            <span>Icono Personalizado y Descripción (MOTD)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            
            {/* Custom Icon Box */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3" id="server-icon-manager">
              <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Icono de la Lista de Servidores
              </span>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  <img 
                    src={iconUrl} 
                    alt="Icono del Servidor" 
                    className="w-16 h-16 object-cover"
                    onError={(e) => {
                      // Fallback SVG icon if server-icon.png does not exist
                      (e.target as HTMLElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent && !parent.querySelector('.fallback-icon')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'fallback-icon text-indigo-400 font-mono font-bold text-lg';
                        fallback.innerText = 'MC';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                <div className="space-y-2 text-xs">
                  <p className="text-[11px] text-slate-400">
                    Sube una imagen para `server-icon.png`. Se ajustará automáticamente a 64x64 píxeles.
                  </p>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleIconChange} 
                      accept="image/*" 
                      className="hidden" 
                      id="server-icon-file-input"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                      id="upload-icon-btn"
                    >
                      <Upload size={12} />
                      <span>Subir Icono</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteIcon}
                      className="p-1.5 bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded border border-slate-800 transition"
                      title="Eliminar Icono"
                      id="delete-icon-btn"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MOTD Input */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-400">
                  Mensaje del Día (Soporta códigos de color §)
                </label>
                <span className="text-[10px] text-slate-500">
                  Ej: §aVerde, §bCeleste, §cRojo, §eAmarillo, §lNegrita
                </span>
              </div>
              <input
                type="text"
                value={motd}
                onChange={(e) => setMotd(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                placeholder="§aServidor de Minecraft §e[v1.21]§r"
                id="motd-input"
              />

              {/* Minecraft Client Live Preview Box */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Vista previa en Minecraft:</span>
                <div className="bg-black/95 p-3.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-sm shadow-inner" id="motd-preview-box">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      <img 
                        src={iconUrl} 
                        alt="MC" 
                        className="w-10 h-10 object-cover" 
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-bold text-sm truncate">{server.name}</span>
                      </div>
                      <p className="text-xs truncate max-w-[280px] sm:max-w-md">
                        {renderMotdPreview(motd)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 pl-2">
                    <span className="text-emerald-500 text-xs block">📶</span>
                    <span className="text-slate-500 text-[10px] block font-mono">0/{playersMax}</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Section 2: RAM Memory Allocation */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4" id="config-section-ram">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <HardDrive size={16} className="text-indigo-400" />
            <span>Asignación de Memoria RAM (-Xms / -Xmx)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Minimum RAM */}
            <div className="space-y-1.5 bg-slate-950 p-4 rounded-xl border border-slate-850">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  RAM Mínima (-Xms)
                </label>
                <span className="text-indigo-400 font-mono text-xs font-bold">{ramMinAllocated} GB</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.5"
                value={ramMinAllocated}
                onChange={(e) => setRamMinAllocated(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
                id="ram-min-range"
              />
              <p className="text-[10px] text-slate-500">
                Memoria asignada al iniciar el proceso (`-Xms${Math.round(ramMinAllocated * 1024)}M`).
              </p>
            </div>

            {/* Maximum RAM */}
            <div className="space-y-1.5 bg-slate-950 p-4 rounded-xl border border-slate-850">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  RAM Máxima (-Xmx)
                </label>
                <span className="text-indigo-400 font-mono text-xs font-bold">{ramAllocated} GB</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                step="0.5"
                value={ramAllocated}
                onChange={(e) => setRamAllocated(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
                id="ram-max-range"
              />
              <p className="text-[10px] text-slate-500">
                Límite máximo de memoria Java (`-Xmx${Math.round(ramAllocated * 1024)}M`).
              </p>
            </div>

          </div>
        </div>

        {/* Section 3: Core Server Rules (server.properties) */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4" id="config-section-rules">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders size={16} className="text-indigo-400" />
            <span>Reglas Principales del Servidor (`server.properties`)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Game Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Modo de Juego (`gamemode`)
              </label>
              <select
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm capitalize font-mono"
                id="gamemode-select"
              >
                <option value="survival">Supervivencia (Survival)</option>
                <option value="creative">Creativo (Creative)</option>
                <option value="adventure">Aventura (Adventure)</option>
                <option value="spectator">Espectador (Spectator)</option>
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Dificultad (`difficulty`)
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm capitalize font-mono"
                id="difficulty-select"
              >
                <option value="peaceful">Pacífico (Peaceful)</option>
                <option value="easy">Fácil (Easy)</option>
                <option value="normal">Normal</option>
                <option value="hard">Difícil (Hard)</option>
              </select>
            </div>

            {/* Max Players */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Jugadores Máximos (`max-players`)
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={playersMax}
                onChange={(e) => setPlayersMax(parseInt(e.target.value) || 20)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                id="playersmax-input"
              />
            </div>

            {/* View Distance */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>Distancia de Visión (`view-distance`)</span>
                <span className="text-indigo-400 font-mono">{viewDistance} Chunks</span>
              </div>
              <input
                type="range"
                min="4"
                max="16"
                step="1"
                value={viewDistance}
                onChange={(e) => setViewDistance(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
                id="viewdistance-range"
              />
            </div>

            {/* Spawn Protection */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>Protección de Spawn (`spawn-protection`)</span>
                <span className="text-indigo-400 font-mono">{spawnProtection} bloques</span>
              </div>
              <input
                type="range"
                min="0"
                max="64"
                step="4"
                value={spawnProtection}
                onChange={(e) => setSpawnProtection(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
                id="spawnprotection-range"
              />
            </div>

          </div>

          {/* Toggle Switches Grid for Rules */}
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" id="toggles-grid">
            
            {/* Whitelist */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Lista Blanca (`white-list`)</span>
                <span className="text-[10px] text-slate-500">Solo usuarios autorizados</span>
              </div>
              <input 
                type="checkbox" 
                checked={whiteList} 
                onChange={(e) => setWhiteList(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="whitelist-checkbox"
              />
            </label>

            {/* Online Mode */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Modo Online (`online-mode`)</span>
                <span className="text-[10px] text-slate-500">Autenticación oficial Mojang</span>
              </div>
              <input 
                type="checkbox" 
                checked={onlineMode} 
                onChange={(e) => setOnlineMode(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="onlinemode-checkbox"
              />
            </label>

            {/* PVP Toggle */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Permitir PVP (`pvp`)</span>
                <span className="text-[10px] text-slate-500">Combate entre jugadores</span>
              </div>
              <input 
                type="checkbox" 
                checked={pvp} 
                onChange={(e) => setPvp(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="pvp-checkbox"
              />
            </label>

            {/* Command Blocks Toggle */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Bloques de Comandos (`enable-command-block`)</span>
                <span className="text-[10px] text-slate-500">Habilitar ejecución</span>
              </div>
              <input 
                type="checkbox" 
                checked={enableCommandBlocks} 
                onChange={(e) => setEnableCommandBlocks(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="commandblocks-checkbox"
              />
            </label>

            {/* Allow Flight */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Permitir Vuelo (`allow-flight`)</span>
                <span className="text-[10px] text-slate-500">Previene patadas por vuelo</span>
              </div>
              <input 
                type="checkbox" 
                checked={allowFlight} 
                onChange={(e) => setAllowFlight(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="allowflight-checkbox"
              />
            </label>

            {/* Spawn Animals */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Generar Animales (`spawn-animals`)</span>
                <span className="text-[10px] text-slate-500">Vacas, cerdos, ovejas...</span>
              </div>
              <input 
                type="checkbox" 
                checked={spawnAnimals} 
                onChange={(e) => setSpawnAnimals(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="spawnanimals-checkbox"
              />
            </label>

            {/* Spawn Monsters */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Generar Monstruos (`spawn-monsters`)</span>
                <span className="text-[10px] text-slate-500">Zombies, creepers, esqueletos</span>
              </div>
              <input 
                type="checkbox" 
                checked={spawnMonsters} 
                onChange={(e) => setSpawnMonsters(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="spawnmonsters-checkbox"
              />
            </label>

            {/* Spawn NPCs */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Generar Aldeanos (`spawn-npcs`)</span>
                <span className="text-[10px] text-slate-500">Aldeanos en aldeas</span>
              </div>
              <input 
                type="checkbox" 
                checked={spawnNpcs} 
                onChange={(e) => setSpawnNpcs(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="spawnnpcs-checkbox"
              />
            </label>

            {/* Allow Nether */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Permitir Nether (`allow-nether`)</span>
                <span className="text-[10px] text-slate-500">Portales al Nether</span>
              </div>
              <input 
                type="checkbox" 
                checked={allowNether} 
                onChange={(e) => setAllowNether(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="allownether-checkbox"
              />
            </label>

            {/* Force Gamemode */}
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Forzar Modo de Juego (`force-gamemode`)</span>
                <span className="text-[10px] text-slate-500">Aplica gamemode al unirse</span>
              </div>
              <input 
                type="checkbox" 
                checked={forceGamemode} 
                onChange={(e) => setForceGamemode(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="forcegamemode-checkbox"
              />
            </label>

          </div>
        </div>

        {/* Section 4: Resource Pack Settings */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4" id="config-section-resourcepack">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Package size={16} className="text-indigo-400" />
            <span>Ajustes de Paquete de Recursos (`resource-pack`)</span>
          </h3>

          <div className="space-y-4">
            
            <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850 cursor-pointer hover:bg-slate-900 transition max-w-md">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Requerir Paquete (`require-resource-pack`)</span>
                <span className="text-[10px] text-slate-500">Obliga a aceptar el paquete para entrar</span>
              </div>
              <input 
                type="checkbox" 
                checked={requireResourcePack} 
                onChange={(e) => setRequireResourcePack(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-800 bg-slate-950 focus:ring-indigo-500 accent-indigo-500"
                id="requireresourcepack-checkbox"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  URL del Paquete de Recursos (`resource-pack`)
                </label>
                <input
                  type="text"
                  value={resourcePack}
                  onChange={(e) => setResourcePack(e.target.value.trim())}
                  placeholder="https://ejemplo.com/resourcepack.zip"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                  id="resourcepack-url-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Mensaje del Paquete (`resource-pack-prompt`)
                </label>
                <input
                  type="text"
                  value={resourcePackPrompt}
                  onChange={(e) => setResourcePackPrompt(e.target.value)}
                  placeholder="Mensaje personalizado para la descarga del paquete"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                  id="resourcepack-prompt-input"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Section 5: World Config */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4" id="config-section-world">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Database size={16} className="text-indigo-400" />
            <span>Mundo (`level-name`)</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Nombre de la Carpeta del Mundo (`level-name`)
            </label>
            <input
              type="text"
              value={worldName}
              onChange={(e) => setWorldName(e.target.value.trim().replace(/\s+/g, '_'))}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
              required
              id="worldname-input"
            />
          </div>
        </div>

        {/* Form Submit Footer */}
        <div className="flex justify-end space-x-3 pt-2" id="config-form-footer">
          <button
            type="button"
            onClick={() => navigate(`/mc/${encodeURIComponent(server.name)}`)}
            className="px-5 py-2.5 border border-slate-800 bg-slate-900 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-800 hover:text-white transition"
            id="cancel-settings-btn"
          >
            Descartar cambios
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-100 text-sm font-semibold rounded-lg shadow transition flex items-center gap-1.5"
            id="save-settings-btn"
          >
            <Save size={15} />
            <span>Guardar Ajustes</span>
          </button>
        </div>

      </form>
    </div>
  );
}

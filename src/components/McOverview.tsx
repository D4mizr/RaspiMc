/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Layers, 
  Terminal, 
  Settings, 
  Plus, 
  UploadCloud, 
  Play, 
  Square, 
  Search, 
  Compass, 
  Globe2, 
  X, 
  CheckCircle,
  Database,
  Trash2,
  HardDrive,
  Download,
  AlertCircle,
  Folder
} from 'lucide-react';
import { MinecraftServer } from '../types';
import { PlayerModal } from './PlayerModal';
import { ServerFilesModal } from './ServerFilesModal';

interface McOverviewProps {
  servers: MinecraftServer[];
  downloadTasks?: Array<{ id: string; serverName: string; percent: number; message: string; status: string }>;
  onStartServer: (name: string) => void;
  onStopServer: (name: string) => void;
  onInstallServer: (server: MinecraftServer) => void;
  onDeleteServer: (name: string) => void;
  onSelectServer: (name: string) => void;
  navigate: (path: string) => void;
}

export default function McOverview({
  servers,
  downloadTasks,
  onStartServer,
  onStopServer,
  onInstallServer,
  onDeleteServer,
  onSelectServer,
  navigate
}: McOverviewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isDraggingModpack, setIsDraggingModpack] = useState(false);
  const [modpackSuccessMessage, setModpackSuccessMessage] = useState('');
  const [serverToDelete, setServerToDelete] = useState<string | null>(null);
  const [playerModal, setPlayerModal] = useState<{ serverName: string; playerName: string } | null>(null);
  const [fileBrowserServer, setFileBrowserServer] = useState<string | null>(null);

  // Install server form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'Vanilla' | 'Paper' | 'Forge' | 'Fabric'>('Paper');
  const [formVersion, setFormVersion] = useState('1.21.1');
  const [formRam, setFormRam] = useState(3.0);
  const [formMotd, setFormMotd] = useState('A RaspiMC server -- Kai');
  const [formSeed, setFormSeed] = useState('');
  const [formWorldType, setFormWorldType] = useState<'DEFAULT' | 'FLAT' | 'LARGE_BIOMES' | 'AMPLIFIED'>('DEFAULT');
  const [formWhitelist, setFormWhitelist] = useState(false);
  const [formOnlineMode, setFormOnlineMode] = useState(true);
  const [isDownloadingJar, setIsDownloadingJar] = useState(false);
  const [installError, setInstallError] = useState('');

  // Dynamic versions loaded from API
  const [availableVersions, setAvailableVersions] = useState<string[]>(['1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2']);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Fetch available versions dynamically when the chosen server type changes
  useEffect(() => {
    if (!showInstallModal) return;
    setIsLoadingVersions(true);
    fetch(`/api/servers/versions?type=${formType}`)
      .then((res) => {
        if (!res.ok) throw new Error('API versions failed');
        return res.json();
      })
      .then((data) => {
        if (data.versions && data.versions.length > 0) {
          setAvailableVersions(data.versions);
          setFormVersion(data.versions[0]);
        }
      })
      .catch((err) => {
        console.warn('Utilizando versiones fallback por desconexión de API:', err);
      })
      .finally(() => setIsLoadingVersions(false));
  }, [formType, showInstallModal]);

  const filteredServers = servers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compute stats
  const totalServers = servers.length;
  const activeServers = servers.filter(s => s.status === 'online').length;
  const totalPlayersOnline = servers.reduce((sum, s) => sum + s.playersOnline, 0);
  const totalRamAllocated = servers.reduce((sum, s) => sum + s.ramAllocated, 0);

  const handleInstallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const cleanedName = formName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const finalSeed = formSeed.trim() || Math.floor(Math.random() * 99999999999999).toString();

    const newServer: any = {
      name: cleanedName,
      status: 'offline',
      version: formVersion,
      type: formType,
      ip: '127.0.0.1',
      port: 25565,
      playersMax: 20,
      playersOnline: 0,
      playersList: [],
      motd: formMotd,
      worldName: 'world',
      worldSeed: finalSeed,
      gameMode: 'survival',
      difficulty: 'normal',
      pvp: true,
      spawnProtection: 16,
      viewDistance: 10,
      allowFlight: false,
      enableCommandBlocks: true,
      ramAllocated: formRam,
    };

    // Close modal immediately and trigger non-blocking corner download flow
    setShowInstallModal(false);
    onInstallServer(newServer);

    // Reset Form
    setFormName('');
    setFormType('Paper');
    setFormVersion('1.21.1');
    setFormRam(3.0);
    setFormMotd('A RaspiMC server -- Kai');
    setFormSeed('');
    setFormWorldType('DEFAULT');
    setFormWhitelist(false);
    setFormOnlineMode(true);
  };

  // Drag and drop modpack simulators
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingModpack(true);
  };

  const handleDragLeave = () => {
    setIsDraggingModpack(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingModpack(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setModpackSuccessMessage(`¡Modpack "${files[0].name}" importado con éxito!`);
      setTimeout(() => setModpackSuccessMessage(''), 6000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setModpackSuccessMessage(`¡Modpack "${files[0].name}" cargado con éxito!`);
      setTimeout(() => setModpackSuccessMessage(''), 6000);
    }
  };

  return (
    <div className="space-y-6" id="mc-overview-container">
      {/* Overview Stat Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="mc-stats-summary">
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
            <Server size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Servidores</p>
            <p className="text-xl font-bold text-slate-100 font-mono">{totalServers}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
            <CheckCircle size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Activos</p>
            <p className="text-xl font-bold text-slate-100 font-mono">{activeServers}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex items-center space-x-3.5">
          <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
            <Globe2 size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Jugadores</p>
            <p className="text-xl font-bold text-slate-100 font-mono">{totalPlayersOnline}</p>
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
            <Database size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">RAM Asignada</p>
            <p className="text-xl font-bold text-slate-100 font-mono">{totalRamAllocated.toFixed(1)} GB</p>
          </div>
        </div>
      </div>

      {/* Action panel & search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4" id="mc-actions-panel">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar servidor..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-medium focus:border-indigo-500"
            id="mc-search-input"
          />
        </div>

        <div className="flex w-full md:w-auto gap-3">
          <button 
            onClick={() => setShowInstallModal(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition cursor-pointer"
            id="open-install-modal-btn"
          >
            <Plus size={16} />
            <span>Instalar Servidor</span>
          </button>
        </div>
      </div>

      {/* Modpack Feedback Banner */}
      {modpackSuccessMessage && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-3 rounded-lg flex items-center gap-2.5 text-sm animate-fadeIn" id="modpack-banner">
          <CheckCircle size={16} className="text-indigo-400" />
          <span>{modpackSuccessMessage}</span>
        </div>
      )}

      {/* Servers list / cards layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="mc-main-grid">
        {/* Left side: List of servers (takes 2 columns) */}
        <div className="lg:col-span-2 space-y-4" id="servers-list">
          {filteredServers.length > 0 ? (
            filteredServers.map((server) => {
              const isOnline = server.status === 'online';
              const isOffline = server.status === 'offline';
              const isStarting = server.status === 'starting';
              const isStopping = server.status === 'stopping';
              const isInstalled = server.installed !== false;
              const activeDownload = downloadTasks?.find((t) => t.serverName === server.name);

              return (
                <div 
                  key={server.name}
                  className={`bg-slate-900/40 rounded-2xl border transition flex flex-col md:flex-row items-stretch overflow-hidden group hover:bg-slate-900/60 ${
                    isOnline ? 'border-indigo-500/30 shadow-sm shadow-indigo-500/[0.02]' :
                    isStarting ? 'border-amber-500/20 border-dashed animate-pulse' : 
                    !isInstalled ? 'border-amber-500/30' : 'border-slate-800'
                  }`}
                  id={`server-card-${server.name}`}
                >
                  {/* Visual Left Status Accent */}
                  <div className={`w-2.5 md:w-3 flex-shrink-0 ${
                    isOnline ? 'bg-indigo-500 shadow-md shadow-indigo-500/20' :
                    isStarting ? 'bg-amber-400 animate-pulse' :
                    isStopping ? 'bg-amber-500' :
                    !isInstalled ? 'bg-amber-500/80' : 'bg-slate-700'
                  }`} />

                  {/* Server Details Grid */}
                  <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                    <div>
                      {/* Title row */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2.5">
                          {/* Server Icon Thumbnail */}
                          <div className="w-8 h-8 rounded bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                            <img 
                              src={`/api/servers/${encodeURIComponent(server.name)}/icon`} 
                              alt="MC" 
                              className="w-8 h-8 object-cover" 
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>

                          <h3 
                            onClick={() => { onSelectServer(server.name); navigate(`/mc/${encodeURIComponent(server.name)}`); }}
                            className="text-base sm:text-lg font-bold text-slate-100 hover:text-indigo-400 cursor-pointer font-mono truncate max-w-[200px] sm:max-w-[250px]"
                            title="Ver detalles"
                          >
                            {server.name}
                          </h3>
                          <span className="text-[10px] bg-slate-850 text-slate-300 border border-slate-750 px-2 py-0.5 rounded font-semibold font-mono">
                            v{server.version}
                          </span>
                          {!isInstalled && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-semibold font-mono flex items-center gap-1">
                              <Download size={10} className="animate-bounce" />
                              <span>{activeDownload ? `Descargando ${activeDownload.percent}%` : 'No Instalado'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Motd & Connection Address */}
                      <p className="mt-2 text-xs font-mono text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded border border-slate-850/80 truncate">
                        {server.motd.replace(/§[a-z0-9]/gi, '')}
                      </p>

                      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Motor/Tipo</span>
                          <span className="font-semibold">{server.type}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Puerto</span>
                          <span className="font-mono font-medium text-slate-200">{server.port}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Jugadores</span>
                          <span className="font-semibold">{server.playersOnline} / {server.playersMax}</span>
                        </div>
                      </div>

                      {/* Active Players Chips */}
                      {server.playersOnline > 0 && server.playersList && server.playersList.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-850/60">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">
                            Activos ({server.playersList.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {server.playersList.map((p) => (
                              <button
                                key={p}
                                onClick={() => setPlayerModal({ serverName: server.name, playerName: p })}
                                className="inline-flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 px-2 py-0.5 rounded text-[11px] font-mono transition"
                                title="Ver detalles y coordenadas del jugador"
                                id={`player-chip-${server.name}-${p}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span>{p}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Operational Buttons */}
                    <div className="pt-4 border-t border-slate-850 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex space-x-2">
                        {!isInstalled ? (
                          <button
                            disabled
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 border border-amber-500/30 text-amber-400/90 text-xs font-semibold rounded-lg cursor-not-allowed opacity-90 shadow"
                            title="El botón Iniciar está deshabilitado hasta que el servidor esté totalmente instalado (.jar descargado)."
                            id={`start-server-btn-${server.name}`}
                          >
                            {activeDownload ? (
                              <>
                                <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
                                <span>Instalando ({activeDownload.percent}%)</span>
                              </>
                            ) : (
                              <>
                                <Download size={12} className="text-amber-400 shrink-0" />
                                <span>Pendiente .jar</span>
                              </>
                            )}
                          </button>
                        ) : isOffline ? (
                          <button
                            onClick={() => onStartServer(server.name)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-slate-100 text-xs font-bold rounded-lg shadow transition cursor-pointer"
                            id={`start-server-btn-${server.name}`}
                          >
                            <Play size={12} fill="currentColor" />
                            <span>Iniciar</span>
                          </button>
                        ) : null}

                        {isOnline && (
                          <button
                            onClick={() => onStopServer(server.name)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition cursor-pointer"
                            id={`stop-server-btn-${server.name}`}
                          >
                            <Square size={12} fill="currentColor" />
                            <span>Detener</span>
                          </button>
                        )}

                        {(isStarting || isStopping) && (
                          <button
                            disabled
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-slate-400 cursor-not-allowed text-xs font-semibold rounded-lg border border-slate-700"
                            id={`busy-server-btn-${server.name}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            <span>Procesando</span>
                          </button>
                        )}

                        <button
                          onClick={() => { onSelectServer(server.name); navigate(`/mc/${encodeURIComponent(server.name)}/console`); }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                          id={`console-server-btn-${server.name}`}
                        >
                          <Terminal size={12} />
                          <span>Consola</span>
                        </button>

                        <button
                          onClick={() => setFileBrowserServer(server.name)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 text-xs font-semibold rounded-lg transition cursor-pointer"
                          id={`files-server-btn-${server.name}`}
                          title="Explorador de Archivos del Servidor"
                        >
                          <Folder size={12} className="text-indigo-400" />
                          <span>Archivos</span>
                        </button>

                        <button
                          onClick={() => { onSelectServer(server.name); navigate(`/mc/${encodeURIComponent(server.name)}/config`); }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                          id={`config-server-btn-${server.name}`}
                        >
                          <Settings size={12} />
                          <span>Ajustes</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setServerToDelete(server.name)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition cursor-pointer"
                        title="Borrar servidor"
                        id={`delete-server-btn-${server.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-800 text-center" id="empty-servers">
              <Server size={40} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-400">No se encontraron servidores</p>
              <p className="text-xs text-slate-500 mt-1">Prueba a buscar otro término o instala uno nuevo.</p>
            </div>
          )}
        </div>

        {/* Right side helper cards: Import modpack box & tips */}
        <div className="space-y-6" id="mc-sidebar-panels">
          {/* Import Modpack Box */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-slate-900/40 rounded-2xl border p-6 transition text-center flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden ${
              isDraggingModpack 
                ? 'border-indigo-500 bg-indigo-500/5 border-dashed scale-102' 
                : 'border-slate-800 hover:border-slate-700 border-dashed'
            }`}
            id="drag-modpack-panel"
          >
            <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full mb-3">
              <UploadCloud size={24} />
            </div>
            <h4 className="font-bold text-slate-200 text-sm">Importar Modpack / ZIP</h4>
            <p className="text-xs text-slate-400 mt-1.5 max-w-[200px]">
              Arrastra tu modpack en formato `.zip` o selecciona un archivo para importarlo.
            </p>

            <label className="mt-4 px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-300 text-xs font-semibold rounded-lg shadow cursor-pointer transition">
              <span>Seleccionar archivo</span>
              <input 
                type="file" 
                accept=".zip" 
                onChange={handleFileSelect} 
                className="hidden" 
                id="file-modpack-input"
              />
            </label>
          </div>

          {/* Quick Info & Tips */}
          <div className="bg-slate-900/40 text-slate-300 p-6 rounded-2xl border border-slate-800" id="mc-info-tips-panel">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5 mb-2.5">
              <Compass size={16} className="text-indigo-400" />
              <span>Consejo del Administrador</span>
            </h4>
            <div className="text-xs space-y-2.5 leading-relaxed text-slate-400">
              <p>
                Cada servidor de Minecraft asigna una porción fija de la RAM de tu PC. Asegúrate de no exceder los límites totales del sistema operativo.
              </p>
              <div className="p-2 bg-slate-950 rounded border border-slate-850 flex items-center gap-2">
                <HardDrive size={14} className="text-indigo-400" />
                <span className="font-mono text-[10px] text-slate-300">Servidores en ./servers/*</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Install Server Modal Component */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="install-server-modal">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                <Plus size={18} className="text-indigo-400" />
                <span>Instalar Nuevo Servidor</span>
              </h3>
              <button 
                onClick={() => setShowInstallModal(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-md transition cursor-pointer"
                id="close-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleInstallSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nombre del Servidor
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Survival_Con_Amigos"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                  required
                  id="form-server-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Motor del Servidor
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                    id="form-server-type"
                  >
                    <option value="Paper">Paper / Spigot (Recomendado)</option>
                    <option value="Vanilla">Vanilla (Oficial)</option>
                    <option value="Fabric">Fabric (Modded Ligero)</option>
                    <option value="Forge">Forge (Modded Pesado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Versión de Minecraft {isLoadingVersions && <span className="text-[9px] text-indigo-400 animate-pulse ml-1">(Buscando...)</span>}
                  </label>
                  <select
                    value={formVersion}
                    onChange={(e) => setFormVersion(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                    id="form-server-version"
                    disabled={isLoadingVersions}
                  >
                    {availableVersions.map(ver => (
                      <option key={ver} value={ver}>{ver}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Semilla del Mundo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formSeed}
                    onChange={(e) => setFormSeed(e.target.value)}
                    placeholder="Aleatoria"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                    id="form-server-seed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Tipo de Mundo
                  </label>
                  <select
                    value={formWorldType}
                    onChange={(e) => setFormWorldType(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                    id="form-server-world-type"
                  >
                    <option value="DEFAULT">Normal (Estándar)</option>
                    <option value="FLAT">Plano (Creative)</option>
                    <option value="LARGE_BIOMES">Biomas Grandes</option>
                    <option value="AMPLIFIED">Amplificado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  RAM Asignada (GB): <strong className="text-indigo-400">{formRam.toFixed(1)} GB</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={formRam}
                  onChange={(e) => setFormRam(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                  id="form-server-ram"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>1.0 GB</span>
                  <span>4.0 GB (Promedio)</span>
                  <span>8.0 GB (Límite sugerido)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Descripción (MOTD)
                </label>
                <input
                  type="text"
                  value={formMotd}
                  onChange={(e) => setFormMotd(e.target.value)}
                  placeholder="Ej. Servidor de Minecraft v1.21.1"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  id="form-server-motd"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formWhitelist}
                    onChange={(e) => setFormWhitelist(e.target.checked)}
                    className="rounded text-indigo-600 border-slate-800 bg-slate-900 focus:ring-indigo-500 accent-indigo-500"
                  />
                  <div>
                    <span className="font-semibold block">Lista Blanca</span>
                    <span className="text-[10px] text-slate-500">Solo usuarios permitidos</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formOnlineMode}
                    onChange={(e) => setFormOnlineMode(e.target.checked)}
                    className="rounded text-indigo-600 border-slate-800 bg-slate-900 focus:ring-indigo-500 accent-indigo-500"
                  />
                  <div>
                    <span className="font-semibold block">Verificar Premium</span>
                    <span className="text-[10px] text-slate-500">Online Mode (Seguridad)</span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="px-4 py-2 border border-slate-800 bg-slate-900 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  id="cancel-install-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-100 text-sm font-semibold rounded-lg shadow transition cursor-pointer flex items-center gap-2"
                  id="confirm-install-btn"
                >
                  <Plus size={16} />
                  <span>Crear e Iniciar Descarga</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Server Confirmation Disclaimer Modal */}
      {serverToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-scaleIn relative">
            <button
              onClick={() => setServerToDelete(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Trash2 size={22} />
              </div>
              <h3 className="text-lg font-bold text-slate-100">¿Eliminar Servidor?</h3>
            </div>

            <div className="text-xs text-slate-300 space-y-3">
              <p>
                Está a punto de eliminar permanentemente el servidor <span className="font-bold font-mono text-rose-300">{serverToDelete}</span>.
              </p>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 space-y-1">
                <p className="font-semibold">⚠️ Advertencia de eliminación completa:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  <li>Se borrará toda la carpeta <code className="text-rose-200 font-mono">./servers/{serverToDelete}/</code></li>
                  <li>Se eliminarán todos los mundos guardados y mapas.</li>
                  <li>Se borrarán las configuraciones, logs y el binario JAR.</li>
                  <li><strong>Esta acción es irreversible y no se puede deshacer.</strong></li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setServerToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const target = serverToDelete;
                  setServerToDelete(null);
                  onDeleteServer(target);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow"
              >
                <Trash2 size={14} />
                <span>Sí, Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Modal */}
      {playerModal && (
        <PlayerModal
          serverName={playerModal.serverName}
          playerName={playerModal.playerName}
          isOpen={!!playerModal}
          onClose={() => setPlayerModal(null)}
        />
      )}

      {/* Server Files Modal */}
      {fileBrowserServer && (
        <ServerFilesModal
          serverName={fileBrowserServer}
          isOpen={!!fileBrowserServer}
          onClose={() => setFileBrowserServer(null)}
        />
      )}

    </div>
  );
}

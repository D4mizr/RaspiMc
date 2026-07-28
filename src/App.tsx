/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, CheckCircle, X } from 'lucide-react';
import { useRouter } from './useRouter';
import Layout from './components/Layout';
import PiStatus from './components/PiStatus';
import McOverview from './components/McOverview';
import McDetail from './components/McDetail';
import McConfig from './components/McConfig';
import McConsole from './components/McConsole';
import McLogs from './components/McLogs';
import SettingsPage from './components/SettingsPage';
import { MinecraftServer, ConsoleLog, SystemStatus, DownloadTask } from './types';

export default function App() {
  const { route, navigate } = useRouter();

  // Core System & Server States (Real data sourced from local APIs)
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    cpuUsage: 0,
    cpuHistory: Array(12).fill(0),
    ramTotal: 16.0,
    ramUsed: 0.0,
    storageTotal: 512.0,
    storageUsed: 0.0,
    temperature: null,
    uptime: '',
    ipAddress: '127.0.0.1',
    ethernetConnected: true,
    dataSourceStatus: 'live'
  });

  const [minecraftServers, setMinecraftServers] = useState<MinecraftServer[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<Record<string, ConsoleLog[]>>({});
  const [selectedServerName, setSelectedServerName] = useState<string>('');
  const [eulaPendingServer, setEulaPendingServer] = useState<MinecraftServer | null>(null);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);

  // 1. Fetch real-time system metrics (CPU, Memory, Storage) from the API
  const fetchSystemStatus = () => {
    fetch('/api/system/status')
      .then((res) => {
        if (!res.ok) throw new Error('Error de conexión con el API backend');
        return res.json();
      })
      .then((data) => {
        setSystemStatus((prev) => {
          if (
            prev.cpuUsage === data.cpuUsage &&
            prev.ramUsed === data.ramUsed &&
            prev.ethernetConnected === data.ethernetConnected &&
            prev.ipAddress === data.ipAddress &&
            prev.wifiSsid === data.wifiSsid
          ) {
            return prev;
          }
          return data;
        });
      })
      .catch((err) => console.warn('Daemon offline:', err));
  };

  // 2. Fetch list of managed Minecraft servers from the directory
  const fetchServers = () => {
    fetch('/api/servers')
      .then((res) => {
        if (!res.ok) throw new Error('Error al listar servidores');
        return res.json();
      })
      .then((data) => {
        setMinecraftServers((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(data)) {
            return prev;
          }
          return data;
        });
        if (data.length > 0 && !selectedServerName) {
          // Auto-select first server if none selected
          setSelectedServerName(data[0].name);
        }
      })
      .catch((err) => console.warn('Error fetching servers:', err));
  };

  // 3. Fetch logs/console lines for the active server
  const fetchConsoleLogs = () => {
    if (!selectedServerName) return;
    fetch(`/api/servers/${encodeURIComponent(selectedServerName)}/console`)
      .then((res) => res.json())
      .then((data) => {
        setConsoleLogs((prev) => {
          const currentLogs = prev[selectedServerName];
          const newLogs = data.logs || [];
          if (
            currentLogs &&
            currentLogs.length === newLogs.length &&
            currentLogs.length > 0 &&
            currentLogs[currentLogs.length - 1]?.message === newLogs[newLogs.length - 1]?.message
          ) {
            return prev;
          }
          return {
            ...prev,
            [selectedServerName]: newLogs
          };
        });
      })
      .catch((err) => console.warn('Error fetching console logs:', err));
  };

  // Polling intervals for responsive real-time metrics and consoles
  useEffect(() => {
    document.title = 'RaspiMC';
    fetchSystemStatus();
    fetchServers();

    const systemInterval = setInterval(fetchSystemStatus, 3000);
    const serverInterval = setInterval(fetchServers, 4000);

    return () => {
      clearInterval(systemInterval);
      clearInterval(serverInterval);
    };
  }, []);

  useEffect(() => {
    if (selectedServerName) {
      fetchConsoleLogs();
      const consoleInterval = setInterval(fetchConsoleLogs, 1500);
      return () => clearInterval(consoleInterval);
    }
  }, [selectedServerName]);

  const currentServer = minecraftServers.find((s) => s.name === selectedServerName) || (minecraftServers.length > 0 ? minecraftServers[0] : null);

  // Server Process Controls
  const handleStartServer = (name: string, overrideAcceptEula = false) => {
    const targetServer = minecraftServers.find((s) => s.name === name);

    // If EULA is not yet accepted and user hasn't confirmed via modal, prompt EULA modal
    if (targetServer && !targetServer.eulaAccepted && !overrideAcceptEula) {
      setEulaPendingServer(targetServer);
      return;
    }

    fetch(`/api/servers/${encodeURIComponent(name)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acceptEula: overrideAcceptEula })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error === 'EULA_REQUIRED' && targetServer) {
          setEulaPendingServer(targetServer);
          return;
        }
        fetchServers();
        fetchConsoleLogs();
      })
      .catch((err) => console.error('Error starting server:', err));
  };

  const handleAcceptEulaAndStart = () => {
    if (!eulaPendingServer) return;
    const targetName = eulaPendingServer.name;
    setEulaPendingServer(null);
    handleStartServer(targetName, true);
  };

  const handleRejectEula = () => {
    setEulaPendingServer(null);
  };

  const handleStopServer = (name: string) => {
    fetch(`/api/servers/${encodeURIComponent(name)}/stop`, { method: 'POST' })
      .then((res) => res.json())
      .then(() => {
        fetchServers();
        fetchConsoleLogs();
      })
      .catch((err) => console.error('Error stopping server:', err));
  };

  const handleCreateServerDownload = async (serverData: Partial<MinecraftServer>) => {
    const taskId = `${serverData.name}-${Date.now()}`;
    const initialTask: DownloadTask = {
      id: taskId,
      serverName: serverData.name || 'Servidor',
      type: serverData.type || 'Paper',
      version: serverData.version || '1.20.1',
      percent: 5,
      status: 'resolving',
      message: `Consultando API de ${serverData.type} ${serverData.version}...`
    };

    // Optimistically register server card immediately as non-installed so user sees progress
    if (serverData.name) {
      const tempServer: MinecraftServer = {
        name: serverData.name,
        status: 'offline',
        installed: false,
        version: serverData.version || '1.20.1',
        type: (serverData.type as any) || 'Paper',
        ip: '127.0.0.1',
        port: 25565,
        playersMax: 20,
        playersOnline: 0,
        playersList: [],
        motd: serverData.motd || 'A RaspiMC server -- Kai',
        worldName: 'world',
        worldSeed: serverData.worldSeed || '12345',
        gameMode: 'survival',
        difficulty: 'normal',
        pvp: true,
        spawnProtection: 16,
        viewDistance: 10,
        allowFlight: false,
        enableCommandBlocks: false,
        ramAllocated: serverData.ramAllocated || 2,
        eulaAccepted: false
      };

      setMinecraftServers((prev) => {
        const exists = prev.some((s) => s.name === tempServer.name);
        if (exists) {
          return prev.map((s) => (s.name === tempServer.name ? { ...s, installed: false } : s));
        }
        return [...prev, tempServer];
      });
    }

    setDownloadTasks((prev) => [...prev, initialTask]);

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData)
      });

      if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Error al solicitar creación del servidor');
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No se pudo establecer flujo de datos con el servidor.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const line of parts) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.status === 'error') {
                setDownloadTasks((prev) =>
                  prev.map((t) =>
                    t.id === taskId
                      ? { ...t, status: 'error', error: data.error, message: `Error: ${data.error}` }
                      : t
                  )
                );
              } else if (data.status === 'complete') {
                setDownloadTasks((prev) =>
                  prev.map((t) =>
                    t.id === taskId
                      ? { ...t, status: 'complete', percent: 100, message: '¡Servidor creado e instalado con éxito!' }
                      : t
                  )
                );
                // Mark server as installed in state and trigger full fetch
                if (serverData.name) {
                  setMinecraftServers((prev) =>
                    prev.map((s) => (s.name === serverData.name ? { ...s, installed: true } : s))
                  );
                }
                fetchServers();
                if (serverData.name) {
                  setSelectedServerName(serverData.name);
                }
                setTimeout(() => {
                  setDownloadTasks((prev) => prev.filter((t) => t.id !== taskId));
                }, 5000);
              } else {
                setDownloadTasks((prev) =>
                  prev.map((t) =>
                    t.id === taskId
                      ? {
                          ...t,
                          status: data.status,
                          percent: data.percent ?? t.percent,
                          message: data.message || t.message
                        }
                      : t
                  )
                );
              }
            } catch (_) {}
          }
        }
      }
    } catch (err: any) {
      setDownloadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'error', error: err.message, message: `Error: ${err.message}` }
            : t
        )
      );
    }
  };

  const handleDeleteServer = (name: string) => {
    fetch(`/api/servers/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al eliminar el servidor');
        return res.json();
      })
      .then(() => {
        fetchServers();
        if (selectedServerName === name) {
          setSelectedServerName('');
        }
        navigate('/mc');
      })
      .catch((err) => {
        console.error('Error al eliminar el servidor en backend:', err);
      });
  };

  const handleUpdateServerConfig = (name: string, updatedFields: Partial<MinecraftServer>) => {
    fetch(`/api/servers/${encodeURIComponent(name)}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFields)
    })
      .then((res) => res.json())
      .then(() => fetchServers())
      .catch((err) => console.error('Error updating config:', err));
  };

  // Run player commands through standard Console API
  const handleKickPlayer = (serverName: string, playerName: string) => {
    handleSendCommand(serverName, `/kick ${playerName}`);
  };

  const handleOpPlayer = (serverName: string, playerName: string) => {
    handleSendCommand(serverName, `/op ${playerName}`);
  };

  const handleSendCommand = (serverName: string, commandString: string) => {
    fetch(`/api/servers/${encodeURIComponent(serverName)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: commandString })
    })
      .then((res) => res.json())
      .then(() => fetchConsoleLogs())
      .catch((err) => console.error('Error executing command:', err));
  };

  const handleClearLogs = (serverName: string) => {
    setConsoleLogs((prev) => ({
      ...prev,
      [serverName]: []
    }));
  };

  // Route View dispatcher
  const renderRouteView = () => {
    switch (route.page) {
      case 'raspi-status':
        return (
          <PiStatus 
            status={systemStatus} 
            dataSourceStatus="live"
          />
        );

      case 'settings':
        return (
          <SettingsPage 
            navigate={navigate}
            onSettingsSaved={fetchServers}
          />
        );

      case 'mc-list':
        return (
          <McOverview 
            servers={minecraftServers}
            downloadTasks={downloadTasks}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onInstallServer={handleCreateServerDownload}
            onDeleteServer={handleDeleteServer}
            onSelectServer={setSelectedServerName}
            navigate={navigate}
          />
        );

      case 'mc-detail':
        if (!currentServer) {
          return (
            <div className="bg-slate-900/40 p-8 rounded-2xl border border-slate-800 text-center space-y-4 max-w-md mx-auto my-12" id="server-not-found-detail">
              <AlertTriangle className="text-amber-500 w-12 h-12 mx-auto" />
              <h2 className="text-xl font-bold text-slate-100">Servidor No Encontrado</h2>
              <p className="text-sm text-slate-400">El servidor especificado no está instalado o no se encuentra disponible.</p>
              <button 
                onClick={() => navigate('/mc')} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Volver a la lista
              </button>
            </div>
          );
        }
        return (
          <McDetail 
            server={currentServer}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onKickPlayer={handleKickPlayer}
            onOpPlayer={handleOpPlayer}
            navigate={navigate}
          />
        );

      case 'mc-config':
        if (!currentServer) {
          return (
            <div className="bg-slate-900/40 p-8 rounded-2xl border border-slate-800 text-center space-y-4 max-w-md mx-auto my-12" id="server-not-found-config">
              <AlertTriangle className="text-amber-500 w-12 h-12 mx-auto" />
              <h2 className="text-xl font-bold text-slate-100">Servidor No Encontrado</h2>
              <p className="text-sm text-slate-400">El servidor especificado no está instalado o no se encuentra disponible.</p>
              <button 
                onClick={() => navigate('/mc')} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Volver a la lista
              </button>
            </div>
          );
        }
        return (
          <McConfig 
            server={currentServer}
            onUpdateConfig={handleUpdateServerConfig}
            navigate={navigate}
          />
        );

      case 'mc-console':
        if (!currentServer) {
          return (
            <div className="bg-slate-900/40 p-8 rounded-2xl border border-slate-800 text-center space-y-4 max-w-md mx-auto my-12" id="server-not-found-console">
              <AlertTriangle className="text-amber-500 w-12 h-12 mx-auto" />
              <h2 className="text-xl font-bold text-slate-100">Servidor No Encontrado</h2>
              <p className="text-sm text-slate-400">El servidor especificado no está instalado o no se encuentra disponible.</p>
              <button 
                onClick={() => navigate('/mc')} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Volver a la lista
              </button>
            </div>
          );
        }
        return (
          <McConsole 
            server={currentServer}
            logs={consoleLogs[selectedServerName] || []}
            onSendCommand={handleSendCommand}
            onClearLogs={handleClearLogs}
            navigate={navigate}
          />
        );

      case 'mc-logs':
        if (!currentServer) {
          return (
            <div className="bg-slate-900/40 p-8 rounded-2xl border border-slate-800 text-center space-y-4 max-w-md mx-auto my-12" id="server-not-found-logs">
              <AlertTriangle className="text-amber-500 w-12 h-12 mx-auto" />
              <h2 className="text-xl font-bold text-slate-100">Servidor No Encontrado</h2>
              <p className="text-sm text-slate-400">El servidor especificado no está instalado o no se encuentra disponible.</p>
              <button 
                onClick={() => navigate('/mc')} 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Volver a la lista
              </button>
            </div>
          );
        }
        return (
          <McLogs 
            server={currentServer}
            navigate={navigate}
          />
        );

      default:
        return (
          <McOverview 
            servers={minecraftServers}
            onStartServer={handleStartServer}
            onStopServer={handleStopServer}
            onInstallServer={handleCreateServerDownload}
            onDeleteServer={handleDeleteServer}
            onSelectServer={setSelectedServerName}
            navigate={navigate}
          />
        );
    }
  };

  return (
    <Layout 
      currentPage={route.page} 
      currentServerName={currentServer ? currentServer.name : null}
      navigate={navigate}
      piIpAddress={systemStatus.ipAddress}
    >
      <div className="w-full">
        {renderRouteView()}
      </div>

      {/* Global EULA Acceptance Prompt Modal */}
      {eulaPendingServer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleIn relative">
            <button
              onClick={handleRejectEula}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition"
              title="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="flex items-center space-x-3 text-indigo-400">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <ShieldCheck size={26} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Acuerdo de Licencia (EULA)</h3>
                <p className="text-xs text-slate-400">Servidor: <span className="font-mono font-semibold text-indigo-300">{eulaPendingServer.name}</span></p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <p>
                Para poder ejecutar un servidor de Minecraft, Mojang / Microsoft requiere que todos los administradores de servidores acepten los Términos del Acuerdo de Licencia de Usuario Final (EULA).
              </p>
              <p className="text-slate-400">
                Al hacer clic en <strong className="text-indigo-300">"Aceptar EULA e Iniciar"</strong>, declaras que has leído y aceptas las condiciones del EULA de Minecraft disponibles en:
              </p>
              <a 
                href="https://account.mojang.com/documents/minecraft_eula" 
                target="_blank" 
                rel="noreferrer"
                className="inline-block text-indigo-400 hover:underline font-mono text-[11px] font-semibold"
              >
                https://account.mojang.com/documents/minecraft_eula ↗
              </a>
              <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-850">
                Se escribirá <code className="text-emerald-400 font-mono bg-slate-900 px-1 py-0.5 rounded">eula=true</code> en el archivo <code className="text-slate-300 font-mono">./servers/{eulaPendingServer.name}/eula.txt</code>.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={handleRejectEula}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Rechazar (Cancelar inicio)
              </button>
              <button
                onClick={handleAcceptEulaAndStart}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow"
              >
                <CheckCircle size={14} />
                <span>Aceptar EULA e Iniciar Servidor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-invasive corner progress notification toast for active jar downloads */}
      {downloadTasks.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-auto">
          {downloadTasks.map((task) => (
            <div
              key={task.id}
              className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-2xl relative space-y-2.5 overflow-hidden backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase font-mono shrink-0">
                    {task.type} {task.version}
                  </span>
                  <h4 className="text-xs font-bold text-slate-100 truncate max-w-[160px]">{task.serverName}</h4>
                </div>
                <button
                  onClick={() => setDownloadTasks((prev) => prev.filter((t) => t.id !== task.id))}
                  className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-800 transition"
                  title="Cerrar notificación"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Status label */}
              <div className="flex items-center space-x-2 text-xs">
                {task.status === 'error' ? (
                  <div className="flex items-center space-x-1.5 text-rose-400 font-semibold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="truncate">{task.error || task.message}</span>
                  </div>
                ) : task.status === 'complete' ? (
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                    <CheckCircle size={14} className="shrink-0" />
                    <span>{task.message}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-slate-300 text-[11px] font-mono">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0"></span>
                    <span className="truncate">{task.message}</span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Descarga</span>
                  <span className={task.status === 'error' ? 'text-rose-400' : task.status === 'complete' ? 'text-emerald-400' : 'text-indigo-400 font-bold'}>
                    {task.percent}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      task.status === 'error'
                        ? 'bg-rose-500'
                        : task.status === 'complete'
                        ? 'bg-emerald-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.max(3, task.percent)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

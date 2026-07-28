/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Folder, 
  Terminal, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Info,
  RefreshCw,
  Plus,
  Trash2,
  HardDrive,
  Cpu,
  GitBranch,
  Download,
  AlertTriangle,
  X,
  ShieldAlert,
  Terminal as TerminalIcon,
  Radio,
  Wifi,
  Eye,
  EyeOff,
  Key
} from 'lucide-react';

interface SettingsData {
  serversDirs: string[];
  javaPath: string;
  backupDir: string;
  defaultRamGb: number;
  autoStartOnBoot?: boolean;
}

interface SettingsPageProps {
  navigate: (path: string) => void;
  onSettingsSaved?: () => void;
}

export default function SettingsPage({ navigate, onSettingsSaved }: SettingsPageProps) {
  const [settings, setSettings] = useState<SettingsData>({
    serversDirs: ['servers'],
    javaPath: 'java',
    backupDir: 'backups',
    defaultRamGb: 2,
    autoStartOnBoot: false
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // System Update Progress State
  interface SystemUpdateProgress {
    isUpdating: boolean;
    percent: number;
    status: 'idle' | 'checking' | 'downloading' | 'extracting' | 'installing' | 'completed' | 'error';
    message: string;
    downloadedBytes?: number;
    totalBytes?: number;
    error?: string | null;
  }

  const [updateProgress, setUpdateProgress] = useState<SystemUpdateProgress>({
    isUpdating: false,
    percent: 0,
    status: 'idle',
    message: ''
  });
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);

  // Uninstall Modal State
  const [showUninstallModal, setShowUninstallModal] = useState(false);
  const [uninstallConfirmedCheckbox, setUninstallConfirmedCheckbox] = useState(false);
  const [uninstallTextConfirm, setUninstallTextConfirm] = useState('');
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [uninstallStatusMsg, setUninstallStatusMsg] = useState<string | null>(null);

  const handleTriggerUpdate = async () => {
    setUpdateProgress({
      isUpdating: true,
      percent: 2,
      status: 'checking',
      message: 'Conectando con el servidor de actualizaciones...'
    });
    setUpdateLogs(['Iniciando proceso de actualización oficial (D4mizr/WinMc)...']);

    try {
      const res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `Error del servidor HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('El navegador no soporta transmisión de eventos.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              try {
                const data = JSON.parse(jsonStr);
                setUpdateProgress({
                  isUpdating: !!data.isUpdating,
                  percent: typeof data.percent === 'number' ? data.percent : 0,
                  status: data.status || 'checking',
                  message: data.message || '',
                  downloadedBytes: data.downloadedBytes,
                  totalBytes: data.totalBytes,
                  error: data.error
                });

                if (Array.isArray(data.logs)) {
                  setUpdateLogs(data.logs);
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (err: any) {
      setUpdateProgress(prev => ({
        ...prev,
        isUpdating: false,
        status: 'error',
        error: err.message,
        message: `Error al actualizar: ${err.message}`
      }));
      setUpdateLogs(prev => [...prev, `[ERROR CRÍTICO] ${err.message}`]);
    }
  };

  const handleTriggerUninstall = () => {
    if (!uninstallConfirmedCheckbox || uninstallTextConfirm.trim().toUpperCase() !== 'DESINSTALAR') {
      return;
    }

    setIsUninstalling(true);
    setUninstallStatusMsg('Eliminando servicios, comandos CLI, archivos de RaspiMC y servidores de Minecraft...');

    fetch('/api/system/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmDeleteServers: true })
    })
      .then(res => res.json())
      .then(data => {
        setUninstallStatusMsg(data.message || 'Desinstalación completada. Todos los archivos y servidores han sido eliminados.');
      })
      .catch(err => {
        setUninstallStatusMsg(`Error al desinstalar: ${err.message}`);
        setIsUninstalling(false);
      });
  };

  // Hotspot Settings state
  const [hotspotStatus, setHotspotStatus] = useState<{ active: boolean; ssid: string; password: string; ip: string; clientsCount: number; readinessError?: string | null } | null>(null);
  const [hotspotSsid, setHotspotSsid] = useState('RaspiMC-AP');
  const [hotspotPassword, setHotspotPassword] = useState('RaspberryMinecraft');
  const [showHotspotPass, setShowHotspotPass] = useState(false);
  const [isSavingHotspot, setIsSavingHotspot] = useState(false);
  const [isTogglingHotspot, setIsTogglingHotspot] = useState(false);
  const [hotspotMsg, setHotspotMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load saved settings from API
  const loadSettings = () => {
    setIsLoading(true);
    fetch('/api/settings')
      .then((res) => {
        if (!res.ok) throw new Error('Error al conectar con la API de configuración');
        return res.json();
      })
      .then((data) => {
        const dirs = Array.isArray(data.serversDirs) && data.serversDirs.length > 0
          ? data.serversDirs
          : (data.serversDir ? [data.serversDir] : ['servers']);

        setSettings({
          serversDirs: dirs,
          javaPath: data.javaPath || 'java',
          backupDir: data.backupDir || 'backups',
          defaultRamGb: Number(data.defaultRamGb) || 2,
          autoStartOnBoot: !!data.autoStartOnBoot
        });
      })
      .catch((err) => {
        console.error(err);
        setMessage({ type: 'error', text: 'No se pudieron cargar los ajustes del servidor.' });
      })
      .finally(() => setIsLoading(false));

    // Also fetch current hotspot configuration
    fetch('/api/hotspot/status')
      .then(r => r.json())
      .then(data => {
        setHotspotStatus(data);
        if (data.ssid) setHotspotSsid(data.ssid);
        if (data.password) setHotspotPassword(data.password);
      })
      .catch(() => {});

    // Also fetch system update status
    fetch('/api/system/update/status')
      .then(r => r.json())
      .then(data => {
        if (data && data.status && data.status !== 'idle') {
          setUpdateProgress({
            isUpdating: !!data.isUpdating,
            percent: typeof data.percent === 'number' ? data.percent : 0,
            status: data.status,
            message: data.message || '',
            downloadedBytes: data.downloadedBytes,
            totalBytes: data.totalBytes,
            error: data.error
          });
          if (Array.isArray(data.logs)) setUpdateLogs(data.logs);
        }
      })
      .catch(() => {});
  };

  const handleSaveHotspotSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setHotspotMsg(null);

    if (!hotspotSsid.trim()) {
      setHotspotMsg({ type: 'error', text: 'El nombre del Hotspot (SSID) no puede estar vacío.' });
      return;
    }

    if (!hotspotPassword || hotspotPassword.length < 8) {
      setHotspotMsg({ type: 'error', text: 'La contraseña de Wi-Fi debe contener al menos 8 caracteres (requerido por WPA2-PSK).' });
      return;
    }

    setIsSavingHotspot(true);
    fetch('/api/hotspot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid: hotspotSsid.trim(), password: hotspotPassword })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Error al guardar la contraseña del Hotspot.');
        }
        return data;
      })
      .then(data => {
        setHotspotMsg({ type: 'success', text: data.message });
        if (data.status) {
          setHotspotStatus(data.status);
          setHotspotSsid(data.status.ssid);
          setHotspotPassword(data.status.password);
        }
        setTimeout(() => setHotspotMsg(null), 6000);
      })
      .catch(err => {
        setHotspotMsg({ type: 'error', text: err.message });
      })
      .finally(() => setIsSavingHotspot(false));
  };

  const handleToggleHotspotSettings = (enable: boolean) => {
    setIsTogglingHotspot(true);
    setHotspotMsg(null);
    fetch('/api/hotspot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    })
      .then(r => r.json())
      .then(res => {
        if (!res.success) {
          setHotspotMsg({ type: 'error', text: res.message });
        } else {
          setHotspotMsg({ type: 'success', text: res.message });
        }
        if (res.status) {
          setHotspotStatus(res.status);
        }
        setTimeout(() => setHotspotMsg(null), 5000);
      })
      .catch(() => {
        setHotspotMsg({ type: 'error', text: 'Error al cambiar estado del Hotspot.' });
      })
      .finally(() => setIsTogglingHotspot(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleDirChange = (index: number, value: string) => {
    const updated = [...settings.serversDirs];
    updated[index] = value;
    setSettings({ ...settings, serversDirs: updated });
  };

  const handleAddDir = () => {
    setSettings({
      ...settings,
      serversDirs: [...settings.serversDirs, '']
    });
  };

  const handleRemoveDir = (index: number) => {
    if (settings.serversDirs.length <= 1) {
      setMessage({ type: 'error', text: 'Debe haber al menos una ubicación de servidores configurada.' });
      setTimeout(() => setMessage(null), 4000);
      return;
    }
    const updated = settings.serversDirs.filter((_, i) => i !== index);
    setSettings({ ...settings, serversDirs: updated });
  };

  // Save settings via POST API
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    // Sanitize locations
    const cleanDirs = settings.serversDirs.map(d => d.trim()).filter(Boolean);
    if (cleanDirs.length === 0) {
      setMessage({ type: 'error', text: 'Por favor ingresa al menos una ruta válida de servidores.' });
      setIsSaving(false);
      return;
    }

    const payload = {
      ...settings,
      serversDirs: cleanDirs
    };

    fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Error al guardar los ajustes en el host Windows');
        return res.json();
      })
      .then((data) => {
        const dirs = Array.isArray(data.serversDirs) && data.serversDirs.length > 0
          ? data.serversDirs
          : [data.serversDir || 'servers'];

        setSettings({
          serversDirs: dirs,
          javaPath: data.javaPath || 'java',
          backupDir: data.backupDir || 'backups',
          defaultRamGb: Number(data.defaultRamGb) || 2,
          autoStartOnBoot: !!data.autoStartOnBoot
        });

        setMessage({ type: 'success', text: '¡Configuración guardada! Se han escaneado y actualizado las ubicaciones de servidores inmediatamente.' });
        if (onSettingsSaved) {
          onSettingsSaved();
        }
        setTimeout(() => setMessage(null), 5000);
      })
      .catch((err) => {
        console.error(err);
        setMessage({ type: 'error', text: 'Error al intentar guardar los ajustes en el servidor.' });
      })
      .finally(() => setIsSaving(false));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4" id="settings-loading-view">
        <RefreshCw size={36} className="text-indigo-400 animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Cargando configuración del sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="settings-page-container">
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-800/80" id="settings-header">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings size={22} className="text-indigo-400" />
            <span>Ajustes de la Aplicación</span>
          </h2>
          <p className="text-sm text-slate-400">Configura ubicaciones de servidores en Linux, RAM por defecto para Raspberry Pi y ejecutable Java.</p>
        </div>
      </div>

      {/* Alert Banners */}
      {message && (
        <div 
          className={`px-4 py-3.5 rounded-xl border flex items-center gap-2.5 text-sm transition animate-fadeIn ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
          id="settings-feedback-alert"
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/20 border border-slate-800/60 rounded-2xl p-6 space-y-6" id="settings-form">
        
        {/* Servers directories (Multiple Locations Support) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Folder size={14} className="text-indigo-400" />
              <span>Ubicaciones de Almacenamiento de Servidores</span>
            </label>
            <button
              type="button"
              onClick={handleAddDir}
              className="px-2.5 py-1 text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              id="settings-add-location-btn"
            >
              <Plus size={14} />
              <span>Añadir Ubicación</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {settings.serversDirs.map((dirPath, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <HardDrive size={15} />
                  </div>
                  <input
                    type="text"
                    value={dirPath}
                    onChange={(e) => handleDirChange(idx, e.target.value)}
                    placeholder={`Ubicación ${idx + 1} (ej: /var/lib/raspimc/servers o /home/pi/raspimc/servers)`}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                    required
                    id={`settings-servers-dir-input-${idx}`}
                  />
                </div>
                {settings.serversDirs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDir(idx)}
                    className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition cursor-pointer shrink-0"
                    title="Eliminar esta ubicación"
                    id={`settings-remove-dir-${idx}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            RaspiMC escaneará y combinará los servidores encontrados en <strong>todas</strong> las ubicaciones configuradas. Puedes agregar rutas locales (ej: <code className="text-slate-400 font-mono">/var/lib/raspimc/servers</code>) o unidades externas montadas en Raspberry Pi OS.
          </p>
        </div>

        {/* Java Binary Executable Path */}
        <div className="space-y-2 pt-2 border-t border-slate-800/40">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Terminal size={14} className="text-indigo-400" />
            <span>Ejecutable Java / java.exe Path</span>
          </label>
          <input
            type="text"
            value={settings.javaPath}
            onChange={(e) => setSettings({ ...settings, javaPath: e.target.value })}
            placeholder="java"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
            required
            id="settings-java-path-input"
          />
          <p className="text-xs text-slate-500 font-medium">
            Ruta o alias al ejecutable de Java en Windows. Use <code className="text-slate-400 font-mono">java</code> si está en el PATH de Windows, o la ruta completa (ej: <code className="text-slate-400 font-mono">C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe</code>).
          </p>
        </div>

        {/* Default RAM & Backups Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/40">
          {/* Default RAM for new servers */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Cpu size={14} className="text-indigo-400" />
              <span>RAM por Defecto para Nuevos Servidores (GB)</span>
            </label>
            <input
              type="number"
              min="1"
              max="64"
              step="0.5"
              value={settings.defaultRamGb}
              onChange={(e) => setSettings({ ...settings, defaultRamGb: parseFloat(e.target.value) || 2 })}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
              required
              id="settings-ram-input"
            />
            <p className="text-xs text-slate-500 font-medium">
              Memoria RAM asignada automáticamente al crear nuevos servidores.
            </p>
          </div>

          {/* Backups Directory */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Folder size={14} className="text-indigo-400" />
              <span>Carpeta de Backups / Copias de Seguridad</span>
            </label>
            <input
              type="text"
              value={settings.backupDir}
              onChange={(e) => setSettings({ ...settings, backupDir: e.target.value })}
              placeholder="backups"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
              required
              id="settings-backups-dir-input"
            />
            <p className="text-xs text-slate-500 font-medium">
              Carpeta donde se guardan los archivos comprimidos de respaldo.
            </p>
          </div>
        </div>

        {/* Hotspot Wi-Fi Settings Section */}
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4" id="settings-hotspot-section">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Radio size={16} className="text-indigo-400" />
                <span>Configuración de Hotspot Wi-Fi Integrado</span>
              </h3>
              <p className="text-xs text-slate-400">
                Ajusta el nombre de la red Wi-Fi (SSID) y la contraseña del punto de acceso local en Raspberry Pi OS.
              </p>
            </div>
            {hotspotStatus && (
              <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                hotspotStatus.active
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {hotspotStatus.active ? 'HOTSPOT ACTIVO' : 'HOTSPOT INACTIVO'}
              </span>
            )}
          </div>

          {hotspotStatus?.readinessError && (
            <div className="p-3.5 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-1">
                <span className="font-bold text-amber-200 block">Diagnóstico del Sistema para Hotspot:</span>
                <span className="leading-relaxed block">{hotspotStatus.readinessError}</span>
              </div>
            </div>
          )}

          {hotspotMsg && (
            <div className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
              hotspotMsg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              {hotspotMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
              <span>{hotspotMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                SSID (Nombre Wi-Fi)
              </label>
              <input
                type="text"
                value={hotspotSsid}
                onChange={(e) => setHotspotSsid(e.target.value)}
                placeholder="Ej. RaspiMC-AP"
                maxLength={32}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block flex items-center justify-between">
                <span>Contraseña Wi-Fi (WPA2 PSK)</span>
                <span className={`text-[10px] font-mono ${hotspotPassword.length >= 8 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {hotspotPassword.length}/8+
                </span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showHotspotPass ? 'text' : 'password'}
                  value={hotspotPassword}
                  onChange={(e) => setHotspotPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  maxLength={63}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg pl-3.5 pr-10 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowHotspotPass(!showHotspotPass)}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title={showHotspotPass ? 'Ocultar' : 'Mostrar'}
                >
                  {showHotspotPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleToggleHotspotSettings(!hotspotStatus?.active)}
              disabled={isTogglingHotspot}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                hotspotStatus?.active
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-300'
                  : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200'
              }`}
            >
              {isTogglingHotspot ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Wifi size={14} />
              )}
              <span>{hotspotStatus?.active ? 'Desactivar Hotspot' : 'Activar Hotspot'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveHotspotSettings}
              disabled={isSavingHotspot || hotspotPassword.length < 8 || !hotspotSsid.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow flex items-center justify-center gap-1.5 transition cursor-pointer border border-indigo-500"
            >
              {isSavingHotspot ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSavingHotspot ? 'Guardando en NetworkManager...' : 'Actualizar Contraseña de Hotspot'}</span>
            </button>
          </div>
        </div>

        {/* System Information Alert */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 flex gap-3 text-slate-300 text-xs" id="settings-info-box">
          <Info size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-slate-200">Sincronización Inmediata en Raspberry Pi OS</span>
            <span>Cualquier cambio en las ubicaciones de almacenamiento actualizará inmediatamente la lista general de servidores sin requerir reinicio de la app. Los servidores existentes en disco se escanearán y reflejarán al instante.</span>
          </div>
        </div>

        {/* System Update Section */}
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4" id="settings-update-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <GitBranch size={16} className="text-indigo-400" />
                <span>Actualización del Sistema (GitHub)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Mantiene RaspiMC actualizado descargando e instalando el paquete de código más reciente desde el repositorio oficial de GitHub (<code className="text-indigo-300 font-mono">D4mizr/WinMc</code>).
              </p>
            </div>

            <button
              type="button"
              onClick={handleTriggerUpdate}
              disabled={updateProgress.isUpdating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2 transition cursor-pointer shrink-0 self-start sm:self-center"
              id="trigger-update-btn"
            >
              {updateProgress.isUpdating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Actualizando ({updateProgress.percent}%)...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Buscar y Aplicar Actualización</span>
                </>
              )}
            </button>
          </div>

          {/* Real-Time Progress Bar Component */}
          {(updateProgress.isUpdating || updateProgress.status !== 'idle' || updateLogs.length > 0) && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3" id="settings-update-progress-card">
              {/* Header and status info */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  {updateProgress.isUpdating ? (
                    <RefreshCw size={15} className="text-indigo-400 animate-spin" />
                  ) : updateProgress.status === 'completed' ? (
                    <CheckCircle size={15} className="text-emerald-400" />
                  ) : updateProgress.status === 'error' ? (
                    <AlertCircle size={15} className="text-rose-400" />
                  ) : (
                    <Info size={15} className="text-slate-400" />
                  )}
                  <span>
                    {updateProgress.status === 'checking' && 'Verificando repositorio...'}
                    {updateProgress.status === 'downloading' && 'Descargando paquete de actualización...'}
                    {updateProgress.status === 'extracting' && 'Extrayendo y sobrescribiendo archivos...'}
                    {updateProgress.status === 'installing' && 'Instalando dependencias y compilando...'}
                    {updateProgress.status === 'completed' && '¡Proceso de actualización completado con éxito!'}
                    {updateProgress.status === 'error' && 'Error durante la actualización'}
                    {updateProgress.status === 'idle' && 'Progreso de actualización'}
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  {updateProgress.downloadedBytes && updateProgress.downloadedBytes > 0 ? (
                    <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                      {(updateProgress.downloadedBytes / (1024 * 1024)).toFixed(2)} MB
                      {updateProgress.totalBytes ? ` / ${(updateProgress.totalBytes / (1024 * 1024)).toFixed(2)} MB` : ''}
                    </span>
                  ) : null}
                  <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${
                    updateProgress.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : updateProgress.status === 'error'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                  }`}>
                    {updateProgress.percent}%
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-0.5 relative overflow-hidden shadow-inner">
                <div
                  className={`h-3 rounded-md transition-all duration-300 ease-out relative ${
                    updateProgress.status === 'completed'
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : updateProgress.status === 'error'
                      ? 'bg-gradient-to-r from-rose-600 to-red-500 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                  }`}
                  style={{ width: `${Math.max(2, Math.min(100, updateProgress.percent))}%` }}
                >
                  {updateProgress.isUpdating && (
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-md" />
                  )}
                </div>
              </div>

              {/* Message Banner */}
              {updateProgress.message && (
                <p className={`text-xs ${
                  updateProgress.status === 'error'
                    ? 'text-rose-300 font-medium'
                    : updateProgress.status === 'completed'
                    ? 'text-emerald-300 font-medium'
                    : 'text-slate-300'
                }`}>
                  {updateProgress.message}
                </p>
              )}
            </div>
          )}

          {/* Terminal log viewer */}
          {updateLogs.length > 0 && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 font-mono text-[11px] text-slate-400 space-y-1 max-h-44 overflow-y-auto" id="settings-update-logs-viewer">
              {updateLogs.map((log, idx) => (
                <p key={idx} className="leading-tight">{log}</p>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone: Uninstall Section */}
        <div className="bg-rose-950/20 p-5 rounded-xl border border-rose-500/30 space-y-4" id="settings-uninstall-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-400" />
                <span>Zona de Peligro: Desinstalar RaspiMC</span>
              </h3>
              <p className="text-xs text-rose-200/80">
                Elimina permanentemente RaspiMC, el comando CLI, el servicio systemd y <strong>TODOS los servidores de Minecraft</strong> almacenados en el sistema.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setUninstallConfirmedCheckbox(false);
                setUninstallTextConfirm('');
                setShowUninstallModal(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow flex items-center gap-1.5 transition cursor-pointer shrink-0 self-start sm:self-center"
              id="open-uninstall-modal-btn"
            >
              <Trash2 size={14} />
              <span>Desinstalar Aplicación</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-850 flex items-center justify-end space-x-3" id="settings-actions">
          <button
            type="button"
            onClick={() => navigate('/mc')}
            className="px-4 py-2 border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-850 transition cursor-pointer"
            id="settings-cancel-btn"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow flex items-center gap-2 transition cursor-pointer"
            id="settings-submit-btn"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Guardar Ajustes</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* UNINSTALL DISCLAIMER MODAL */}
      {showUninstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" id="uninstall-disclaimer-modal">
          <div className="w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
              <div className="flex items-center space-x-2.5 text-rose-400">
                <ShieldAlert size={22} />
                <h3 className="text-base font-bold text-slate-100">Desinstalación Completa del Sistema</h3>
              </div>
              <button 
                onClick={() => setShowUninstallModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            {/* Disclaimer Body */}
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-rose-200">
                <p className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle size={15} />
                  <span>DESCARGO DE RESPONSABILIDAD IMPORTANTE:</span>
                </p>
                <ul className="list-disc list-inside space-y-1 font-medium text-slate-200">
                  <li>La aplicación <strong>RaspiMC</strong> será desinstalada por completo.</li>
                  <li>El servicio nativo <code className="text-rose-300 font-mono">raspimc.service</code> y el comando <code className="text-rose-300 font-mono">raspimc</code> serán eliminados.</li>
                  <li><strong className="text-rose-400 uppercase">TODOS TUS SERVIDORES DE MINECRAFT SE BORRARÁN DEFINITIVAMENTE</strong> (incluyendo mundos, mapas, plugins, jugadores, inventarios y archivos configurados en <code className="text-rose-300 font-mono">/var/lib/raspimc/servers</code>).</li>
                  <li>No quedará ningún rastro de datos residuales de la aplicación.</li>
                  <li><strong>ESTA ACCIÓN ES TOTALMENTE IRREVERSIBLE.</strong></li>
                </ul>
              </div>

              {uninstallStatusMsg && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 font-semibold flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-indigo-400 shrink-0" />
                  <span>{uninstallStatusMsg}</span>
                </div>
              )}

              {/* Confirmations */}
              {!isUninstalling && (
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={uninstallConfirmedCheckbox}
                      onChange={(e) => setUninstallConfirmedCheckbox(e.target.checked)}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 bg-slate-900 border-slate-700"
                    />
                    <span className="font-semibold text-slate-200">
                      Entiendo y acepto que la aplicación RaspiMC y todos los datos de mis servidores de Minecraft serán eliminados permanentemente.
                    </span>
                  </label>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Para confirmar, escribe <code className="text-rose-400 font-bold">DESINSTALAR</code> a continuación:
                    </label>
                    <input
                      type="text"
                      value={uninstallTextConfirm}
                      onChange={(e) => setUninstallTextConfirm(e.target.value)}
                      placeholder="Escribe DESINSTALAR aquí"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-rose-500/30 text-rose-300 font-bold font-mono rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowUninstallModal(false)}
                disabled={isUninstalling}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTriggerUninstall}
                disabled={!uninstallConfirmedCheckbox || uninstallTextConfirm.trim().toUpperCase() !== 'DESINSTALAR' || isUninstalling}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
              >
                {isUninstalling ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Eliminando Todo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Eliminar RaspiMC y Servidores Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


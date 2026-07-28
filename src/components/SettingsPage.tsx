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
  Terminal as TerminalIcon
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

  // Update State
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateLogs, setUpdateLogs] = useState<string[]>([]);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);

  // Uninstall Modal State
  const [showUninstallModal, setShowUninstallModal] = useState(false);
  const [uninstallConfirmedCheckbox, setUninstallConfirmedCheckbox] = useState(false);
  const [uninstallTextConfirm, setUninstallTextConfirm] = useState('');
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [uninstallStatusMsg, setUninstallStatusMsg] = useState<string | null>(null);

  const handleTriggerUpdate = () => {
    setIsUpdating(true);
    setUpdateLogs(['Iniciando proceso de actualización desde GitHub (D4mizr/WinMc)...']);
    setUpdateStatusMsg(null);

    fetch('/api/system/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.message || 'Error al actualizar'); });
        return res.json();
      })
      .then(data => {
        if (data.logs) setUpdateLogs(data.logs);
        setUpdateStatusMsg(data.message || 'Actualización completada exitosamente.');
      })
      .catch(err => {
        setUpdateStatusMsg(`Error de actualización: ${err.message}`);
      })
      .finally(() => setIsUpdating(false));
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
                Mantiene RaspiMC actualizado descargando el código más reciente desde el repositorio oficial de GitHub (<code className="text-indigo-300 font-mono">D4mizr/WinMc</code>).
              </p>
            </div>

            <button
              type="button"
              onClick={handleTriggerUpdate}
              disabled={isUpdating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2 transition cursor-pointer shrink-0 self-start sm:self-center"
              id="trigger-update-btn"
            >
              {isUpdating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Buscar y Aplicar Actualización</span>
                </>
              )}
            </button>
          </div>

          {/* Update logs or status message */}
          {updateStatusMsg && (
            <div className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
              updateStatusMsg.includes('Error') ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              {updateStatusMsg.includes('Error') ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
              <span>{updateStatusMsg}</span>
            </div>
          )}

          {updateLogs.length > 0 && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 font-mono text-[11px] text-slate-400 space-y-1 max-h-40 overflow-y-auto">
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


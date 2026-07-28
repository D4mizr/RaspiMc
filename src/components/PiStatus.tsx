/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Database, 
  HardDrive, 
  Clock,
  RefreshCw,
  Info,
  Thermometer,
  Wifi,
  Radio,
  CheckCircle2,
  XCircle,
  Settings,
  Eye,
  EyeOff,
  Key,
  Save,
  AlertCircle
} from 'lucide-react';
import { SystemStatus } from '../types';

interface PiStatusProps {
  status: SystemStatus;
  dataSourceStatus: 'live' | 'cached' | 'unavailable';
}

export default function PiStatus({ 
  status: initialStatus
}: PiStatusProps) {
  const [status, setStatus] = useState<SystemStatus>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingHotspot, setIsTogglingHotspot] = useState(false);
  const [hotspotMsg, setHotspotMsg] = useState<string | null>(null);
  const [hotspotError, setHotspotError] = useState<string | null>(null);

  // Hotspot Configuration state
  const [showHotspotConfig, setShowHotspotConfig] = useState(false);
  const [ssidInput, setSsidInput] = useState(initialStatus.hotspot?.ssid || 'RaspiMC-AP');
  const [passwordInput, setPasswordInput] = useState(initialStatus.hotspot?.password || 'RaspberryMinecraft');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Synchronize state with incoming status props
  useEffect(() => {
    setStatus(initialStatus);
    if (initialStatus.hotspot) {
      setSsidInput(initialStatus.hotspot.ssid);
      setPasswordInput(initialStatus.hotspot.password);
    }
  }, [initialStatus]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetch('/api/system/status')
      .then(r => r.json())
      .then(d => {
        setStatus(d);
        setIsRefreshing(false);
      })
      .catch(() => setIsRefreshing(false));
  };

  const handleToggleHotspot = (enable: boolean) => {
    setIsTogglingHotspot(true);
    setHotspotMsg(null);
    setHotspotError(null);
    fetch('/api/hotspot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    })
      .then(r => r.json())
      .then(res => {
        if (!res.success) {
          setHotspotError(res.message);
        } else {
          setHotspotMsg(res.message);
        }
        if (res.status) {
          setStatus(prev => ({ ...prev, hotspot: res.status }));
        }
        setTimeout(() => {
          setHotspotMsg(null);
          setHotspotError(null);
        }, 5000);
      })
      .catch(() => {
        setHotspotError('Error al cambiar estado del Hotspot Wi-Fi');
        setTimeout(() => setHotspotError(null), 5000);
      })
      .finally(() => setIsTogglingHotspot(false));
  };

  const handleSaveHotspotConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setHotspotError(null);
    setHotspotMsg(null);

    if (!ssidInput.trim()) {
      setHotspotError('El nombre SSID del Hotspot no puede estar vacío.');
      return;
    }

    if (!passwordInput || passwordInput.length < 8) {
      setHotspotError('La contraseña de Wi-Fi debe contener al menos 8 caracteres (requerido por WPA2-PSK).');
      return;
    }

    setIsSavingConfig(true);
    fetch('/api/hotspot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid: ssidInput.trim(), password: passwordInput })
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !data.success) {
          throw new Error(data.message || 'Error al actualizar la configuración del hotspot');
        }
        return data;
      })
      .then((res) => {
        setHotspotMsg(res.message);
        if (res.status) {
          setStatus(prev => ({ ...prev, hotspot: res.status }));
        }
        setShowHotspotConfig(false);
        setTimeout(() => setHotspotMsg(null), 6000);
      })
      .catch((err: any) => {
        setHotspotError(err.message || 'No se pudo guardar la configuración del hotspot.');
      })
      .finally(() => setIsSavingConfig(false));
  };

  // Convert CPU history array into SVG coordinates for a sparkline
  const cpuHistoryToSvgPoints = (history: number[]): string => {
    const width = 280;
    const height = 60;
    const padding = 5;
    if (!history || history.length < 2) return '';
    const step = width / (history.length - 1);
    
    return history.map((val, idx) => {
      const x = idx * step;
      const y = height - padding - ((val / 100) * (height - padding * 2));
      return `${x},${y}`;
    }).join(' ');
  };

  // Percentages & Temperature
  const ramPercentage = status.ramTotal > 0 ? (status.ramUsed / status.ramTotal) * 100 : 0;
  const storagePercentage = status.storageTotal > 0 ? (status.storageUsed / status.storageTotal) * 100 : 0;
  const temp = status.temperature ?? 45.0;

  return (
    <div className="space-y-6" id="status-dashboard-view">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-800/80" id="status-header">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Estado de Raspberry Pi 3B</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono font-semibold">
              Raspberry Pi OS
            </span>
          </h2>
          <p className="text-sm text-slate-400">Monitoreo ligero en tiempo real de recursos de hardware y red Linux.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={`flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-850 active:scale-95 disabled:opacity-50 transition cursor-pointer ${
              isRefreshing ? 'opacity-80' : ''
            }`}
            id="refresh-status-btn"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-400' : ''} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* Grid of System Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="system-resource-grid">
        {/* Temperature Card */}
        <div className="bg-slate-900/25 p-5 rounded-2xl border border-slate-800/60 flex flex-col justify-between" id="temp-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Temperatura CPU</span>
              <p className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
                {temp.toFixed(1)} <span className="text-sm text-slate-400">°C</span>
              </p>
            </div>
            <div className={`p-2.5 rounded-xl border ${
              temp > 75 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
              temp > 60 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <Thermometer size={18} />
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-800/50 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Estado Térmico:</span>
            <span className={`font-semibold ${
              temp > 75 ? 'text-rose-400' : temp > 60 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {temp > 75 ? 'Caliente ⚠️' : temp > 60 ? 'Templado' : 'Óptimo ✓'}
            </span>
          </div>
        </div>

        {/* CPU Monitoring Card */}
        <div className="bg-slate-900/25 p-5 rounded-2xl border border-slate-800/60 flex flex-col justify-between" id="cpu-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Uso de CPU</span>
              <p className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
                {status.cpuUsage}%
              </p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Cpu size={18} />
            </div>
          </div>
          
          <div className="mt-4 h-[35px] flex items-end">
            {status.cpuHistory && status.cpuHistory.length > 0 ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 280 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d={`M0,60 L${cpuHistoryToSvgPoints(status.cpuHistory)} L280,60 Z`}
                  fill="url(#cpuGradient)"
                />
                <polyline
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  points={cpuHistoryToSvgPoints(status.cpuHistory)}
                />
              </svg>
            ) : (
              <span className="text-xs text-slate-600 italic">Historial disponible</span>
            )}
          </div>
        </div>

        {/* RAM Monitoring Card */}
        <div className="bg-slate-900/25 p-5 rounded-2xl border border-slate-800/60 flex flex-col justify-between" id="ram-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Memoria RAM</span>
              <p className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
                {status.ramUsed.toFixed(1)} <span className="text-xs text-slate-400">/ {status.ramTotal.toFixed(1)} GB</span>
              </p>
            </div>
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <Database size={18} />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="h-2 w-full bg-slate-850 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, ramPercentage)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium font-mono">
              <span className="text-slate-400">{ramPercentage.toFixed(0)}% Usado</span>
              <span className="text-slate-500">{(status.ramTotal - status.ramUsed).toFixed(1)} GB Libre</span>
            </div>
          </div>
        </div>

        {/* Disk Storage Card */}
        <div className="bg-slate-900/25 p-5 rounded-2xl border border-slate-800/60 flex flex-col justify-between" id="storage-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Almacenamiento SD</span>
              <p className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
                {status.storageUsed.toFixed(1)} <span className="text-xs text-slate-400">/ {status.storageTotal.toFixed(0)} GB</span>
              </p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <HardDrive size={18} />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="h-2 w-full bg-slate-850 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, storagePercentage)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium font-mono">
              <span className="text-slate-400">{storagePercentage.toFixed(0)}% Usado</span>
              <span className="text-slate-500">{(status.storageTotal - status.storageUsed).toFixed(1)} GB Libre</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot AP Control Banner */}
      <div className="bg-slate-900/30 rounded-2xl border border-slate-800/80 overflow-hidden" id="hotspot-banner">
        <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${
              status.hotspot?.active 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                : 'bg-slate-800/50 border-slate-700/50 text-slate-500'
            }`}>
              <Radio size={22} className={status.hotspot?.active ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-100">Hotspot Wi-Fi Integrado (Punto de Acceso)</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  status.hotspot?.active
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-850 text-slate-400 border-slate-800'
                }`}>
                  {status.hotspot?.active ? 'ACTIVADO' : 'DESACTIVADO'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                <span>SSID: <strong className="text-slate-200 font-mono">{status.hotspot?.ssid || 'RaspiMC-AP'}</strong></span>
                <span className="text-slate-600">|</span>
                <span>Clave: <strong className="text-slate-300 font-mono">{showPassword ? (status.hotspot?.password || 'RaspberryMinecraft') : '••••••••'}</strong></span>
                {status.hotspot?.active && (
                  <>
                    <span className="text-slate-600">|</span>
                    <span>IP: <strong className="text-indigo-400 font-mono">{status.hotspot?.ip || '192.168.4.1'}</strong></span>
                    <span className="text-slate-600">|</span>
                    <span>Clientes: <strong className="text-emerald-400 font-mono">{status.hotspot?.clientsCount || 0}</strong></span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                setShowHotspotConfig(!showHotspotConfig);
                setSsidInput(status.hotspot?.ssid || 'RaspiMC-AP');
                setPasswordInput(status.hotspot?.password || 'RaspberryMinecraft');
                setHotspotError(null);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-200"
              id="configure-hotspot-btn"
            >
              <Settings size={14} className="text-slate-400" />
              <span>{showHotspotConfig ? 'Ocultar Ajustes' : 'Configurar Hotspot'}</span>
            </button>

            <button
              onClick={() => handleToggleHotspot(!status.hotspot?.active)}
              disabled={isTogglingHotspot}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
                status.hotspot?.active
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white shadow'
              }`}
              id="toggle-hotspot-btn"
            >
              {isTogglingHotspot ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : status.hotspot?.active ? (
                <XCircle size={14} />
              ) : (
                <Wifi size={14} />
              )}
              <span>{status.hotspot?.active ? 'Desactivar Hotspot' : 'Activar Hotspot Wi-Fi'}</span>
            </button>
          </div>
        </div>

        {/* Global Messages / Alerts for Hotspot */}
        {(hotspotMsg || hotspotError) && (
          <div className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 border-t ${
            hotspotError 
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
              : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
          }`}>
            {hotspotError ? <AlertCircle size={15} className="shrink-0 text-rose-400" /> : <CheckCircle2 size={15} className="shrink-0 text-indigo-400" />}
            <span>{hotspotError || hotspotMsg}</span>
          </div>
        )}

        {/* Hotspot Configuration Form Panel */}
        {showHotspotConfig && (
          <form onSubmit={handleSaveHotspotConfig} className="p-5 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase tracking-wider">
                <Key size={14} className="text-indigo-400" />
                <span>Configuración de Punto de Acceso (Raspberry Pi OS)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Modo Wi-Fi AP (nmcli)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SSID Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Nombre del Punto de Acceso (SSID)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={ssidInput}
                    onChange={(e) => setSsidInput(e.target.value)}
                    placeholder="Ej. RaspiMC-AP"
                    required
                    maxLength={32}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Nombre de la red Wi-Fi visible para tus dispositivos.</p>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block flex items-center justify-between">
                  <span>Contraseña del Hotspot (WPA2-PSK)</span>
                  <span className={`text-[10px] font-mono ${passwordInput.length >= 8 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {passwordInput.length}/8+ caracteres
                  </span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                    maxLength={63}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-3.5 pr-10 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Debe tener al menos 8 caracteres. Se actualizará en NetworkManager (<code className="text-slate-400 font-mono">wifi-sec.psk</code>).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 italic">
                {status.hotspot?.active ? 'Si el hotspot está activo, se reiniciará para aplicar la nueva contraseña.' : 'La nueva contraseña se aplicará al activar el Hotspot.'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHotspotConfig(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig || passwordInput.length < 8 || !ssidInput.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1.5 transition cursor-pointer shadow border border-indigo-500"
                >
                  {isSavingConfig ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isSavingConfig ? 'Guardando en Linux...' : 'Guardar y Aplicar'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Host Specifications & System Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="system-details-panel">
        <div className="bg-slate-900/20 p-6 rounded-2xl border border-slate-800/50 space-y-4" id="host-specs">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Info size={16} className="text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-200">Especificaciones de Raspberry Pi</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 text-sm font-mono">
            <div>
              <span className="text-slate-500 block text-xs">Modelo / Sistema</span>
              <span className="text-slate-300 font-semibold">Raspberry Pi 3B (Linux ARM)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Dirección IP Local</span>
              <span className="text-slate-300 font-semibold">{status.ipAddress}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Carpeta de Servidores</span>
              <span className="text-slate-300 font-semibold truncate block" title={status.serversDir || '/var/lib/raspimc/servers'}>
                {status.serversDir || '/var/lib/raspimc/servers'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Conexión de Red</span>
              <span className={`font-semibold ${
                status.connectionType === 'wifi' ? 'text-indigo-400' :
                status.connectionType === 'ethernet' ? 'text-emerald-400' : 'text-slate-400 font-normal italic'
              }`}>
                {status.connectionType === 'wifi' ? `Wi-Fi (${status.wifiSsid || 'Conectado'})` :
                 status.connectionType === 'ethernet' ? `Ethernet (${status.adapterName || 'Cableado'})` :
                 'Linux Net (wlan0/eth0)'}
              </span>
            </div>
          </div>
        </div>

        {/* Service status panel */}
        <div className="bg-slate-900/20 p-6 rounded-2xl border border-slate-800/50 flex flex-col justify-between" id="service-status">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Clock size={16} className="text-indigo-400" />
              <h3 className="font-bold text-sm text-slate-200">Información del Servicio systemd</h3>
            </div>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Uptime de Pi:</span>
                <span className="text-slate-300 font-semibold">{status.uptime || 'No disponible'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Servicio systemd:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} /> raspimc.service Activo
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Puerto HTTP:</span>
                <span className="text-indigo-400 font-bold">3000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


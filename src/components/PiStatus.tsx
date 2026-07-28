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
  Info
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

  // Synchronize state with incoming status props
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    // Real refresh is triggered by the parent's polling, we can simulate visual feedback here
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  // Convert CPU history array into SVG coordinates for a beautiful sparkline
  const cpuHistoryToSvgPoints = (history: number[]): string => {
    const width = 280;
    const height = 60;
    const padding = 5;
    if (!history || history.length < 2) return '';
    const step = width / (history.length - 1);
    
    return history.map((val, idx) => {
      const x = idx * step;
      // Invert Y axis because 0 is top
      const y = height - padding - ((val / 100) * (height - padding * 2));
      return `${x},${y}`;
    }).join(' ');
  };

  // Percentages
  const ramPercentage = status.ramTotal > 0 ? (status.ramUsed / status.ramTotal) * 100 : 0;
  const storagePercentage = status.storageTotal > 0 ? (status.storageUsed / status.storageTotal) * 100 : 0;

  return (
    <div className="space-y-6" id="status-dashboard-view">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-800/80" id="status-header">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Estado del Host Windows</h2>
          <p className="text-sm text-slate-400">Monitoreo en tiempo real de recursos y servicios del servidor.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={`flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-850 active:scale-95 disabled:opacity-50 transition ${
              isRefreshing ? 'opacity-80' : ''
            }`}
            id="refresh-status-btn"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-400' : ''} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* Grid of System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="system-resource-grid">
        {/* CPU Monitoring Card */}
        <div className="bg-slate-900/25 p-6 rounded-2xl border border-slate-800/60 flex flex-col justify-between" id="cpu-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Uso de CPU</span>
              <p className="text-3xl font-extrabold text-slate-100 tracking-tight font-mono">
                {status.cpuUsage}%
              </p>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Cpu size={20} />
            </div>
          </div>
          
          {/* CPU Sparkline Chart */}
          <div className="mt-6 h-[60px] flex items-end">
            {status.cpuHistory && status.cpuHistory.length > 0 ? (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 280 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Area under curve */}
                <path
                  d={`M0,60 L${cpuHistoryToSvgPoints(status.cpuHistory)} L280,60 Z`}
                  fill="url(#cpuGradient)"
                />
                {/* Curve line */}
                <polyline
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  points={cpuHistoryToSvgPoints(status.cpuHistory)}
                />
              </svg>
            ) : (
              <span className="text-xs text-slate-600 italic">No hay historial disponible</span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Hace 30s</span>
            <span>Ahora</span>
          </div>
        </div>

        {/* RAM Monitoring Card */}
        <div className="bg-slate-900/25 p-6 rounded-2xl border border-slate-800/60 flex flex-col justify-between" id="ram-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Memoria RAM</span>
              <p className="text-3xl font-extrabold text-slate-100 tracking-tight font-mono">
                {status.ramUsed.toFixed(1)} <span className="text-sm text-slate-400">/ {status.ramTotal.toFixed(1)} GB</span>
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <Database size={20} />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="h-2 w-full bg-slate-850 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, ramPercentage)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium font-mono">
              <span className="text-slate-400">{ramPercentage.toFixed(0)}% Utilizado</span>
              <span className="text-slate-500">{(status.ramTotal - status.ramUsed).toFixed(1)} GB Libre</span>
            </div>
          </div>
        </div>

        {/* Disk Storage Card */}
        <div className="bg-slate-900/25 p-6 rounded-2xl border border-slate-800/60 flex flex-col justify-between" id="storage-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Almacenamiento</span>
              <p className="text-3xl font-extrabold text-slate-100 tracking-tight font-mono">
                {status.storageUsed.toFixed(1)} <span className="text-sm text-slate-400">/ {status.storageTotal.toFixed(0)} GB</span>
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <HardDrive size={20} />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="h-2 w-full bg-slate-850 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, storagePercentage)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium font-mono">
              <span className="text-slate-400">{storagePercentage.toFixed(0)}% Utilizado</span>
              <span className="text-slate-500">{(status.storageTotal - status.storageUsed).toFixed(1)} GB Libre</span>
            </div>
          </div>
        </div>
      </div>

      {/* Host Specifications Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="system-details-panel">
        <div className="bg-slate-900/20 p-6 rounded-2xl border border-slate-800/50 space-y-4" id="host-specs">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Info size={16} className="text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-200">Especificaciones del Host</h3>
          </div>
          <div className="grid grid-cols-2 gap-y-4 text-sm font-mono">
            <div>
              <span className="text-slate-500 block text-xs">Sistema Operativo</span>
              <span className="text-slate-300 font-semibold">Windows 10/11 x64</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Dirección IP Local</span>
              <span className="text-slate-300 font-semibold">{status.ipAddress}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Ubicación de Servidores</span>
              <span className="text-slate-300 font-semibold truncate block" title={status.serversDir || 'servers'}>
                {status.serversDir || 'servers'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Conexión de Red</span>
              <span className={`font-semibold ${
                status.connectionType === 'wifi' ? 'text-indigo-400' :
                status.connectionType === 'ethernet' ? 'text-emerald-450' : 'text-slate-400 font-normal italic'
              }`}>
                {status.connectionType === 'wifi' ? `Wi-Fi (${status.wifiSsid || 'Conectado'})` :
                 status.connectionType === 'ethernet' ? `Ethernet (${status.adapterName || 'Cableado'})` :
                 'No disponible / Desconocido'}
              </span>
            </div>
          </div>
        </div>

        {/* Service status panel */}
        <div className="bg-slate-900/20 p-6 rounded-2xl border border-slate-800/50 flex flex-col justify-between" id="service-status">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Clock size={16} className="text-indigo-400" />
              <h3 className="font-bold text-sm text-slate-200">Información del Sistema</h3>
            </div>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Uptime del Servidor:</span>
                <span className="text-slate-300 font-semibold">{status.uptime || 'No disponible'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Daemon de Control:</span>
                <span className="text-emerald-400 font-bold">Activo y Respondiendo</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Carpeta de Servidores:</span>
                <span className="text-slate-300 font-bold truncate max-w-[150px]" title={status.serversDir || 'servers'}>
                  {status.serversDir || 'servers'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

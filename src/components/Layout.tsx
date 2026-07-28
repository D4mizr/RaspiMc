/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RoutePage } from '../useRouter';
import { 
  Cpu, 
  Database, 
  Terminal, 
  Settings, 
  Menu, 
  X, 
  Layers,
  Network,
  Server,
  FileText
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: RoutePage;
  currentServerName: string | null;
  navigate: (path: string) => void;
  piIpAddress: string;
}

export default function Layout({ 
  children, 
  currentPage, 
  currentServerName, 
  navigate,
  piIpAddress
}: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Simplified navigation items (removed Hotspots/WiFi pages completely)
  const navigationItems = [
    {
      id: 'raspi-status',
      name: 'Estado del Sistema',
      icon: Cpu,
      path: '/raspi/status',
      category: 'Raspberry Pi OS'
    },
    {
      id: 'settings',
      name: 'Ajustes del Sistema',
      icon: Settings,
      path: '/settings',
      category: 'Raspberry Pi OS'
    },
    {
      id: 'mc-list',
      name: 'Servidores Minecraft',
      icon: Database,
      path: '/mc',
      category: 'Minecraft Server'
    }
  ];

  // Server-specific subnavigation items
  const serverNavItems = currentServerName ? [
    {
      id: 'mc-detail',
      name: `Resumen: ${currentServerName}`,
      icon: Layers,
      path: `/mc/${encodeURIComponent(currentServerName)}`
    },
    {
      id: 'mc-config',
      name: 'Configuración',
      icon: Settings,
      path: `/mc/${encodeURIComponent(currentServerName)}/config`
    },
    {
      id: 'mc-console',
      name: 'Consola y Comandos',
      icon: Terminal,
      path: `/mc/${encodeURIComponent(currentServerName)}/console`
    },
    {
      id: 'mc-logs',
      name: 'Archivos de Logs',
      icon: FileText,
      path: `/mc/${encodeURIComponent(currentServerName)}/logs`
    }
  ] : [];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans flex flex-col md:flex-row bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950" id="app-container">
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 z-40 shrink-0" id="mobile-header">
        <div className="flex items-center space-x-2">
          <img
            src="/icon.png"
            alt="RaspiMC Logo"
            className="w-8 h-8 rounded-lg object-cover border border-slate-700 shadow"
            referrerPolicy="no-referrer"
          />
          <div>
            <span className="font-bold text-sm tracking-tight block text-slate-150">RaspiMC Admin</span>
            <span className="text-[10px] text-slate-400 block -mt-1 font-mono">{piIpAddress}</span>
          </div>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-850 transition"
          aria-label="Toggle menu"
          id="mobile-menu-toggle"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-slate-900/40 backdrop-blur-md text-slate-300 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col md:h-screen border-r border-slate-800 shrink-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        id="sidebar"
      >
        {/* Logo Section */}
        <div className="hidden md:flex items-center space-x-3 px-6 py-5 border-b border-slate-800/80" id="sidebar-logo">
          <img
            src="/icon.png"
            alt="RaspiMC Logo"
            className="w-9 h-9 rounded-lg object-cover border border-slate-700 shadow-md shadow-indigo-500/10"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="font-bold text-slate-100 text-sm tracking-tight">RaspiMC Panel</h1>
            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              {piIpAddress}
            </p>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto" id="sidebar-nav">
          {/* Raspberry Pi OS section */}
          <div>
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              Raspberry Pi OS
            </p>
            <div className="space-y-1">
              {navigationItems.filter(item => item.category === 'Raspberry Pi OS').map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    className={`
                      w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition duration-200 group border
                      ${isActive 
                        ? 'bg-slate-800 text-indigo-400 font-medium border-slate-700/50 shadow shadow-indigo-900/10' 
                        : 'hover:bg-slate-800/40 hover:text-slate-100 border-transparent'
                      }
                    `}
                    id={`nav-link-${item.id}`}
                  >
                    <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minecraft Servers Section */}
          <div>
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              Minecraft Servers
            </p>
            <div className="space-y-1">
              {navigationItems.filter(item => item.category === 'Minecraft Server').map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.path)}
                    className={`
                      w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition duration-200 group border
                      ${isActive 
                        ? 'bg-slate-800 text-indigo-400 font-medium border-slate-700/50 shadow shadow-indigo-900/10' 
                        : 'hover:bg-slate-800/40 hover:text-slate-100 border-transparent'
                      }
                    `}
                    id={`nav-link-${item.id}`}
                  >
                    <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Server Contextual Navigation */}
          {currentServerName && (
            <div className="pt-4 border-t border-slate-850 animate-fadeIn">
              <div className="flex items-center justify-between px-3 mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Admin Servidor
                </p>
                <span className="text-[10px] bg-slate-950 text-indigo-400 font-mono px-1.5 py-0.5 rounded border border-indigo-500/20 max-w-[100px] truncate">
                  {currentServerName}
                </span>
              </div>
              <div className="space-y-1">
                {serverNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.path)}
                      className={`
                        w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition duration-200 group border
                        ${isActive 
                          ? 'bg-slate-800 text-slate-100 border-slate-700/50 border-l-4 border-l-indigo-500 rounded-l-none' 
                          : 'hover:bg-slate-800/40 hover:text-slate-100 border-transparent'
                        }
                      `}
                      id={`nav-link-${item.id}`}
                    >
                      <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Overlay to close mobile menu */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          id="mobile-backdrop"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" id="main-content-wrapper">
        {/* Top bar for large screens */}
        <div className="hidden md:flex items-center justify-between px-8 h-16 bg-slate-900/20 backdrop-blur-sm border-b border-slate-800 shrink-0" id="top-navbar">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-400 flex items-center gap-1.5">
              <Network size={14} className="text-slate-500" />
              <span>Host IP:</span>
              <strong className="font-semibold text-slate-200 font-mono">
                {piIpAddress}
              </strong>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-900/40 border border-slate-800 rounded-full text-xs text-slate-400 font-medium">
              <Server size={12} />
              <span>Minecraft Daemon Active</span>
            </div>
          </div>
        </div>

        {/* View Content container with simple clean padding */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto" id="main-content">
          {children}
        </div>
      </main>
    </div>
  );
}

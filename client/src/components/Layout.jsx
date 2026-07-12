import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Activity, LogOut, Cpu } from 'lucide-react';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(user.name || 'User');
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/projects', label: 'Projects & Queues', icon: FolderKanban },
    { path: '/jobs', label: 'Job Explorer', icon: Activity },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#070b13]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0d1527] border-r border-gray-800 flex flex-col justify-between">
        <div>
          {/* Logo / Header */}
          <div className="h-16 flex items-center px-6 border-b border-gray-800 gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              AG Job Scheduler
            </span>
          </div>

          {/* Nav links */}
          <nav className="mt-6 px-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/10 border-l-4 border-indigo-500 text-white font-medium shadow-sm'
                      : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer / Logout */}
        <div className="p-4 border-t border-gray-800 bg-[#0a101e]/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-200">{userName}</span>
              <span className="text-xs text-gray-500">Developer</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-800 hover:border-red-900/50 hover:bg-red-950/20 text-gray-400 hover:text-red-400 transition-all duration-200 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-[#0d1527]/50 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
              Distributed Scheduler Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Environment: <strong className="text-indigo-400">Development</strong></span>
          </div>
        </header>

        {/* Dynamic Pages */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

// ============================================================================
// Dashboard Layout — Sidebar + Content
// ============================================================================

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  Leaf, LayoutDashboard, History, Settings, Shield, LogOut,
  Sun, Moon, Menu, X, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/history', label: 'History', icon: History },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout() {
  const { user, logout, isMockMode } = useAuth();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-eco-bg dark:bg-dark-bg">
      {/* Sidebar — Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col h-full border-r border-eco-border dark:border-dark-border bg-white dark:bg-dark-surface">
          {/* Logo */}
          <div className="p-6 border-b border-eco-border dark:border-dark-border">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-serif text-lg text-eco-text dark:text-dark-text block leading-tight">EcoRoute</span>
                <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">AI Router</span>
              </div>
            </Link>
          </div>

          {/* Explicit Mock Mode Banner (Simulation only) */}
          {isMockMode && (
            <div className="mx-4 mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-caption text-amber-700 dark:text-amber-400 font-medium">Simulation Mode Active</p>
              <p className="text-caption text-amber-600 dark:text-amber-500">AI_MOCK_MODE=true enabled</p>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'text-eco-text-secondary dark:text-dark-text-secondary hover:bg-eco-surface dark:hover:bg-dark-surface-2 hover:text-eco-text dark:hover:text-dark-text'
                  }`}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-3 text-caption font-medium text-eco-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Admin</span>
                </div>
                <Link to="/admin"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-sm font-medium transition-all duration-200 ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                      : 'text-eco-text-secondary dark:text-dark-text-secondary hover:bg-eco-surface dark:hover:bg-dark-surface-2'
                  }`}>
                  <Shield className="w-5 h-5" />
                  Admin Panel
                </Link>
              </>
            )}
          </nav>

          {/* User & Theme */}
          <div className="p-4 border-t border-eco-border dark:border-dark-border space-y-3">
            <button onClick={toggle}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-body-sm text-eco-text-secondary dark:text-dark-text-secondary hover:bg-eco-surface dark:hover:bg-dark-surface-2 transition-colors">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>

            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-300 font-medium text-body-sm">
                {user?.displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-eco-text dark:text-dark-text truncate">{user?.displayName}</p>
                <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary truncate">{user?.email}</p>
              </div>
            </div>

            <button onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-body-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-xl border-b border-eco-border dark:border-dark-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-lg text-eco-text dark:text-dark-text">EcoRoute</span>
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-eco-text dark:text-dark-text"
            aria-label="Toggle menu">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="px-4 pb-4 space-y-1 animate-slide-down">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-3 rounded-lg text-body-sm ${
                  location.pathname === item.path ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700' : 'text-eco-text-secondary'
                }`}>
                <span className="flex items-center gap-3"><item.icon className="w-5 h-5" />{item.label}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-body-sm text-eco-text-secondary">
                <Shield className="w-5 h-5" /> Admin Panel
              </Link>
            )}
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 w-full rounded-lg text-body-sm text-red-600">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

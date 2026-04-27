"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
    LayoutDashboard, 
    Users, 
    Calendar as CalendarIcon, 
    LogOut,
    UserCircle,
    Menu,
    X
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationBell from '@/components/NotificationBell';
import './admin.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      setUser(user);
      setLoading(false);
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  const menuItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Clients', path: '/admin/clients', icon: <Users size={20} /> },
    { name: 'Client Calendars', path: '/admin/client-calendar', icon: <CalendarIcon size={20} /> },
    { name: 'Team Management', path: '/admin/team', icon: <UserCircle size={20} /> },
    { name: 'Master Calendar', path: '/admin/master-calendar', icon: <CalendarIcon size={20} /> },
  ];

  return (
    <div className="dashboard-container">
      {/* Mobile Header Top */}
      <div className="mobile-header-top">
        <div className="menu-toggle" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </div>
        <img src="/logo.png" alt="TrueUp Media" className="logo-img" style={{ height: '24px', width: 'auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationBell />
        </div>
      </div>

      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="logo-container" style={{ padding: '24px 20px', marginBottom: '10px' }}>
          <img src="/logo.png" alt="TrueUp Media" className="logo-img" style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
          <button 
            className="sidebar-close" 
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav style={{ flex: 1 }}>
          <p className="sidebar-label">Navigation</p>
          {menuItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
              className={`nav-item ${pathname === item.path ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="sidebar-label" style={{ margin: 0 }}>Appearance</p>
            <ThemeToggle style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
          </div>
          <div className="user-info-box">
            <div className="user-avatar">
              <UserCircle size={24} />
            </div>
            <div>
              <p className="user-name">Administrator</p>
              <p className="user-role">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 2100 }}>
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}

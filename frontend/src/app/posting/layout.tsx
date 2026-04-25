"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
    ListChecks,
    Calendar as CalendarIcon,
    Globe,
    LogOut,
    UserCircle,
    Menu,
    X,
    Send
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import '../admin/admin.css';

export default function PostingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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

    return (
        <div className="dashboard-container">
            <button
                className="mobile-menu-toggle"
                onClick={() => setSidebarOpen(true)}
                style={{ display: sidebarOpen ? 'none' : 'flex' }}
            >
                <Menu size={24} />
            </button>

            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
                <div className="logo-container">
                    <img src="/logo.png" alt="TrueUp Media" className="logo-img" />
                    <span style={{ marginLeft: '4px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Posting</span>
                    <button
                        className="sidebar-close"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav style={{ flex: 1 }}>
                    <p className="sidebar-label">Navigation</p>
                    {/* Navigation is handled inside the dashboard page via state */}
                    <div style={{ padding: '0 8px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '10px',
                            background: 'var(--bg-hover)', color: 'var(--accent)',
                            border: '1px solid var(--border-hover)',
                            boxShadow: '0 0 20px var(--accent-glow)',
                            fontSize: '14px', fontWeight: 600
                        }}>
                            <Send size={20} />
                            <span>Posting Dashboard</span>
                        </div>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <p className="sidebar-label" style={{ margin: 0 }}>Appearance</p>
                        <ThemeToggle style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                    </div>
                    <div className="user-info-box">
                        <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '12px', fontWeight: 800 }}>
                            PT
                        </div>
                        <div>
                            <p className="user-name">Posting Team</p>
                            <p className="user-role">{user?.email}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    parseISO
} from 'date-fns';
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LayoutDashboard,
    Globe,
    Calendar as CalendarIcon,
    FileText,
    Video,
    CheckCircle2,
    X,
    LogOut,
    Filter,
    Menu,
    Send,
    Inbox,
    UserCircle,
    ShieldAlert,
    AlertTriangle,
    ArrowRight
} from 'lucide-react';
import { postingApi, emergencyApi } from '@/lib/api';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import NotificationBell from '@/components/NotificationBell';

interface ContentItem {
    id: string;
    title: string;
    description: string;
    content_type: 'Post' | 'Reel';
    scheduled_datetime: string;
    status: string;
    client_id: string;
    is_emergency?: boolean;
    clients?: { company_name: string };
}

export default function PostingDashboard() {
    const [view, setView] = useState<'dashboard' | 'client' | 'master'>('dashboard');
    const [queue, setQueue] = useState<ContentItem[]>([]);
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [loading, setLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [postingId, setPostingId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [activeItem, setActiveItem] = useState<any>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, percentage: 0, remaining: 0 });
    const [emergencyTasks, setEmergencyTasks] = useState<ContentItem[]>([]);

    const router = useRouter();
    const supabase = createClient();

    // Fetch stats for the meter
    const fetchTodayStats = async () => {
        try {
            const res = await postingApi.getMasterCalendar(format(new Date(), 'yyyy-MM'));
            const data = res.data as ContentItem[];
            const today = new Date();
            const todayItems = data.filter(item => isSameDay(parseISO(item.scheduled_datetime), today));
            const totalToday = todayItems.length;
            const completedToday = todayItems.filter(item => item.status === 'POSTED').length;
            setTodayStats({
                total: totalToday,
                completed: completedToday,
                remaining: totalToday - completedToday,
                percentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0
            });

            // Fetch all emergency tasks
            const emergencyRes = await emergencyApi.getAll();
            setEmergencyTasks(emergencyRes.data);
        } catch (err) { console.error('Error fetching today stats:', err); }
    };

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUser(user);
        };
        fetchUser();
        fetchClients();
        fetchTodayStats();
    }, []);

    useEffect(() => {
        if (view === 'dashboard') {
            fetchTodayQueue();
        } else if (view === 'client' && selectedClient && selectedClient !== 'all') {
            fetchClientCalendar();
        } else if (view === 'master') {
            fetchMasterCalendar();
        }
    }, [view, selectedClient, currentMonth]);

    const fetchClients = async () => {
        try {
            const res = await postingApi.getClients();
            setClients(res.data);
            if (res.data.length > 0 && selectedClient === 'all') {
                // Keep 'all' for master, but maybe select first for client view if needed
            }
        } catch (err) { console.error(err); }
    };

    const fetchTodayQueue = async () => {
        setLoading(true);
        try {
            const res = await postingApi.getToday();
            setQueue(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchClientCalendar = async () => {
        if (selectedClient === 'all') return;
        setLoading(true);
        try {
            const res = await postingApi.getCalendar(selectedClient, format(currentMonth, 'yyyy-MM'));
            setCalendarData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchMasterCalendar = async () => {
        setLoading(true);
        try {
            const res = await postingApi.getMasterCalendar(
                format(currentMonth, 'yyyy-MM'),
                selectedClient === 'all' ? undefined : selectedClient
            );
            setCalendarData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleMarkPosted = async (id: string) => {
        setPostingId(id);
        try {
            const actorId = user?.id;
            await postingApi.markAsPosted(id, actorId);
            setToast('Content marked as POSTED!');
            setTimeout(() => setToast(null), 3000);
            
            // Refresh
            fetchTodayStats();
            if (view === 'dashboard') fetchTodayQueue();
            else if (view === 'client') fetchClientCalendar();
            else fetchMasterCalendar();
            
            if (activeItem?.item?.id === id) {
                const res = await postingApi.getContentDetails(id);
                setActiveItem(res.data);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to mark as posted');
        } finally { setPostingId(null); }
    };

    const handleItemClick = async (item: ContentItem) => {
        try {
            const res = await postingApi.getContentDetails(item.id);
            setActiveItem(res.data);
            setIsDetailsOpen(true);
        } catch (err) { console.error(err); }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });

    const queuePosts = queue.filter(i => i.content_type === 'Post').length;
    const queueReels = queue.filter(i => i.content_type === 'Reel').length;

    return (
        <div className="dashboard-container">
            <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 2100 }}>
                <NotificationBell />
            </div>
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="logo-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>TrueUp</span>
                        <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, marginTop: '2px' }}>POSTING</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="sidebar-close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 sidebar-nav">
                    <p className="sidebar-label">Navigation</p>
                    <div
                        onClick={() => setView('dashboard')}
                        className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={20} />
                        <span>Today's Queue</span>
                    </div>
                    <div
                        onClick={() => setView('client')}
                        className={`nav-item ${view === 'client' ? 'active' : ''}`}
                    >
                        <CalendarIcon size={20} />
                        <span>Client Calendar</span>
                    </div>
                    <div
                        onClick={() => setView('master')}
                        className={`nav-item ${view === 'master' ? 'active' : ''}`}
                    >
                        <Globe size={20} />
                        <span>Master Calendar</span>
                    </div>

                    {view === 'client' && (
                        <>
                            <p className="sidebar-label">Clients</p>
                            <div className="client-list">
                                {clients.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={() => setSelectedClient(c.id)}
                                        className={`client-item ${selectedClient === c.id ? 'selected' : ''}`}
                                    >
                                        <div className="client-avatar">
                                            {c.company_name?.charAt(0) || '?'}
                                        </div>
                                        <span>{c.company_name}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <p className="sidebar-label" style={{ margin: 0 }}>Appearance</p>
                        <ThemeToggle style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                    </div>
                    <div className="user-info-box">
                        <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>PT</div>
                        <div>
                            <p className="user-name">Posting Team</p>
                            <p className="user-role">TrueUp Media</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn" title="Sign Out">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <div className="mobile-header-top">
                    <div className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={24} />
                    </div>
                    <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 800 }}>TrueUp</span>
                    <div style={{ width: '40px' }}></div>
                </div>

                <header className="page-header">
                    <div className="header-content">
                        <div className="header-info">
                            <h1 className="page-title">
                                {view === 'dashboard' && "Today's Posting Queue"}
                                {view === 'client' && 'Client Calendar'}
                                {view === 'master' && 'Master Calendar'}
                            </h1>
                            <p className="page-subtitle">
                                {view === 'dashboard' && `${format(new Date(), 'EEEE, MMMM d')} — Content ready for publishing`}
                                {view === 'client' && 'Manage posting schedule for individual clients'}
                                {view === 'master' && 'Review company-wide posting pipeline'}
                            </p>
                        </div>

                        <div className="header-controls">
                            {view === 'client' && (
                                <div className="client-dropdown-wrapper">
                                    <select
                                        className="client-dropdown"
                                        value={selectedClient}
                                        onChange={(e) => setSelectedClient(e.target.value)}
                                    >
                                        <option value="all" disabled={selectedClient !== 'all'}>Select a client</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.company_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="dropdown-chevron" />
                                </div>
                            )}

                            {view === 'master' && (
                                <div className="master-filters-container">
                                    <div className="filter-icon-box">
                                        <Filter size={14} />
                                    </div>
                                    <div className="client-dropdown-wrapper">
                                        <select
                                            className="client-dropdown"
                                            value={selectedClient}
                                            onChange={(e) => setSelectedClient(e.target.value)}
                                        >
                                            <option value="all">All Clients</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.company_name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="dropdown-chevron" />
                                    </div>
                                </div>
                            )}

                            {view !== 'dashboard' && (
                                <div className="month-nav">
                                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="month-btn"><ChevronLeft size={20} /></button>
                                    <span className="month-label">{format(currentMonth, 'MMMM yyyy')}</span>
                                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="month-btn"><ChevronRight size={20} /></button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {view === 'dashboard' && (
                    <div className="daily-stats-banner">
                        <div className="progress-meter-card">
                            <div className="progress-info">
                                <h3 className="stat-label">Today's Progress</h3>
                                <div className="progress-values">
                                    <span className="current">{todayStats.completed}</span>
                                    <span className="separator">/</span>
                                    <span className="total">{todayStats.total}</span>
                                    <span className="unit"> Tasks Posted</span>
                                </div>
                            </div>
                            <div className="meter-container">
                                <div className="meter-bar">
                                    <div className="meter-fill" style={{ width: `${todayStats.percentage}%` }}>
                                        <div className="meter-glow"></div>
                                    </div>
                                </div>
                                <div className="meter-label">
                                    <span className="meter-percentage">{todayStats.percentage}% Complete</span>
                                    <span>{todayStats.remaining} tasks remaining today</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'dashboard' && emergencyTasks.length > 0 && (
                    <div className="emergency-panel">
                        <div className="emergency-panel-header">
                            <ShieldAlert size={24} color="#ef4444" />
                            <h2 className="emergency-panel-title">All Emergency Tasks</h2>
                        </div>
                        <div className="emergency-list">
                            {emergencyTasks.map(task => (
                                <div 
                                    key={task.id} 
                                    className="emergency-card"
                                    onClick={() => handleItemClick(task)}
                                >
                                    <div className="emergency-card-icon">
                                        {task.content_type === 'Post' ? <FileText size={20} /> : <Video size={20} />}
                                    </div>
                                    <div className="emergency-card-info">
                                        <p className="emergency-card-client">{task.clients?.company_name}</p>
                                        <p className="emergency-card-type">{task.content_type} • {format(parseISO(task.scheduled_datetime), 'p')}</p>
                                    </div>
                                    <ArrowRight size={18} color="var(--text-muted)" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'dashboard' && (
                    <div className="dashboard-view">
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)' }}>
                                    <Inbox size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Total Queue</h3>
                                    <p className="stat-value">{queue.length}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                                    <FileText size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Posts</h3>
                                    <p className="stat-value">{queuePosts}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                                    <Video size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Reels</h3>
                                    <p className="stat-value">{queueReels}</p>
                                </div>
                            </div>
                        </div>

                        <div className="posting-queue-section" style={{ marginTop: '24px' }}>
                            <div className="dashboard-card">
                                <div className="card-header">
                                    <h3 className="card-title">Live Posting Queue</h3>
                                    <span className="card-badge">Action Required</span>
                                </div>
                                
                                {loading ? (
                                    <div className="posting-queue">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="queue-item" style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                                                <Skeleton className="h-10 w-full" />
                                            </div>
                                        ))}
                                    </div>
                                ) : queue.length === 0 ? (
                                    <div className="posting-empty-state">
                                        <div className="empty-icon"><CheckCircle2 size={36} /></div>
                                        <h3>All Caught Up!</h3>
                                        <p>No content is currently waiting to be posted.</p>
                                    </div>
                                ) : (
                                    <div className="posting-queue">
                                        {queue.map(item => (
                                            <div key={item.id} className="queue-item">
                                                <div className="queue-item-left" onClick={() => handleItemClick(item)}>
                                                    <div className="queue-time-badge">
                                                        <span className="time-text">{format(parseISO(item.scheduled_datetime), 'hh:mm')}</span>
                                                        <span className="ampm-text">{format(parseISO(item.scheduled_datetime), 'a')}</span>
                                                    </div>
                                                    <div className="queue-item-info">
                                                        <span className="queue-item-client">{item.clients?.company_name}</span>
                                                        <span className="queue-item-title">{item.title}</span>
                                                    </div>
                                                </div>
                                                <div className="queue-item-right">
                                                    <span className={`queue-type-badge ${item.content_type.toLowerCase()}`}>
                                                        {item.content_type === 'Post' ? <FileText size={12} /> : <Video size={12} />}
                                                        {item.content_type}
                                                    </span>
                                                    <button
                                                        className="btn-mark-posted"
                                                        onClick={() => handleMarkPosted(item.id)}
                                                        disabled={postingId === item.id}
                                                    >
                                                        {postingId === item.id ? 'Posting...' : 'Mark as Posted'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {(view === 'client' || view === 'master') && (
                    <div className="calendar-card">
                        <div className="calendar-grid">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="calendar-header-cell">
                                    <span className="desktop-day">{day}</span>
                                    <span className="mobile-day">{day.charAt(0)}</span>
                                </div>
                            ))}

                            {loading ? (
                                Array.from({ length: 35 }).map((_, idx) => (
                                    <div key={idx} className="calendar-day" style={{ minHeight: '110px' }}>
                                        <Skeleton className="h-4 w-4 mb-2" />
                                        <Skeleton className="h-4 w-full" />
                                    </div>
                                ))
                            ) : (
                                days.map((day, idx) => {
                                    const dayContent = calendarData.filter(item => {
                                        const itemDate = parseISO(item.scheduled_datetime);
                                        return isSameDay(itemDate, day);
                                    });
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => { if (dayContent.length > 0) handleItemClick(dayContent[0]); }}
                                            className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                            style={{ minHeight: '110px', cursor: dayContent.length > 0 ? 'pointer' : 'default' }}
                                        >
                                            <span className="day-number">{format(day, 'd')}</span>
                                            <div className="day-items desktop-only">
                                                {dayContent.map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                                        className={`content-item ${item.content_type.toLowerCase()} ${item.is_emergency ? 'emergency' : ''}`}
                                                    >
                                                        {item.content_type === 'Post' ? <FileText size={10} /> : <Video size={10} />}
                                                        <span className="truncate">
                                                            {view === 'master' ? `[${item.clients?.company_name?.substring(0, 3)}] ` : ''}
                                                            {item.title}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Details Modal */}
            {isDetailsOpen && activeItem && (
                <div className="modal-overlay" onClick={() => setIsDetailsOpen(false)}>
                    <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{activeItem.item.title}</h3>
                            <button onClick={() => setIsDetailsOpen(false)} className="modal-close"><X size={20} /></button>
                        </div>
                        
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                <div>
                                    <div className="detail-field" style={{ marginBottom: '16px' }}>
                                        <label className="sidebar-label" style={{ padding: 0 }}>Client</label>
                                        <p style={{ fontWeight: 700, fontSize: '16px' }}>{activeItem.item.clients?.company_name}</p>
                                    </div>
                                    <div className="detail-field" style={{ marginBottom: '16px' }}>
                                        <label className="sidebar-label" style={{ padding: 0 }}>Scheduled For</label>
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Clock size={16} />
                                            {format(parseISO(activeItem.item.scheduled_datetime), 'PPP p')}
                                        </p>
                                    </div>
                                    <div className="detail-field">
                                        <label className="sidebar-label" style={{ padding: 0 }}>Description</label>
                                        <p style={{ color: 'var(--text-secondary)' }}>{activeItem.item.description || 'No description provided.'}</p>
                                    </div>
                                </div>
                                <div>
                                    <div className="detail-field" style={{ marginBottom: '16px' }}>
                                        <label className="sidebar-label" style={{ padding: 0 }}>Status</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                            <span className={`status-badge ${activeItem.item.status.toLowerCase().replace(/ /g, '-')}`}>
                                                {activeItem.item.status}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {activeItem.item.status === 'WAITING FOR POSTING' && (
                                        <button
                                            className="btn-mark-posted"
                                            style={{ width: '100%', marginTop: '24px', padding: '16px', fontSize: '16px' }}
                                            onClick={() => handleMarkPosted(activeItem.item.id)}
                                            disabled={postingId === activeItem.item.id}
                                        >
                                            {postingId === activeItem.item.id ? 'Posting...' : 'Mark as Posted'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginTop: '32px' }}>
                                <label className="sidebar-label" style={{ padding: 0 }}>Status History</label>
                                <div className="history-timeline" style={{ marginTop: '16px' }}>
                                    {activeItem.history?.map((h: any, i: number) => (
                                        <div key={i} className="history-item" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)', marginTop: '4px' }}></div>
                                            <div>
                                                <p style={{ fontWeight: 600, fontSize: '14px' }}>{h.old_status} → {h.new_status}</p>
                                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {h.users?.name || 'System'} • {format(parseISO(h.changed_at), 'MMM d, h:mm a')}
                                                </p>
                                                {h.note && <p style={{ fontSize: '13px', fontStyle: 'italic', marginTop: '4px' }}>"{h.note}"</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="posting-toast">
                    <CheckCircle2 size={20} />
                    {toast}
                </div>
            )}
        </div>
    );
}

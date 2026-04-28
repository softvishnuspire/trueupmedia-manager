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
    Plus, 
    LayoutDashboard,
    Globe, 
    Users,
    Clock,
    FileText,
    Video,
    CheckCircle2,
    Calendar as CalendarIcon,
    X,
    ArrowRight,
    Search,
    LogOut,
    Check,
    ShieldAlert,
    AlertTriangle,
    Menu
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { tlApi, gmApi, emergencyApi, ContentItem, PocNote, StatusHistoryItem } from '@/lib/api';
import { createClient } from '@/utils/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import NotificationBell from '@/components/NotificationBell';
import ScheduleExport from '@/components/ScheduleExport';
import ThemeToggle from '@/components/ThemeToggle';
import '../../admin/admin.css'; // Using Admin Panel UI styles

interface ContentDetails {
    item: ContentItem;
    history: StatusHistoryItem[];
}

const normalizeRole = (role?: string | null) => (role || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');

export default function TLDashboard() {
    const supabase = createClient();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'dashboard' | 'client' | 'master' | 'poc'>('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, percentage: 0, remaining: 0 });
    const [emergencyTasks, setEmergencyTasks] = useState<ContentItem[]>([]);
    const [pocNotes, setPocNotes] = useState<PocNote[]>([]);
    const [isPocModalOpen, setIsPocModalOpen] = useState(false);
    const [selectedPocDate, setSelectedPocDate] = useState<Date | null>(null);
    const [selectedPocClient, setSelectedPocClient] = useState<string>('');
    const [pocNoteText, setPocNoteText] = useState('');
    const [selectedPocNote, setSelectedPocNote] = useState<PocNote | null>(null);
    const [isPocDetailsOpen, setIsPocDetailsOpen] = useState(false);

    useEffect(() => {
        if (calendarData.length > 0) {
            const today = new Date();
            const todayItems = calendarData.filter(item => isSameDay(parseISO(item.scheduled_datetime), today));
            const totalToday = todayItems.length;
            const completedToday = todayItems.filter(item => item.status === 'POSTED').length;
            setTodayStats({
                total: totalToday,
                completed: completedToday,
                remaining: totalToday - completedToday,
                percentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0
            });
        } else {
            setTodayStats({ total: 0, completed: 0, percentage: 0, remaining: 0 });
        }
    }, [calendarData]);

    
    // Details modal state
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [activeItem, setActiveItem] = useState<ContentDetails | null>(null);
    const [statusNote, setStatusNote] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);


    const isMasterMode = view === 'master';






    const fetchClients = async (tlId: string) => {
        try {
            const res = await tlApi.getClients(tlId);
            setClients(res.data);
            if (res.data.length > 0 && !selectedClient) {
                setSelectedClient(res.data[0].id);
            }
            if (res.data.length > 0 && !selectedPocClient) {
                setSelectedPocClient(res.data[0].id);
            }
        } catch (err) { console.error('Error fetching clients:', err); }
    };

    const fetchClientCalendar = async () => {
        if (!user || !selectedClient) return;
        setLoading(true);
        try {
            const res = await tlApi.getCalendar(selectedClient, format(currentMonth, 'yyyy-MM'), user.id);
            setCalendarData(res.data);
        } catch (err) { 
            console.error('Error fetching calendar:', err);
        } finally { 
            setLoading(false); 
        }
    };


    const fetchMasterCalendar = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await tlApi.getMasterCalendar(format(currentMonth, 'yyyy-MM'), user.id);
            setCalendarData(res.data);
            
            // Fetch and filter emergency tasks for assigned clients
            const emergencyRes = await emergencyApi.getAll();
            const assignedClientIds = clients.map(c => c.id);
            const filteredEmergency = (emergencyRes.data || []).filter(task => assignedClientIds.includes(task.client_id));
            setEmergencyTasks(filteredEmergency);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchPocNotes = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await tlApi.getPocNotes(format(currentMonth, 'yyyy-MM'), user.id);
            setPocNotes(res.data || []);
        } catch (err) {
            console.error('Error fetching POC notes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            if (view === 'master' || view === 'dashboard') {
                fetchMasterCalendar();
            } else if (view === 'poc') {
                fetchPocNotes();
            } else if (view === 'client' && selectedClient) {
                fetchClientCalendar();
            }
        }
    }, [selectedClient, currentMonth, view, user, clients]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();

                if (!authUser) {
                    window.location.href = '/';
                    return;
                }

                // Verify role
                const { data: profileData, error: profileError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .single();

                const role = normalizeRole(profileData?.role);
                const isTeamLead = ['tl', 'tl1', 'tl2', 'team lead'].includes(role);

                if (profileError || !profileData || !isTeamLead) {
                    console.warn('Profile validation check:', { role: profileData?.role, isTeamLead });
                }

                setUser(authUser);
                setProfile(profileData);
                await fetchClients(authUser.id);
            } catch (err) {
                console.error('Initialization error:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handlePocDayClick = (date: Date) => {
        setSelectedPocDate(date);
        setPocNoteText('');
        setIsPocModalOpen(true);
    };

    const handleSavePocNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedPocDate || !selectedPocClient || !pocNoteText.trim()) return;
        try {
            await tlApi.addPocNote({
                tlId: user.id,
                client_id: selectedPocClient,
                note_date: format(selectedPocDate, 'yyyy-MM-dd'),
                note_text: pocNoteText.trim()
            });
            setIsPocModalOpen(false);
            setPocNoteText('');
            await fetchPocNotes();
        } catch (err) {
            console.error('Error saving POC note:', err);
            alert('Failed to save note');
        }
    };

    const handlePocNoteClick = (note: PocNote) => {
        setSelectedPocNote(note);
        setIsPocDetailsOpen(true);
    };

    const handlePrev = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNext = () => setCurrentMonth(addMonths(currentMonth, 1));

    const handleItemClick = async (item: ContentItem) => {
        try {
            const res = await gmApi.getContentDetails(item.id);
            setActiveItem(res.data);
            setIsDetailsOpen(true);
        } catch (err) { console.error(err); }
    };

    const handleStatusUpdate = async (newStatus: string) => {
        try {
            // Get the current authenticated user ID directly to ensure it's not null
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const actorId = authUser?.id || profile?.user_id || user?.user_id;
            
            console.log('Updating status:', { newStatus, note: statusNote, actorId });
            
            if (!activeItem) return;
            await gmApi.updateStatus(activeItem.item.id, newStatus, statusNote.trim() || undefined, actorId);
            
            if (!activeItem) return;
            const res = await gmApi.getContentDetails(activeItem.item.id);

            setActiveItem(res.data);
            if (isMasterMode) fetchMasterCalendar(); else fetchClientCalendar();
        } catch (err: any) {
            console.error('Status update error:', err);
            alert(err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });

    const monthStatusCounts = calendarData.reduce(
        (acc, item) => {
            const normalizedStatus = (item.status || '').toUpperCase();
            if (normalizedStatus.includes('CONTENT')) acc.content += 1;
            if (normalizedStatus.includes('DESIGN')) acc.design += 1;
            if (normalizedStatus === 'POSTED') acc.posted += 1;
            return acc;
        },
        { content: 0, design: 0, posted: 0 }
    );
    const monthTotal = calendarData.length;
    const monthCompleted = monthStatusCounts.posted;
    const monthPercentage = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekItems = calendarData.filter(item => {
        const itemDate = parseISO(item.scheduled_datetime);
        return itemDate >= weekStart && itemDate <= weekEnd;
    });
    const weekTotal = weekItems.length;
    const weekCompleted = weekItems.filter(item => (item.status || '').toUpperCase() === 'POSTED').length;
    const weekPercentage = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

    const filteredClients = clients.filter(c => 
        c.company_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
            <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
                <div className="logo-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src="/logo.png" alt="TrueUp Media" className="logo-img" style={{ height: '28px', width: 'auto' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>TL</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="sidebar-close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1">
                    <p className="sidebar-label">Navigation</p>
                    <div 
                        onClick={() => setView('dashboard')}
                        className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={18} />
                        <span>Dashboard Overview</span>
                    </div>
                    <div 
                        onClick={() => setView('client')}
                        className={`nav-item ${view === 'client' ? 'active' : ''}`}
                    >
                        <Globe size={18} />
                        <span>Client Calendars</span>
                    </div>
                    <div 
                        onClick={() => setView('master')}
                        className={`nav-item ${view === 'master' ? 'active' : ''}`}
                    >
                        <CalendarIcon size={18} />
                        <span>Master Calendar</span>
                    </div>
                    <div
                        onClick={() => setView('poc')}
                        className={`nav-item ${view === 'poc' ? 'active' : ''}`}
                    >
                        <FileText size={18} />
                        <span>POC Communication</span>
                    </div>

                    {view === 'client' && (
                        <>
                            <p className="sidebar-label">Your Clients</p>
                            <div className="search-input-box" style={{ width: '100%', marginBottom: '12px' }}>
                                <Search size={14} className="search-icon" />
                                <input 
                                    type="text" 
                                    placeholder="Search clients..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ padding: '8px 12px 8px 36px', fontSize: '12px' }}
                                />
                            </div>
                            <div className="client-list-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {loading ? (
                                    <>
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div key={i} className="nav-item" style={{ padding: '8px 12px' }}>
                                                <Skeleton className="h-6 w-6 rounded-md mr-3" />
                                                <Skeleton className="h-4 w-32" />
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        {filteredClients.length === 0 && (
                                            <p style={{ fontSize: 11, color: '#94a3b8', padding: '8px 12px', textAlign: 'center' }}>No clients found</p>
                                        )}
                                        {filteredClients.map(c => (
                                            <div 
                                                key={c.id}
                                                onClick={() => setSelectedClient(c.id)}
                                                className={`nav-item ${selectedClient === c.id ? 'active' : ''}`}
                                                style={{ padding: '8px 12px', fontSize: '13px' }}
                                            >
                                                <div style={{ 
                                                    width: '24px', 
                                                    height: '24px', 
                                                    borderRadius: '6px', 
                                                    background: selectedClient === c.id ? 'var(--accent)' : 'var(--bg-elevated)',
                                                    color: selectedClient === c.id ? 'white' : 'var(--text-secondary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '10px',
                                                    fontWeight: 800
                                                }}>
                                                    {c.company_name?.charAt(0) || '?'}
                                                </div>
                                                <span className="truncate">{c.company_name}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
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
                        <div className="user-avatar">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="user-name">{user?.user_metadata?.name || 'Team Lead'}</p>
                            <p className="user-role">{user?.user_metadata?.role_identifier || 'TL'}</p>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* Mobile Header Top */}
                <div className="mobile-header-top">
                    <div className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={24} />
                    </div>
                    <img src="/logo.png" alt="TrueUp Media" className="logo-img" style={{ height: '24px', width: 'auto' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <NotificationBell />
                    </div>
                </div>

                <header className="page-header page-header-safe">
                    <div>
                        <h1 className="page-title">
                            {view === 'master' ? 'Master Calendar' : view === 'poc' ? 'POC Communication' : 'Client Dashboard'}
                        </h1>
                        <p className="page-subtitle">
                            {view === 'master'
                                ? 'Unified view of all assigned client schedules' 
                                : view === 'poc'
                                ? 'Click any date to add communication notes for GM visibility'
                                : `Managing content for ${clients.find(c => c.id === selectedClient)?.company_name || 'Client'}`
                            }
                        </p>
                    </div>

                    <div className="header-controls">
                        <div className="month-nav">
                            <button onClick={handlePrev} className="month-btn"><ChevronLeft size={18}/></button>
                            <span className="month-label">
                                {format(currentMonth, 'MMMM yyyy')}
                            </span>
                            <button onClick={handleNext} className="month-btn"><ChevronRight size={18}/></button>
                        </div>

                        <ScheduleExport 
                            data={calendarData}
                            clientName={selectedClient ? clients.find(c => c.id === selectedClient)?.company_name || 'Client' : 'TrueUp Media'}
                            month={currentMonth}
                        />
                    </div>
                </header>

                {(view === 'client' || view === 'master') && (
                    <div className="status-summary-row">
                        <div className="status-pill status-pill-content">
                            <span className="status-pill-label">Content</span>
                            <span className="status-pill-count">{monthStatusCounts.content}</span>
                        </div>
                        <div className="status-pill status-pill-design">
                            <span className="status-pill-label">Design</span>
                            <span className="status-pill-count">{monthStatusCounts.design}</span>
                        </div>
                        <div className="status-pill status-pill-posted">
                            <span className="status-pill-label">Posted</span>
                            <span className="status-pill-count">{monthStatusCounts.posted}</span>
                        </div>
                    </div>
                )}

                {view === 'dashboard' && (
                    <div className="dashboard-view">
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)' }}>
                                    <Users size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>Total Clients</h3>
                                    <p className="stat-value">{clients.length}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                                    <CalendarIcon size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>Scheduled</h3>
                                    <p className="stat-value">{monthTotal}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                                    <ShieldAlert size={28} />
                                </div>
                                <div className="stat-info">
                                    <h3>Active Pipelines</h3>
                                    <p className="stat-value">{monthTotal}</p>
                                </div>
                            </div>
                        </div>

                        <div className="daily-stats-banner" style={{ marginTop: '24px' }}>
                            <div className="progress-meter-card">
                                <div className="progress-top-row">
                                    <div className="progress-main-info">
                                        <h3 className="stat-label">Today&apos;s Progress</h3>
                                    </div>
                                    <div className="progress-values">
                                        <span className="current">{todayStats.completed}</span>
                                        <span className="separator">/</span>
                                        <span className="total">{todayStats.total}</span>
                                        <span className="unit">Tasks</span>
                                    </div>
                                </div>
                                <div className="meter-labels">
                                    <span className="percentage">{todayStats.percentage}% Done</span>
                                </div>
                            </div>

                            <div className="progress-meter-card">
                                <div className="progress-top-row">
                                    <div className="progress-main-info">
                                        <h3 className="stat-label">Week&apos;s Progress</h3>
                                    </div>
                                    <div className="progress-values">
                                        <span className="current">{weekCompleted}</span>
                                        <span className="separator">/</span>
                                        <span className="total">{weekTotal}</span>
                                        <span className="unit">Tasks</span>
                                    </div>
                                </div>
                                <div className="meter-labels">
                                    <span className="percentage">{weekPercentage}% Done</span>
                                </div>
                            </div>

                            <div className="progress-meter-card">
                                <div className="progress-top-row">
                                    <div className="progress-main-info">
                                        <h3 className="stat-label">Month&apos;s Progress</h3>
                                    </div>
                                    <div className="progress-values">
                                        <span className="current">{monthCompleted}</span>
                                        <span className="separator">/</span>
                                        <span className="total">{monthTotal}</span>
                                        <span className="unit">Tasks</span>
                                    </div>
                                </div>
                                <div className="meter-labels">
                                    <span className="percentage">{monthPercentage}% Done</span>
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
                        <div className="dashboard-grid" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                            <div className="dashboard-card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Activity</h2>
                                    <span className="card-badge">Live</span>
                                </div>
                                <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {calendarData.slice(0, 5).map(item => (
                                        <div key={item.id} onClick={() => handleItemClick(item)} style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '13px' }}>{item.title}</span>
                                                <span className={`type-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {format(parseISO(item.scheduled_datetime), 'MMM d, HH:mm')} • {item.clients?.company_name}
                                            </div>
                                        </div>
                                    ))}
                                    {calendarData.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>No content scheduled for this month</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Global loading bar removed in favor of inline skeletons */}

                {view !== 'dashboard' && (
                    <div className="calendar-card">
                        <div className="calendar-grid">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="calendar-header-cell">
                                    <span className="desktop-day">{day}</span>
                                    <span className="mobile-day">{day.charAt(0)}</span>
                                </div>
                            ))}

                            {loading ? (
                                <>
                                    {Array.from({ length: 35 }).map((_, idx) => (
                                        <div key={idx} className="calendar-day opacity-50" style={{ minHeight: '110px' }}>
                                            <Skeleton className="h-4 w-4 mb-2" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-6 w-full rounded" />
                                                <Skeleton className="h-6 w-3/4 rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {days.map((day, idx) => {
                                        const isPocView = view === 'poc';
                                        const dayContent = isPocView
                                            ? pocNotes.filter(note => isSameDay(parseISO(`${note.note_date}T00:00:00`), day))
                                            : calendarData.filter(item => {
                                                const itemDate = parseISO(item.scheduled_datetime);
                                                return isSameDay(itemDate, day);
                                            });
                                        return (
                                            <div 
                                                key={idx} 
                                                onClick={() => {
                                                    if (isPocView) {
                                                        handlePocDayClick(day);
                                                    }
                                                }}
                                                className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                            >
                                                <span className="day-number">{format(day, 'd')}</span>
                                                <div className="day-items desktop-only">
                                                    {dayContent.map((item: any) => (
                                                        <div 
                                                            key={item.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isPocView) {
                                                                    handlePocNoteClick(item as PocNote);
                                                                } else {
                                                                    handleItemClick(item);
                                                                }
                                                            }}
                                                            className={isPocView ? 'content-item post' : `content-item ${(item as ContentItem).content_type.toLowerCase()} ${(item as ContentItem).is_emergency ? 'emergency' : ''}`}
                                                            title={isPocView ? (item as PocNote).note_text : (item as ContentItem).content_type}
                                                        >
                                                            {isPocView ? <FileText size={10}/> : (item as ContentItem).content_type === 'Post' ? <FileText size={10}/> : <Video size={10}/>}
                                                            <span className="truncate" style={{ fontSize: '9px' }}>
                                                                {isPocView
                                                                    ? (item as PocNote).note_text
                                                                    : `${view === 'master' ? `[${(item as ContentItem).clients?.company_name?.substring(0,3)}] ` : ''}${(item as ContentItem).content_type}`}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mobile-day-indicators">
                                                    {dayContent.map(item => (
                                                        <div
                                                            key={item.id}
                                                            className={`mobile-dot ${isPocView ? 'post' : ((item as ContentItem).content_type || '').toLowerCase()} ${!isPocView && (item as ContentItem).is_emergency ? 'emergency' : ''}`}
                                                        ></div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
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
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span className={`type-badge ${activeItem.item.content_type.toLowerCase()}`}>
                                        {activeItem.item.content_type}
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</span>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{activeItem.item.clients?.company_name}</span>
                                </div>
                                <h3 className="modal-title">{activeItem.item.content_type}</h3>
                            </div>
                            <button onClick={() => setIsDetailsOpen(false)} className="btn-icon"><X size={20}/></button>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-info">

                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <div>
                                        <label className="detail-label">Scheduled Date</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                            <CalendarIcon size={14} color="var(--text-muted)"/>
                                            {format(parseISO(activeItem.item.scheduled_datetime), 'MMM d, yyyy')}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="detail-label">Time</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                            <Clock size={14} color="var(--text-muted)"/>
                                            {format(parseISO(activeItem.item.scheduled_datetime), 'hh:mm a')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="detail-workflow" style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <label className="detail-label">Workflow Progress</label>
                                <div style={{ marginTop: '16px' }}>
                                    {(() => {
                                        const flows: any = {
                                            'Reel': [
                                                'CONTENT READY',
                                                'SHOOT DONE',
                                                'EDITING IN PROGRESS',
                                                'EDITED',
                                                'WAITING FOR APPROVAL',
                                                'APPROVED',
                                                'WAITING FOR POSTING',
                                                'POSTED'
                                            ],
                                            'Post': [
                                                'CONTENT APPROVED',
                                                'DESIGNING IN PROGRESS',
                                                'DESIGNING COMPLETED',
                                                'WAITING FOR APPROVAL',
                                                'APPROVED',
                                                'WAITING FOR POSTING',
                                                'POSTED'
                                            ]
                                        };
                                        const flow = flows[activeItem.item.content_type];
                                        const currentIdx = flow.indexOf(activeItem.item.status);
                                        const nextStatus = flow[currentIdx + 1];

                                        return (
                                            <>
                                                <div style={{ marginBottom: '20px' }}>
                                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Status</p>
                                                    <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent)' }}>{activeItem.item.status}</p>
                                                </div>
                                                {nextStatus && activeItem.item.status !== 'WAITING FOR POSTING' && (
                                                    <div style={{ marginBottom: '16px' }}>
                                                        <label className="detail-label" style={{ marginBottom: '8px', display: 'block' }}>Add a Note (Optional)</label>
                                                        <textarea 
                                                            value={statusNote}
                                                            onChange={(e) => setStatusNote(e.target.value)}
                                                            placeholder="e.g., Finished the first draft..."
                                                            style={{ 
                                                                width: '100%', 
                                                                padding: '12px', 
                                                                borderRadius: '10px', 
                                                                border: '1px solid #e2e8f0',
                                                                fontSize: '13px',
                                                                resize: 'none',
                                                                height: '80px',
                                                                background: 'var(--bg-surface)'
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {nextStatus ? (
                                                    activeItem.item.status === 'WAITING FOR POSTING' ? (
                                                        <div className="workflow-waiting-posting" style={{ 
                                                            marginTop: '16px', 
                                                            padding: '16px', 
                                                            background: 'rgba(59, 130, 246, 0.05)', 
                                                            border: '1px solid rgba(59, 130, 246, 0.2)',
                                                            color: '#3b82f6', 
                                                            borderRadius: '12px', 
                                                            fontSize: '13px', 
                                                            display: 'flex', 
                                                            flexDirection: 'column',
                                                            alignItems: 'center', 
                                                            textAlign: 'center',
                                                            gap: '8px' 
                                                        }}>
                                                            <Clock size={20} />
                                                            <div style={{ fontWeight: 700 }}>Waiting for Posting Team</div>
                                                            <div style={{ opacity: 0.8, fontSize: '12px' }}>This item has been sent to the posting team queue. They will mark it as posted once published.</div>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleStatusUpdate(nextStatus)}
                                                            className="btn-add"
                                                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                                                        >
                                                            <span>Advance to {nextStatus}</span>
                                                            <ArrowRight size={18}/>
                                                        </button>
                                                    )
                                                ) : (
                                                    <div style={{ 
                                                        background: '#ecfdf5', 
                                                        color: '#059669', 
                                                        padding: '12px', 
                                                        borderRadius: '10px', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        gap: '8px',
                                                        fontWeight: 700,
                                                        fontSize: '14px'
                                                    }}>
                                                        <CheckCircle2 size={18}/>
                                                        Workflow Completed
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '32px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                            <label className="detail-label">Activity Log</label>
                            <div style={{ marginTop: '24px', position: 'relative', paddingLeft: '12px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ 
                                    position: 'absolute', left: '23px', top: '12px', bottom: '12px', 
                                    width: '2px', background: 'linear-gradient(to bottom, #10b981 0%, #e2e8f0 100%)', opacity: 0.3, zIndex: 1 
                                }}></div>
                                {(() => {
                                    const flows: any = {
                                        'Reel': [
                                            'CONTENT READY', 'SHOOT DONE', 'EDITING IN PROGRESS', 'EDITED',
                                            'WAITING FOR APPROVAL', 'APPROVED', 'WAITING FOR POSTING', 'POSTED'
                                        ],
                                        'Post': [
                                            'CONTENT APPROVED', 'DESIGNING IN PROGRESS', 'DESIGNING COMPLETED',
                                            'WAITING FOR APPROVAL', 'APPROVED', 'WAITING FOR POSTING', 'POSTED'
                                        ]
                                    };
                                    const flow = flows[activeItem.item.content_type] || [];
                                    const currentStatus = activeItem.item.status;
                                    const currentIdx = flow.indexOf(currentStatus);

                                    return flow.map((status: string, idx: number) => {
                                        const isCompleted = idx < currentIdx || currentStatus === 'POSTED';
                                        const isCurrent = idx === currentIdx && currentStatus !== 'POSTED';
                                        const historyEntry = activeItem.history.find((h: StatusHistoryItem) => h.new_status === status);

                                        return (
                                            <div key={status} style={{ 
                                                display: 'flex', alignItems: 'flex-start', gap: '20px', 
                                                paddingBottom: idx === flow.length - 1 ? 0 : '32px', 
                                                position: 'relative', zIndex: 2 
                                            }}>
                                                <div style={{ 
                                                    width: '24px', height: '24px', borderRadius: '50%', 
                                                    background: isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--bg-surface)',
                                                    border: `2px solid ${isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--danger)'}`,
                                                    flexShrink: 0, marginTop: '2px', display: 'flex', 
                                                    alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: isCompleted ? '0 0 15px rgba(16, 185, 129, 0.4)' : isCurrent ? '0 0 20px rgba(99, 102, 241, 0.5)' : 'none',
                                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                                }}>
                                                    {isCompleted ? (
                                                        <Check size={14} color="white" strokeWidth={3} />
                                                    ) : isCurrent ? (
                                                        <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></div>
                                                    ) : (
                                                        <div style={{ width: '6px', height: '6px', background: 'var(--danger)', borderRadius: '50%' }}></div>
                                                    )}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ 
                                                        fontSize: isCurrent ? '15px' : '14px', fontWeight: 800, 
                                                        color: isCompleted ? 'var(--success)' : isCurrent ? 'var(--text-primary)' : 'var(--danger)',
                                                        letterSpacing: '0.02em', transition: 'all 0.3s'
                                                    }}>{status}</span>
                                                    {historyEntry && (
                                                        <div style={{ 
                                                            display: 'flex', flexDirection: 'column', marginTop: '6px',
                                                            padding: '10px 14px', background: 'rgba(79, 70, 229, 0.03)',
                                                            borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.05)'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    {historyEntry.users?.role_identifier || historyEntry.users?.name || 'Updated'}
                                                                </span>
                                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                    {format(parseISO(historyEntry.changed_at), 'MMM d, HH:mm')}
                                                                </span>
                                                            </div>
                                                            {historyEntry.note && (
                                                                <div style={{ 
                                                                    marginTop: '8px', padding: '8px 12px', 
                                                                    background: 'var(--bg-elevated)', borderRadius: '8px', 
                                                                    fontSize: '12px', color: 'var(--text-secondary)', 
                                                                    fontStyle: 'italic', borderLeft: '3px solid var(--accent)'
                                                                }}>
                                                                    "{historyEntry.note}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPocModalOpen && selectedPocDate && (
                <div className="modal-overlay" onClick={() => setIsPocModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add POC Note</h3>
                            <button onClick={() => setIsPocModalOpen(false)} className="modal-close"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSavePocNote} className="modal-form">
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={format(selectedPocDate, 'yyyy-MM-dd')}
                                    readOnly
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Client</label>
                                <select
                                    className="form-input"
                                    value={selectedPocClient}
                                    onChange={(e) => setSelectedPocClient(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Select assigned client</option>
                                    {clients.map((client) => (
                                        <option key={client.id} value={client.id}>{client.company_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Note</label>
                                <textarea
                                    className="form-input"
                                    value={pocNoteText}
                                    onChange={(e) => setPocNoteText(e.target.value)}
                                    placeholder="Write communication note for GM..."
                                    rows={4}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn-primary">
                                <Plus size={16} />
                                Save Note
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isPocDetailsOpen && selectedPocNote && (
                <div className="modal-overlay" onClick={() => setIsPocDetailsOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">POC Note Details</h3>
                            <button onClick={() => setIsPocDetailsOpen(false)} className="modal-close"><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={format(parseISO(`${selectedPocNote.note_date}T00:00:00`), 'PPP')}
                                    readOnly
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Added By</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={selectedPocNote.users?.role_identifier || selectedPocNote.users?.name || 'Team Lead'}
                                    readOnly
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Client</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={selectedPocNote.clients?.company_name || 'Client not selected'}
                                    readOnly
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Note</label>
                                <textarea
                                    className="form-input"
                                    value={selectedPocNote.note_text}
                                    rows={5}
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

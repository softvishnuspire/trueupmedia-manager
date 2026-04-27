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
    parseISO,
    isPast,
    isBefore,
    startOfDay
} from 'date-fns';
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Plus,
    LayoutDashboard,
    Globe,
    Users,
    UserCircle,
    Clock,
    FileText,
    Video,
    CheckCircle2,
    Calendar as CalendarIcon,
    X,
    ArrowRight,
    LogOut,
    Filter,
    Menu,
    Edit,
    Trash2,
    Check,
    CalendarClock,
    Undo2,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';
import { gmApi, emergencyApi } from '@/lib/api';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import SkeletonCard from '@/components/SkeletonCard';
import NotificationBell from '@/components/NotificationBell';
import './gm.css';

// Matches actual DB: content_items has id, client_id, title, scheduled_datetime, status, content_type, description
interface ContentItem {
    id: string;
    title: string;
    description: string;
    content_type: 'Post' | 'Reel';
    scheduled_datetime: string;
    status: string;
    client_id: string;
    is_rescheduled?: boolean;
    is_emergency?: boolean;
    clients?: { company_name: string };
}

export default function GMDashboard() {
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'dashboard' | 'client' | 'master' | 'teams'>('dashboard');
    const [dailyAgenda, setDailyAgenda] = useState<{ date: Date, items: ContentItem[] } | null>(null);
    const [emergencyTasks, setEmergencyTasks] = useState<ContentItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    // Team leads state
    const [teamLeads, setTeamLeads] = useState<any[]>([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState<any>(null); // { client, teamLead }

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
    const [activeItem, setActiveItem] = useState<any>(null);
    const [statusNote, setStatusNote] = useState('');
    const [user, setUser] = useState<any>(null);
    const [isRescheduling, setIsRescheduling] = useState(false);

    const isMasterMode = view === 'master';

    const [formData, setFormData] = useState({
        content_type: 'Post' as 'Post' | 'Reel',
        time: '10:00',
        title: '',
        description: ''
    });

    useEffect(() => {
        fetchClients();
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUser(user);
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (view === 'master') {
            fetchMasterCalendar();
        } else if (view === 'client' && selectedClient && selectedClient !== 'all') {
            fetchClientCalendar();
        } else if (view === 'teams') {
            fetchTeamLeads();
        } else if (view === 'dashboard') {
            fetchDashboardStats();
        }
    }, [selectedClient, selectedType, currentMonth, view, clients.length, teamLeads.length]);

    const fetchTeamLeads = async () => {
        setLoading(true);
        try {
            const res = await gmApi.getTeamLeads();
            // For each team lead, fetch their assigned clients
            const leadsWithClients = await Promise.all(res.data.map(async (lead: any) => {
                const clientsRes = await gmApi.getTeamLeadClients(lead.user_id);
                return { ...lead, clients: clientsRes.data };
            }));
            setTeamLeads(leadsWithClients);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchClients = async () => {
        try {
            const res = await gmApi.getClients();
            console.log('Clients loaded:', res.data);
            setClients(res.data);
            // clients table PK is "id"
            if (res.data.length > 0 && !selectedClient) {
                setSelectedClient(res.data[0].id);
            }
        } catch (err) { console.error('Error fetching clients:', err); }
    };

    const fetchClientCalendar = async () => {
        setLoading(true);
        try {
            const res = await gmApi.getCalendar(selectedClient, format(currentMonth, 'yyyy-MM'));
            setCalendarData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchMasterCalendar = async () => {
        setLoading(true);
        try {
            const res = await gmApi.getMasterCalendar(
                format(currentMonth, 'yyyy-MM'),
                selectedClient === 'all' ? undefined : selectedClient,
                selectedType === 'all' ? undefined : selectedType
            );
            setCalendarData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const [stats, setStats] = useState({
        totalClients: 0,
        totalTeams: 0,
        monthlyContent: 0,
        statusBreakdown: {} as any
    });

    const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, percentage: 0, remaining: 0 });

    const fetchDashboardStats = async () => {
        setLoading(true);
        try {
            // Fetch master calendar for the current month to get throughput and status breakdown
            const res = await gmApi.getMasterCalendar(format(new Date(), 'yyyy-MM'));
            const data = res.data as ContentItem[];

            const breakdown = data.reduce((acc: any, item) => {
                acc[item.status] = (acc[item.status] || 0) + 1;
                return acc;
            }, {});

            // Calculate today's stats
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

            setStats({
                totalClients: clients.length,
                totalTeams: teamLeads.length,
                monthlyContent: data.length,
                statusBreakdown: breakdown
            });

            // Fetch all emergency tasks
            const emergencyRes = await emergencyApi.getAll();
            setEmergencyTasks(emergencyRes.data);

        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const days = viewMode === 'month'
        ? eachDayOfInterval({
            start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
            end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
        })
        : eachDayOfInterval({
            start: startOfWeek(currentMonth, { weekStartsOn: 1 }),
            end: endOfWeek(currentMonth, { weekStartsOn: 1 })
        });

    const handlePrev = () => {
        if (viewMode === 'month') setCurrentMonth(subMonths(currentMonth, 1));
        else setCurrentMonth(prev => new Date(prev.setDate(prev.getDate() - 7)));
    };

    const handleNext = () => {
        if (viewMode === 'month') setCurrentMonth(addMonths(currentMonth, 1));
        else setCurrentMonth(prev => new Date(prev.setDate(prev.getDate() + 7)));
    };

    const handleAddClick = (date: Date) => {
        if (isMasterMode) return;
        setSelectedDate(date);
        setEditingItem(null);
        setIsRescheduling(false);
        setFormData({ content_type: 'Post', time: '10:00', title: '', description: '' });
        setIsModalOpen(true);
    };

    const handleItemClick = async (item: ContentItem) => {
        try {
            const res = await gmApi.getContentDetails(item.id);
            setActiveItem(res.data);
            setIsDetailsOpen(true);
        } catch (err) { console.error(err); }
    };

    const handleEditClick = (item: ContentItem) => {
        setIsRescheduling(false);
        setEditingItem(item);
        const dt = parseISO(item.scheduled_datetime);
        setSelectedDate(dt);
        setFormData({
            content_type: item.content_type,
            time: format(dt, 'HH:mm'),
            title: item.title || '',
            description: item.description || ''
        });
        setIsDetailsOpen(false);
        setIsModalOpen(true);
    };

    const handleRescheduleClick = (item: ContentItem) => {
        setIsRescheduling(true);
        setEditingItem(item);
        const dt = parseISO(item.scheduled_datetime);
        setSelectedDate(dt);
        setFormData({
            content_type: item.content_type,
            time: format(dt, 'HH:mm'),
            title: item.title || '',
            description: item.description || ''
        });
        setIsDetailsOpen(false);
        setIsModalOpen(true);
    };

    const handleDeleteContent = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this content item?')) return;
        try {
            await gmApi.deleteContent(id);
            setIsDetailsOpen(false);
            if (view === 'master') fetchMasterCalendar(); else fetchClientCalendar();
        } catch (err) { console.error(err); alert('Failed to delete content'); }
    };

    const handleStatusUpdate = async (newStatus: string) => {
        if (!activeItem) return;
        try {
            // Get the current authenticated user ID directly to ensure it's not null
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const actorId = authUser?.id || user?.user_id;

            console.log('Updating status (GM):', { newStatus, note: statusNote, actorId });

            // Pass the note - ensure it's trimmed and not just empty
            await gmApi.updateStatus(activeItem.item.id, newStatus, statusNote.trim() || undefined, actorId);

            const res = await gmApi.getContentDetails(activeItem.item.id);
            setActiveItem(res.data);
            setStatusNote(''); // Clear note after update
            if (isMasterMode) fetchMasterCalendar(); else fetchClientCalendar();
        } catch (err: any) {
            console.error('Status update error (GM):', err);
            alert(err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleUndoStatus = async () => {
        if (!activeItem) return;
        if (!window.confirm('Are you sure you want to undo the last status change?')) return;
        try {
            await gmApi.undoStatus(activeItem.item.id);
            const res = await gmApi.getContentDetails(activeItem.item.id);
            setActiveItem(res.data);
            if (isMasterMode) fetchMasterCalendar(); else fetchClientCalendar();
        } catch (err) { 
            console.error(err); 
            alert('Failed to undo status change. It might be because there is no more history to undo.'); 
        }
    };

    const handleToggleEmergency = async () => {
        if (!activeItem) return;
        try {
            const res: any = await emergencyApi.toggle(activeItem.item.id);
            if (res.data.success) {
                const detailsRes = await gmApi.getContentDetails(activeItem.item.id);
                setActiveItem(detailsRes.data);
                
                // Refresh calendars
                if (view === 'master') fetchMasterCalendar(); 
                else if (view === 'client') fetchClientCalendar();
                
                // Always refresh dashboard stats to update emergency list
                fetchDashboardStats();
            }
        } catch (err: any) {
            console.error('Emergency toggle error:', err);
            alert(err.response?.data?.error || 'Failed to toggle emergency status');
        }
    };

    const handleAssignClient = async (clientId: string, teamLeadId: string) => {
        try {
            await gmApi.assignClient(clientId, teamLeadId);
            fetchTeamLeads();
            fetchClients();
            setIsAssignModalOpen(false);
        } catch (err) { alert('Error assigning client'); }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const scheduled_datetime = format(selectedDate!, 'yyyy-MM-dd') + 'T' + formData.time + ':00';
        try {
            if (editingItem) {
                await gmApi.updateContent(editingItem.id, { 
                    title: formData.title, 
                    description: formData.description, 
                    scheduled_datetime,
                    is_rescheduled: isRescheduling ? true : editingItem.is_rescheduled
                });
            } else {
                await gmApi.addContent({ 
                    client_id: selectedClient, 
                    title: formData.title, 
                    description: formData.description, 
                    content_type: formData.content_type, 
                    scheduled_datetime 
                });
            }
            setIsModalOpen(false);
            setIsRescheduling(false);
            if (view === 'master') fetchMasterCalendar(); else fetchClientCalendar();
        } catch (err) { alert('Error saving item'); }
    };

    const getClientName = () => {
        const c = clients.find(c => c.id === selectedClient);
        return c?.company_name || 'Client';
    };

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
                        <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>GM</span>
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
                        <span>Dashboard Overview</span>
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
                    <div
                        onClick={() => setView('teams')}
                        className={`nav-item ${view === 'teams' ? 'active' : ''}`}
                    >
                        <Users size={20} />
                        <span>Teams</span>
                    </div>

                    {view === 'client' && (
                        <>
                            <p className="sidebar-label">Clients</p>
                            <div className="client-list">
                                {clients.length === 0 ? (
                                    <>
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div key={i} className="client-item" style={{ opacity: 0.6 }}>
                                                <Skeleton className="h-8 w-8 rounded-lg" />
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <>
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
                        <div className="user-avatar" style={{ background: 'var(--accent)', color: 'white' }}>GM</div>
                        <div>
                            <p className="user-name">General Manager</p>
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
                {/* Mobile Header Top */}
                <div className="mobile-header-top">
                    <div className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={24} />
                    </div>
                    <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 800 }}>TrueUp</span>
                    <div style={{ width: '40px' }}></div> {/* Spacer */}
                </div>

                <header className="page-header">
                    <div className="header-content">
                        <div className="header-info">
                            <h1 className="page-title">
                                {view === 'dashboard' && 'Dashboard Overview'}
                                {view === 'client' && 'Client Calendar'}
                                {view === 'master' && 'Master Calendar'}
                                {view === 'teams' && 'Team Management'}
                            </h1>
                            <p className="page-subtitle">
                                {view === 'dashboard' && 'Monitor operational health and pipeline metrics'}
                                {view === 'client' && 'Detailed content planning for individual clients'}
                                {view === 'master' && 'Review and manage content production flow'}
                                {view === 'teams' && 'Assign clients and manage team lead performance'}
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
                                    <div className="filter-divider"></div>
                                    <div className="client-dropdown-wrapper">
                                        <select
                                            className="client-dropdown"
                                            value={selectedType}
                                            onChange={(e) => setSelectedType(e.target.value)}
                                        >
                                            <option value="all">All Types</option>
                                            <option value="Post">Posts</option>
                                            <option value="Reel">Reels</option>
                                        </select>
                                        <ChevronDown size={14} className="dropdown-chevron" />
                                    </div>
                                </div>
                            )}

                            {view !== 'teams' && view !== 'dashboard' && (
                                <>
                                    <div className="view-mode-toggle">
                                        <button
                                            onClick={() => setViewMode('month')}
                                            className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
                                        >Month</button>
                                        <button
                                            onClick={() => setViewMode('week')}
                                            className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
                                        >Week</button>
                                    </div>

                                    <div className="month-nav">
                                        <button onClick={handlePrev} className="month-btn"><ChevronLeft size={20} /></button>
                                        <span className="month-label">
                                            {viewMode === 'month'
                                                ? format(currentMonth, 'MMMM yyyy')
                                                : `Week of ${format(startOfWeek(currentMonth, { weekStartsOn: 1 }), 'MMM d')}`
                                            }
                                        </span>
                                        <button onClick={handleNext} className="month-btn"><ChevronRight size={20} /></button>
                                    </div>
                                </>
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

                {/* Removed global loading bar in favor of inline skeletons */}

                {view === 'dashboard' && (
                    <div className="dashboard-view">
                        <div className="stats-grid">
                            {loading ? (
                                <>
                                    <div className="stat-card">
                                        <Skeleton className="h-12 w-12 rounded-xl" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-8 w-12" />
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <Skeleton className="h-12 w-12 rounded-xl" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-8 w-12" />
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <Skeleton className="h-12 w-12 rounded-xl" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-8 w-12" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="stat-card">
                                        <div className="stat-icon-box" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)' }}>
                                            <Users size={24} />
                                        </div>
                                        <div className="stat-info">
                                            <h3>Total Clients</h3>
                                            <p className="stat-value">{stats.totalClients}</p>
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                                            <UserCircle size={24} />
                                        </div>
                                        <div className="stat-info">
                                            <h3>Active Teams</h3>
                                            <p className="stat-value">{stats.totalTeams}</p>
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                                            <FileText size={24} />
                                        </div>
                                        <div className="stat-info">
                                            <h3>This Month's Content</h3>
                                            <p className="stat-value">{stats.monthlyContent}</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginTop: '24px' }} className="responsive-dashboard-grid">
                            <div className="dashboard-card">
                                <div className="card-header">
                                    <h3 className="card-title">Production Pipeline</h3>
                                    <span className="card-badge">Live Status</span>
                                </div>
                                <div className="status-pipeline">
                                    {Object.entries(stats.statusBreakdown).map(([status, count]: any) => (
                                        <div key={status} className="pipeline-item">
                                            <div className="pipeline-info">
                                                <span className="pipeline-label">{status}</span>
                                                <span className="pipeline-count" style={{ fontWeight: 800, color: 'var(--text-primary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '6px' }}>
                                                    {count} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {stats.monthlyContent}</span>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(stats.statusBreakdown).length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                            No content data available for this month.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="dashboard-card">
                                <div className="card-header">
                                    <h3 className="card-title">Quick Actions</h3>
                                </div>
                                <div className="quick-actions-list">
                                    <button onClick={() => setView('teams')} className="action-item">
                                        <div className="action-icon" style={{ background: 'var(--bg-elevated)' }}><Users size={18} /></div>
                                        <div className="action-text">
                                            <p className="action-title">Manage Teams</p>
                                            <p className="action-desc">Assign clients to team leads</p>
                                        </div>
                                        <ChevronRight size={16} />
                                    </button>
                                    <button onClick={() => setView('master')} className="action-item">
                                        <div className="action-icon" style={{ background: 'var(--bg-elevated)' }}><Globe size={18} /></div>
                                        <div className="action-text">
                                            <p className="action-title">Master Calendar</p>
                                            <p className="action-desc">View company-wide schedule</p>
                                        </div>
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'teams' ? (
                    <div className="teams-container">
                        <div className="teams-grid">
                            {loading ? (
                                <>
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="team-card">
                                            <div className="team-card-header">
                                                <div className="lead-info">
                                                    <Skeleton className="h-10 w-10 rounded-full" />
                                                    <div className="space-y-2">
                                                        <Skeleton className="h-4 w-24" />
                                                        <Skeleton className="h-3 w-16" />
                                                    </div>
                                                </div>
                                                <Skeleton className="h-8 w-24 rounded-lg" />
                                            </div>
                                            <div className="assigned-clients space-y-3" style={{ marginTop: '16px' }}>
                                                <Skeleton className="h-3 w-32" />
                                                <div className="flex gap-2">
                                                    <Skeleton className="h-6 w-20 rounded-full" />
                                                    <Skeleton className="h-6 w-24 rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : teamLeads.length > 0 ? (
                                teamLeads.map(lead => (
                                    <div key={lead.user_id} className="team-card">
                                        <div className="team-card-header">
                                            <div className="lead-info">
                                                <div className="lead-avatar">
                                                    {lead.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="lead-name">
                                                        {lead.name}
                                                        {lead.role_identifier && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>({lead.role_identifier})</span>}
                                                    </h3>
                                                    <p className="lead-role">TEAM LEAD</p>
                                                </div>
                                            </div>
                                            <button
                                                className="btn-assign-small"
                                                onClick={() => {
                                                    setAssignTarget({ teamLead: lead });
                                                    setIsAssignModalOpen(true);
                                                }}
                                            >
                                                <Plus size={14} />
                                                Assign Client
                                            </button>
                                        </div>

                                        <div className="assigned-clients">
                                            <p className="assigned-label">Assigned Clients ({lead.clients?.length || 0})</p>
                                            <div className="assigned-list">
                                                {lead.clients?.length === 0 && (
                                                    <p className="empty-assigned">No clients assigned</p>
                                                )}
                                                {lead.clients?.map((c: any) => (
                                                    <div key={c.id} className="assigned-item">
                                                        <span>{c.company_name}</span>
                                                        <button
                                                            className="btn-unassign"
                                                            onClick={() => handleAssignClient(c.id, '')}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="teams-empty-state">
                                    <Users size={48} strokeWidth={1.5} />
                                    <p>No team leads found in the system.</p>
                                </div>
                            )}
                        </div>

                        {/* Assign Modal */}
                        {isAssignModalOpen && assignTarget && (
                            <div className="modal-overlay">
                                <div className="modal-content">
                                    <div className="modal-header">
                                        <h3 className="modal-title">Assign Client to {assignTarget.teamLead.name}</h3>
                                        <button onClick={() => setIsAssignModalOpen(false)} className="modal-close"><X size={20} /></button>
                                    </div>
                                    <div className="modal-form">
                                        <div className="form-group">
                                            <label className="form-label">Select Client</label>
                                            <select
                                                className="form-input"
                                                onChange={(e) => handleAssignClient(e.target.value, assignTarget.teamLead.user_id)}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Choose a client...</option>
                                                {clients.filter(c => !teamLeads.some(l => l.clients?.some((lc: any) => lc.id === c.id))).map(c => (
                                                    <option key={c.id} value={c.id}>{c.company_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            Only showing clients not currently assigned to any team lead.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : view !== 'dashboard' && (
                    <div className="calendar-card">
                        <div className="calendar-grid" style={{ gridTemplateRows: viewMode === 'week' ? 'auto 1fr' : 'auto' }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="calendar-header-cell">
                                    <span className="desktop-day">{day}</span>
                                    <span className="mobile-day">{day.charAt(0)}</span>
                                </div>
                            ))}

                            {loading ? (
                                <>
                                    {Array.from({ length: 35 }).map((_, idx) => (
                                        <div key={idx} className="calendar-day opacity-50" style={{ minHeight: viewMode === 'week' ? '300px' : '110px' }}>
                                            <Skeleton className="h-4 w-4 mb-2" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-4 w-full rounded" />
                                                <Skeleton className="h-4 w-3/4 rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {days.map((day, idx) => {
                                        const dayContent = calendarData.filter(item => {
                                            const itemDate = parseISO(item.scheduled_datetime);
                                            return isSameDay(itemDate, day);
                                        });
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    if (dayContent.length > 0) {
                                                        if (window.innerWidth <= 768) {
                                                            setDailyAgenda({ date: day, items: dayContent });
                                                        } else {
                                                            handleItemClick(dayContent[0]);
                                                        }
                                                    } else if (view === 'client') {
                                                        handleAddClick(day);
                                                    }
                                                }}
                                                className={`calendar-day ${viewMode === 'week' ? 'weekly-cell' : ''} ${!isSameMonth(day, currentMonth) && viewMode === 'month' ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                                style={{ minHeight: viewMode === 'week' ? '300px' : '110px', cursor: (dayContent.length > 0 || view === 'client') ? 'pointer' : 'default' }}
                                            >
                                                <span className="day-number">{format(day, 'd')}</span>
                                                <div className="day-items desktop-only">
                                                    {dayContent.map(item => (
                                                        <div
                                                            key={item.id}
                                                            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                                            className={`content-item ${item.is_rescheduled ? 'rescheduled' : item.content_type.toLowerCase()} ${item.is_emergency ? 'emergency' : ''}`}
                                                        >
                                                            {item.content_type === 'Post' ? <FileText size={10} /> : <Video size={10} />}
                                                            <span className="truncate">
                                                                {item.is_rescheduled ? '[R] ' : ''}
                                                                {view === 'master' ? `[${item.clients?.company_name?.substring(0, 3)}] ` : ''}
                                                                {item.content_type}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mobile-day-indicators">
                                                    {dayContent.map(item => (
                                                        <div 
                                                            key={item.id}
                                                            className={`mobile-dot ${item.is_rescheduled ? 'rescheduled' : item.content_type.toLowerCase()} ${item.is_emergency ? 'emergency' : ''}`}
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

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 className="modal-title">{editingItem ? 'Edit Content' : 'Schedule New Content'}</h3>
                            <button onClick={() => { setIsModalOpen(false); setEditingItem(null); setIsRescheduling(false); }} className="modal-close"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">

                            <div className="form-group">
                                <label className="form-label">Content Type</label>
                                <select 
                                    className="form-input" 
                                    value={formData.content_type} 
                                    onChange={e => setFormData({ ...formData, content_type: e.target.value as any })}
                                    disabled={!!editingItem}
                                >
                                    <option value="Post">Post</option>
                                    <option value="Reel">Reel</option>
                                </select>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Date</label>
                                    <input 
                                        type="date" 
                                        className="form-input" 
                                        value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''} 
                                        onChange={e => setSelectedDate(parseISO(e.target.value))} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Time</label>
                                    <input type="time" className="form-input" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary" style={{ background: isRescheduling ? '#ef4444' : '' }}>
                                {isRescheduling ? <CalendarClock size={18} /> : editingItem ? <Edit size={18} /> : <Plus size={18} />}
                                {isRescheduling ? 'Confirm Reschedule' : editingItem ? 'Update Content' : 'Create Content Schedule'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {dailyAgenda && (
                <div className="modal-overlay" onClick={() => setDailyAgenda(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{format(dailyAgenda.date, 'MMMM d, yyyy')}</h3>
                            <button onClick={() => setDailyAgenda(null)} className="modal-close"><X size={20} /></button>
                        </div>
                        <div className="agenda-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {dailyAgenda.items.map(item => (
                                <div
                                    key={item.id}
                                    className={`agenda-item ${item.content_type.toLowerCase()}`}
                                    onClick={() => {
                                        setDailyAgenda(null);
                                        handleItemClick(item);
                                    }}
                                    style={{
                                        padding: '12px', borderRadius: '10px',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                        display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'
                                    }}
                                >
                                    <div style={{
                                        width: '4px', height: '24px', borderRadius: '2px',
                                        background: item.content_type === 'Post' ? '#10b981' : '#6366f1'
                                    }}></div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            {item.clients?.company_name}
                                        </p>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.content_type}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {isDetailsOpen && activeItem && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg">
                        <div className="modal-header">
                            <div>
                                <div className="detail-meta">
                                    <span className={`type-badge ${activeItem.item.content_type.toLowerCase()}`}>
                                        {activeItem.item.content_type}
                                    </span>
                                    <span className="meta-dot">•</span>
                                    <span className="meta-client">{activeItem.item.clients?.company_name}</span>
                                </div>
                                <h3 className="modal-title" style={{ marginTop: '8px' }}>{activeItem.item.content_type}</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                    onClick={() => handleEditClick(activeItem.item)} 
                                    className="btn-icon" 
                                    title="Edit Content"
                                    style={{ color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteContent(activeItem.item.id)} 
                                    className="btn-icon" 
                                    title="Delete Content"
                                    style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button onClick={() => setIsDetailsOpen(false)} className="modal-close"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-main">


                                <div className="detail-section" style={{ marginTop: '24px' }}>
                                    <label className="detail-label">Schedule Info</label>
                                    <div className="detail-dates">
                                        <div className="date-item">
                                            <CalendarIcon size={16} />
                                            <span className="date-display">{format(parseISO(activeItem.item.scheduled_datetime), 'PPP')}</span>
                                        </div>
                                        <div className="date-item">
                                            <Clock size={16} />
                                            <span className="date-display">{format(parseISO(activeItem.item.scheduled_datetime), 'p')}</span>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '16px' }}>
                                        <button
                                            onClick={handleToggleEmergency}
                                            className={`btn-emergency-toggle ${activeItem.item.is_emergency ? 'active' : 'inactive'}`}
                                        >
                                            <AlertTriangle size={16} />
                                            {activeItem.item.is_emergency ? 'Emergency Active' : 'Mark as Emergency'}
                                        </button>
                                    </div>
                                    {(() => {
                                        const isOverdue = isBefore(parseISO(activeItem.item.scheduled_datetime), new Date()) && activeItem.item.status !== 'POSTED';
                                        if (isOverdue) {
                                            return (
                                                <button 
                                                    onClick={() => handleRescheduleClick(activeItem.item)}
                                                    className="btn-reschedule"
                                                    style={{
                                                        marginTop: '16px',
                                                        width: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        padding: '12px',
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        borderRadius: '10px',
                                                        fontWeight: 700,
                                                        fontSize: '13px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <CalendarClock size={18} />
                                                    Reschedule Task
                                                </button>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                            <div className="detail-workflow">
                                <label className="detail-label">Workflow Status</label>
                                <div className="workflow-content">
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
                                                <div className="status-current">
                                                    <p className="status-label">Current</p>
                                                    <p className="status-value">{activeItem.item.status}</p>
                                                </div>
                                                {nextStatus && activeItem.item.status !== 'WAITING FOR POSTING' && (
                                                    <div className="advance-section">
                                                        <div className="note-input-container">
                                                            <label className="detail-label">Add a note (optional)</label>
                                                            <textarea
                                                                className="status-note-textarea"
                                                                placeholder="Explain what was done in this stage..."
                                                                value={statusNote}
                                                                onChange={(e) => setStatusNote(e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => handleStatusUpdate(nextStatus)}
                                                            className="btn-advance"
                                                        >
                                                            <span>Advance to {nextStatus}</span>
                                                            <ArrowRight size={18} className="advance-arrow" />
                                                        </button>
                                                    </div>
                                                )}
                                                {nextStatus && activeItem.item.status === 'WAITING FOR POSTING' && (
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
                                                )}
                                                {!nextStatus && (
                                                    <div className="workflow-done">
                                                        <CheckCircle2 size={18} />
                                                        Workflow Completed
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                            </div>
                        </div>

                        <div className="activity-log">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label className="detail-label" style={{ marginBottom: 0 }}>Activity Log</label>
                                {activeItem.history.length > 0 && (
                                    <button 
                                        onClick={handleUndoStatus}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', 
                                            background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', 
                                            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', 
                                            fontSize: '11px', fontWeight: 700, cursor: 'pointer' 
                                        }}
                                    >
                                        <Undo2 size={12} />
                                        Undo Last Step
                                    </button>
                                )}
                            </div>
                            <div className="timeline-container">
                                <div className="timeline-line"></div>
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
                                        const historyEntry = activeItem.history.find((h: any) => h.new_status === status);

                                        return (
                                            <div key={status} className={`timeline-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                                                <div className="step-indicator">
                                                    {isCompleted ? (
                                                        <Check size={14} className="step-checkmark" />
                                                    ) : isCurrent ? (
                                                        <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></div>
                                                    ) : (
                                                        <div style={{ width: '6px', height: '6px', background: 'var(--border)', borderRadius: '50%' }}></div>
                                                    )}
                                                </div>
                                                <div className="step-content">
                                                    <span className="step-title">{status}</span>
                                                    {historyEntry && (
                                                        <div className="step-meta">
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span className="step-user">
                                                                    {historyEntry.users?.role_identifier || historyEntry.users?.name || 'Updated'}
                                                                </span>
                                                                <span className="step-time">
                                                                    {format(parseISO(historyEntry.changed_at), 'MMM d, HH:mm')}
                                                                </span>
                                                            </div>
                                                            {historyEntry.note && (
                                                                <div className="log-note" style={{ margin: '8px 0 0 0', background: 'rgba(255,255,255,0.02)', border: 'none', borderLeft: '2px solid var(--accent)' }}>
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
        </div>
    );
}

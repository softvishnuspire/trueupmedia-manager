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
import { tlApi, gmApi, emergencyApi } from '@/lib/api';
import { createClient } from '@/utils/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import NotificationBell from '@/components/NotificationBell';
import '../../admin/admin.css'; // Using Admin Panel UI styles

// Reusing interfaces from GM/Admin
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
    const [view, setView] = useState<'dashboard' | 'client' | 'master'>('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, percentage: 0, remaining: 0 });
    const [emergencyTasks, setEmergencyTasks] = useState<ContentItem[]>([]);

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
    const [activeItem, setActiveItem] = useState<any>(null);
    const [statusNote, setStatusNote] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);


    const isMasterMode = view === 'master';

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    window.location.href = '/';
                    return;
                }

                // Verify role
                const { data: profileData, error: profileError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                const isTeamLead = ['tl', 'tl1', 'tl2', 'team lead', 'TL1', 'TL2', 'TEAM LEAD'].includes(profileData?.role);

                if (profileError || !profileData || !isTeamLead) {
                    console.warn('Profile validation check:', { role: profileData?.role, isTeamLead });
                }

                setUser(user);
                setProfile(profileData);
                await fetchClients(user.id);
            } catch (err) {
                console.error('Initialization error:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);


    useEffect(() => {
        if (user) {
            if (view === 'master' || view === 'dashboard') {
                fetchMasterCalendar();
            } else if (view === 'client' && selectedClient) {
                fetchClientCalendar();
            }
        }
    }, [selectedClient, currentMonth, view, user]);

    const fetchClients = async (tlId: string) => {
        try {
            const res = await tlApi.getClients(tlId);
            setClients(res.data);
            if (res.data.length > 0 && !selectedClient) {
                setSelectedClient(res.data[0].id);
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
            
            // Fetch all emergency tasks
            const emergencyRes = await emergencyApi.getAll();
            setEmergencyTasks(emergencyRes.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
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
            
            // Pass the note - ensure it's not just an empty string if we want it to be recognized as 'null' in DB
            await gmApi.updateStatus(activeItem.item.id, newStatus, statusNote.trim() || undefined, actorId);
            
            setStatusNote(''); // Clear note after success
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

            {/* Sidebar - Using Admin Sidebar Style */}
            <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
                <div className="logo-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="logo-icon">T</div>
                        <span>TrueUp Media</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="sidebar-close">
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
                <div className="mobile-header-top">
                    <div className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={24} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--accent)' }}>TrueUp</div>
                    <div style={{ width: '40px' }}></div>
                </div>

                <header className="page-header">
                    <div>
                        <h1 className="page-title">
                            {view === 'master' ? 'Master Calendar' : 'Client Dashboard'}
                        </h1>
                        <p className="page-subtitle">
                            {view === 'master' 
                                ? 'Unified view of all assigned client schedules' 
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
                                    <Users size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Managed Clients</h3>
                                    <p className="stat-value">{clients.length}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                                    <CalendarIcon size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Total Monthly Content</h3>
                                    <p className="stat-value">{calendarData.length}</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                                    <Clock size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>Today's Throughput</h3>
                                    <p className="stat-value">{todayStats.total}</p>
                                </div>
                            </div>
                        </div>

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
                                <div key={day} className="calendar-header-cell">{day}</div>
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
                                        const dayContent = calendarData.filter(item => {
                                            const itemDate = parseISO(item.scheduled_datetime);
                                            return isSameDay(itemDate, day);
                                        });
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                            >
                                                <span className="day-number">{format(day, 'd')}</span>
                                                <div className="day-items">
                                                    {dayContent.map(item => (
                                                        <div 
                                                            key={item.id}
                                                            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                                            className={`content-item ${item.content_type.toLowerCase()} ${item.is_emergency ? 'emergency' : ''}`}
                                                            title={item.content_type}
                                                        >
                                                            {item.content_type === 'Post' ? <FileText size={10}/> : <Video size={10}/>}
                                                            <span className="truncate" style={{ fontSize: '9px' }}>
                                                                {view === 'master' ? `[${item.clients?.company_name?.substring(0,3)}] ` : ''}
                                                                {item.content_type}
                                                            </span>
                                                        </div>
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
                                        const historyEntry = activeItem.history.find((h: any) => h.new_status === status);

                                        return (
                                            <div key={status} style={{ 
                                                display: 'flex', alignItems: 'flex-start', gap: '20px', 
                                                paddingBottom: idx === flow.length - 1 ? 0 : '32px', 
                                                position: 'relative', zIndex: 2 
                                            }}>
                                                <div style={{ 
                                                    width: '24px', height: '24px', borderRadius: '50%', 
                                                    background: isCompleted ? '#10b981' : isCurrent ? '#4f46e5' : 'white',
                                                    border: `2px solid ${isCompleted ? '#10b981' : isCurrent ? '#4f46e5' : '#ef4444'}`,
                                                    flexShrink: 0, marginTop: '2px', display: 'flex', 
                                                    alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: isCompleted ? '0 0 15px rgba(16, 185, 129, 0.4)' : isCurrent ? '0 0 20px rgba(79, 70, 229, 0.5)' : 'none',
                                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                                }}>
                                                    {isCompleted ? (
                                                        <Check size={14} color="white" strokeWidth={3} />
                                                    ) : isCurrent ? (
                                                        <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%' }}></div>
                                                    ) : (
                                                        <div style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%' }}></div>
                                                    )}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <span style={{ 
                                                        fontSize: isCurrent ? '15px' : '14px', fontWeight: 800, 
                                                        color: isCompleted ? '#10b981' : isCurrent ? '#1e293b' : '#ef4444',
                                                        letterSpacing: '0.02em', transition: 'all 0.3s'
                                                    }}>{status}</span>
                                                    {historyEntry && (
                                                        <div style={{ 
                                                            display: 'flex', flexDirection: 'column', marginTop: '6px',
                                                            padding: '10px 14px', background: 'rgba(79, 70, 229, 0.03)',
                                                            borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.05)'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    {historyEntry.users?.role_identifier || historyEntry.users?.name || 'Updated'}
                                                                </span>
                                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                    {format(parseISO(historyEntry.changed_at), 'MMM d, HH:mm')}
                                                                </span>
                                                            </div>
                                                            {historyEntry.note && (
                                                                <div style={{ 
                                                                    marginTop: '8px', padding: '8px 12px', 
                                                                    background: 'rgba(255, 255, 255, 0.5)', borderRadius: '8px', 
                                                                    fontSize: '12px', color: '#475569', 
                                                                    fontStyle: 'italic', borderLeft: '3px solid #4f46e5'
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
        </div>
    );
}

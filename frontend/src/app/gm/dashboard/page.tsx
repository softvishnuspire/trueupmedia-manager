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
    Menu
} from 'lucide-react';
import { gmApi } from '@/lib/api';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
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
    
    const isMasterMode = view === 'master';

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content_type: 'Post' as 'Post' | 'Reel',
        time: '10:00'
    });

    useEffect(() => {
        fetchClients();
        const savedUser = localStorage.getItem('user');
        if (savedUser) setUser(JSON.parse(savedUser));
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

            setStats({
                totalClients: clients.length,
                totalTeams: teamLeads.length,
                monthlyContent: data.length,
                statusBreakdown: breakdown
            });
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
        setFormData({ title: '', description: '', content_type: 'Post', time: '10:00' });
        setIsModalOpen(true);
    };

    const handleItemClick = async (item: ContentItem) => {
        try {
            const res = await gmApi.getContentDetails(item.id);
            setActiveItem(res.data);
            setIsDetailsOpen(true);
        } catch (err) { console.error(err); }
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
        router.push('/login');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const scheduled_datetime = format(selectedDate!, 'yyyy-MM-dd') + 'T' + formData.time + ':00';
        try {
            if (editingItem) {
                await gmApi.updateContent(editingItem.id, { title: formData.title, description: formData.description, scheduled_datetime });
            } else {
                await gmApi.addContent({ client_id: selectedClient, title: formData.title, description: formData.description, content_type: formData.content_type, scheduled_datetime });
            }
            setIsModalOpen(false);
            if (view === 'master') fetchMasterCalendar(); else fetchClientCalendar();
        } catch (err) { alert('Error saving item'); }
    };

    const getClientName = () => {
        const c = clients.find(c => c.id === selectedClient);
        return c?.company_name || 'Client';
    };

    return (
        <div className="dashboard-container">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="logo-container">
                    <img src="/logo.png" alt="TrueUp Media" className="logo-img" />
                    <span style={{ marginLeft: '4px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>GM</span>
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
                                {clients.length === 0 && (
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px' }}>No clients found</p>
                                )}
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
                <header className="page-header">
                    <div className="mobile-header-top">
                        <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                            <Menu size={20} />
                        </button>
                        <img src="/logo.png" alt="TrueUp" className="mobile-logo-img" />
                        <div style={{ width: '40px' }}></div>
                    </div>
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

                {loading && <div className="loading-bar">Loading...</div>}

                {view === 'dashboard' && (
                    <div className="dashboard-view">
                        <div className="stats-grid">
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
                                        <div className="action-icon" style={{ background: 'var(--bg-elevated)' }}><Users size={18}/></div>
                                        <div className="action-text">
                                            <p className="action-title">Manage Teams</p>
                                            <p className="action-desc">Assign clients to team leads</p>
                                        </div>
                                        <ChevronRight size={16} />
                                    </button>
                                    <button onClick={() => setView('master')} className="action-item">
                                        <div className="action-icon" style={{ background: 'var(--bg-elevated)' }}><Globe size={18}/></div>
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
                                <div className="teams-loading-state">
                                    <div className="spinner"></div>
                                </div>
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
                                                    className={`content-item ${item.content_type.toLowerCase()}`}
                                                >
                                                    {item.content_type === 'Post' ? <FileText size={10} /> : <Video size={10} />}
                                                    <span className="truncate">
                                                        {view === 'master' ? `[${item.clients?.company_name?.substring(0, 3)}] ` : ''}
                                                        {item.title}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mobile-day-indicators">
                                            {dayContent.map(item => (
                                                <div 
                                                    key={item.id}
                                                    className={`mobile-dot ${item.content_type.toLowerCase()}`}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 className="modal-title">Schedule New Content</h3>
                            <button onClick={() => setIsModalOpen(false)} className="modal-close"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input required className="form-input" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Enter content title..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Add some details..." />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-input" value={formData.content_type} onChange={e => setFormData({ ...formData, content_type: e.target.value as any })}>
                                        <option value="Post">Post</option>
                                        <option value="Reel">Reel</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Time</label>
                                    <input type="time" className="form-input" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary">
                                <Plus size={18} />
                                Create Content Schedule
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
                            <button onClick={() => setDailyAgenda(null)} className="modal-close"><X size={20}/></button>
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
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</p>
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
                                <h3 className="modal-title" style={{ marginTop: '8px' }}>{activeItem.item.title}</h3>
                            </div>
                            <button onClick={() => setIsDetailsOpen(false)} className="modal-close"><X size={20} /></button>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-main">
                                <div className="detail-section">
                                    <label className="detail-label">Description</label>
                                    <p className="detail-text">{activeItem.item.description || 'No description provided.'}</p>
                                </div>

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
                                </div>
                            </div>
                            <div className="detail-workflow">
                                <label className="detail-label">Workflow Status</label>
                                <div className="workflow-content">
                                    {(() => {
                                        const flows: any = {
                                            'Reel': ['CONTENT READY', 'SHOOT DONE', 'EDITING IN PROGRESS', 'EDITED', 'WAITING FOR APPROVAL', 'APPROVED', 'POSTED'],
                                            'Post': ['CONTENT APPROVED', 'DESIGNING IN PROGRESS', 'DESIGNING COMPLETED', 'WAITING FOR APPROVAL', 'APPROVED']
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
                                                {nextStatus && (
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
                                                            <ArrowRight size={18} className="advance-arrow"/>
                                                        </button>
                                                    </div>
                                                )}
                                                {!nextStatus && (
                                                    <div className="workflow-done">
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

                        <div className="activity-log">
                            <label className="detail-label">Activity Log</label>
                            <div className="log-list">
                                {activeItem.history.length === 0 && (
                                    <p className="log-empty">No activity yet</p>
                                )}
                                {activeItem.history.map((log: any) => (
                                    <div key={log.log_id} className="log-entry">
                                        <div className="log-main">
                                            <div className="log-status">
                                                <div className="log-dot"></div>
                                                <span>{log.new_status}</span>
                                            </div>
                                            <span className="log-user">
                                                {log.users?.role_identifier ? `Done by ${log.users.role_identifier}` :
                                                 log.users?.name ? `Done by ${log.users.name}` : 'Status updated'}
                                            </span>
                                            <span className="log-time">{format(parseISO(log.changed_at), 'MMM d, HH:mm')}</span>
                                        </div>
                                        {log.note && (
                                            <div className="log-note">
                                                "{log.note}"
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

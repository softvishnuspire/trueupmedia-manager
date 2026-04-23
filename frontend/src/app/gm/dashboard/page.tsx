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
    LogOut,
    Filter
} from 'lucide-react';
import { gmApi } from '@/lib/api';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
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
    const [view, setView] = useState<'client' | 'master' | 'teams'>('client');
    
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
    
    const isMasterMode = view === 'master';

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content_type: 'Post' as 'Post' | 'Reel',
        time: '10:00'
    });

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (view === 'master') {
            fetchMasterCalendar();
        } else if (view === 'client' && selectedClient && selectedClient !== 'all') {
            fetchClientCalendar();
        } else if (view === 'teams') {
            fetchTeamLeads();
        }
    }, [selectedClient, selectedType, currentMonth, view]);

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
            await gmApi.updateStatus(activeItem.item.id, newStatus);
            const res = await gmApi.getContentDetails(activeItem.item.id);
            setActiveItem(res.data);
            if (isMasterMode) fetchMasterCalendar(); else fetchClientCalendar();
        } catch (err: any) {
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
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="logo-container">
                    <img src="/logo.png" alt="TrueUp Media" className="logo-img" />
                    <span style={{ marginLeft: '4px', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>GM</span>
                </div>

                <nav className="flex-1">
                    <p className="sidebar-label">Navigation</p>
                    <div 
                        onClick={() => setView('client')}
                        className={`nav-item ${view === 'client' ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={20} />
                        <span>Client Dashboard</span>
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
                                    <p style={{ fontSize: 12, color: '#94a3b8', padding: '8px 12px' }}>No clients found</p>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="user-avatar">
                            <Users size={20} />
                        </div>
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
                    <div>
                        <h1 className="page-title">
                            {view === 'master' ? 'Master Schedule' : view === 'teams' ? 'Team Management' : 'Client Calendar'}
                        </h1>
                        <p className="page-subtitle">
                            {view === 'teams' ? 'Assign clients to team leads and monitor workloads' : 'Review and manage content production flow'}
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
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f8fafc', padding: '4px', borderRadius: '14px', border: '1px solid #e2e8f0', marginRight: '8px' }}>
                                <div style={{ padding: '0 8px', color: '#94a3b8' }}>
                                    <Filter size={14} />
                                </div>
                                <div className="client-dropdown-wrapper">
                                    <select
                                        className="client-dropdown"
                                        value={selectedClient}
                                        onChange={(e) => setSelectedClient(e.target.value)}
                                        style={{ minWidth: '140px', border: 'none', background: 'transparent', boxShadow: 'none', padding: '6px 32px 6px 4px' }}
                                    >
                                        <option value="all">All Clients</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.company_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="dropdown-chevron" />
                                </div>
                                <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }}></div>
                                <div className="client-dropdown-wrapper">
                                    <select
                                        className="client-dropdown"
                                        value={selectedType}
                                        onChange={(e) => setSelectedType(e.target.value)}
                                        style={{ minWidth: '140px', border: 'none', background: 'transparent', boxShadow: 'none', padding: '6px 32px 6px 4px' }}
                                    >
                                        <option value="all">All Types</option>
                                        <option value="Post">Posts</option>
                                        <option value="Reel">Reels</option>
                                    </select>
                                    <ChevronDown size={14} className="dropdown-chevron" />
                                </div>
                            </div>
                        )}

                        {view !== 'teams' && (
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
                                    <button onClick={handlePrev} className="month-btn"><ChevronLeft size={20}/></button>
                                    <span className="month-label">
                                        {viewMode === 'month' 
                                            ? format(currentMonth, 'MMMM yyyy')
                                            : `Week of ${format(startOfWeek(currentMonth, { weekStartsOn: 1 }), 'MMM d')}`
                                        }
                                    </span>
                                    <button onClick={handleNext} className="month-btn"><ChevronRight size={20}/></button>
                                </div>
                            </>
                        )}
                    </div>
                </header>

                {loading && <div className="loading-bar">Loading...</div>}

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
                                                        {lead.role_identifier && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>({lead.role_identifier})</span>}
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
                                        <button onClick={() => setIsAssignModalOpen(false)} className="modal-close"><X size={20}/></button>
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
                                        <p style={{ fontSize: 12, color: '#64748b' }}>
                                            Only showing clients not currently assigned to any team lead.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="calendar-card">
                        <div className="calendar-grid" style={{ gridTemplateRows: viewMode === 'week' ? 'auto 1fr' : 'auto' }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <div key={day} className="calendar-header-cell">{day}</div>
                            ))}

                            {days.map((day, idx) => {
                                const dayContent = calendarData.filter(item => {
                                    const itemDate = parseISO(item.scheduled_datetime);
                                    return isSameDay(itemDate, day);
                                });
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => handleAddClick(day)}
                                        className={`calendar-day ${viewMode === 'week' ? 'weekly-cell' : ''} ${!isSameMonth(day, currentMonth) && viewMode === 'month' ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                        style={{ minHeight: viewMode === 'week' ? '300px' : '110px' }}
                                    >
                                        <span className="day-number">{format(day, 'd')}</span>
                                        <div className="day-items">
                                            {dayContent.map(item => (
                                                <div 
                                                    key={item.id}
                                                    onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                                    className={`content-item ${item.content_type.toLowerCase()}`}
                                                >
                                                    {item.content_type === 'Post' ? <FileText size={10}/> : <Video size={10}/>}
                                                    <span className="truncate">
                                                        {view === 'master' ? `[${item.clients?.company_name?.substring(0,3)}] ` : ''}
                                                        {item.title}
                                                    </span>
                                                </div>
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
                            <button onClick={() => setIsModalOpen(false)} className="modal-close"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input required className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Enter content title..."/>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Add some details..."/>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-input" value={formData.content_type} onChange={e => setFormData({...formData, content_type: e.target.value as any})}>
                                        <option value="Post">Post</option>
                                        <option value="Reel">Reel</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Time</label>
                                    <input type="time" className="form-input" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})}/>
                                </div>
                            </div>
                            <button type="submit" className="btn-primary">
                                <Plus size={18}/>
                                Create Content Schedule
                            </button>
                        </form>
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
                                <h3 className="modal-title">{activeItem.item.title}</h3>
                            </div>
                            <button onClick={() => setIsDetailsOpen(false)} className="modal-close"><X size={20}/></button>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-info">
                                <div>
                                    <label className="detail-label">Description</label>
                                    <p className="detail-text">{activeItem.item.description || 'No description provided.'}</p>
                                </div>
                                <div className="detail-dates">
                                    <div>
                                        <label className="detail-label">Scheduled For</label>
                                        <div className="date-display">
                                            <CalendarIcon size={14} className="date-icon"/>
                                            {format(parseISO(activeItem.item.scheduled_datetime), 'MMM d, yyyy')}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="detail-label">Posting At</label>
                                        <div className="date-display">
                                            <Clock size={14} className="date-icon"/>
                                            {format(parseISO(activeItem.item.scheduled_datetime), 'hh:mm a')}
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
                                                    <button 
                                                        onClick={() => handleStatusUpdate(nextStatus)}
                                                        className="btn-advance"
                                                    >
                                                        <span>Advance to {nextStatus}</span>
                                                        <ArrowRight size={18} className="advance-arrow"/>
                                                    </button>
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
                                        <div className="log-status">
                                            <div className="log-dot"></div>
                                            <span>{log.new_status}</span>
                                        </div>
                                        <span className="log-time">{format(parseISO(log.changed_at), 'MMM d, HH:mm')}</span>
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

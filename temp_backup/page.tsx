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
    ArrowRight
} from 'lucide-react';
import { gmApi } from '@/lib/api';
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
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMasterMode, setIsMasterMode] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
    const [activeItem, setActiveItem] = useState<any>(null);
    
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
        if (isMasterMode) {
            fetchMasterCalendar();
        } else if (selectedClient) {
            fetchClientCalendar();
        }
    }, [selectedClient, currentMonth, isMasterMode]);

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
            const res = await gmApi.getMasterCalendar(format(currentMonth, 'yyyy-MM'));
            setCalendarData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });

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
            if (isMasterMode) fetchMasterCalendar(); else fetchClientCalendar();
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
                    <div className="logo-icon">T</div>
                    <span>TrueUp Media</span>
                </div>

                <nav className="flex-1">
                    <p className="sidebar-label">Navigation</p>
                    <div 
                        onClick={() => setIsMasterMode(false)}
                        className={`nav-item ${!isMasterMode ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={20} />
                        <span>Client Dashboard</span>
                    </div>
                    <div 
                        onClick={() => setIsMasterMode(true)}
                        className={`nav-item ${isMasterMode ? 'active' : ''}`}
                    >
                        <Globe size={20} />
                        <span>Master Calendar</span>
                    </div>

                    {!isMasterMode && (
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
                    <div className="user-avatar">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className="user-name">General Manager</p>
                        <p className="user-role">TrueUp Media</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="page-header">
                    <div>
                        <h1 className="page-title">
                            {isMasterMode ? 'Master Schedule' : 'Client Calendar'}
                        </h1>
                        <p className="page-subtitle">Review and manage content production flow</p>
                    </div>

                    <div className="header-controls">
                        {!isMasterMode && (
                            <div className="client-dropdown-wrapper">
                                <select
                                    className="client-dropdown"
                                    value={selectedClient}
                                    onChange={(e) => setSelectedClient(e.target.value)}
                                >
                                    <option value="" disabled>Select a client</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.company_name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="dropdown-chevron" />
                            </div>
                        )}

                        <div className="month-nav">
                            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="month-btn"><ChevronLeft size={20}/></button>
                            <span className="month-label">{format(currentMonth, 'MMMM yyyy')}</span>
                            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="month-btn"><ChevronRight size={20}/></button>
                        </div>
                    </div>
                </header>

                {loading && <div className="loading-bar">Loading...</div>}

                <div className="calendar-card">
                    <div className="calendar-grid">
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
                                    className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
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
                                                    {isMasterMode ? `[${item.clients?.company_name?.substring(0,3)}] ` : ''}
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

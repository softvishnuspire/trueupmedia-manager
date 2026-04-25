"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    FileText,
    Video,
    X,
    Clock,
    Calendar as CalendarIcon,
    Plus,
    ArrowLeft,
    Edit,
    Trash2
} from 'lucide-react';
import { gmApi, adminApi } from '@/lib/api';

interface ContentItem {
    id: string;
    title: string;
    description: string;
    content_type: 'Post' | 'Reel';
    scheduled_datetime: string;
    status: string;
    client_id: string;
}

export default function ClientCalendarPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.id as string;

    const [client, setClient] = useState<any>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [dailyAgenda, setDailyAgenda] = useState<{ date: Date, items: ContentItem[] } | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingItem, setEditingItem] = useState<ContentItem | null>(null);

    const [formData, setFormData] = useState({
        content_type: 'Post' as 'Post' | 'Reel',
        scheduled_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        client_id: clientId,
        title: '',
        description: ''
    });

    const fetchClientInfo = useCallback(async () => {
        try {
            const res = await adminApi.getClients();
            const found = res.data.find((c: any) => c.id === clientId);
            if (found) setClient(found);
        } catch (err) { console.error(err); }
    }, [clientId]);

    const fetchCalendarData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch for a slightly larger range to ensure we cover the week/month boundaries
            const res = await gmApi.getMasterCalendar(
                format(currentMonth, 'yyyy-MM'),
                clientId
            );
            setCalendarData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [currentMonth, clientId]);

    useEffect(() => {
        fetchClientInfo();
        fetchCalendarData();
    }, [fetchClientInfo, fetchCalendarData]);

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

    const handleItemClick = async (item: ContentItem) => {
        try {
            const res = await gmApi.getContentDetails(item.id);
            setSelectedItem(res.data);
        } catch (err) { console.error(err); }
    };

    const handleEditClick = (item: ContentItem) => {
        setEditingItem(item);
        setFormData({
            content_type: item.content_type,
            scheduled_datetime: format(parseISO(item.scheduled_datetime), "yyyy-MM-dd'T'HH:mm"),
            client_id: item.client_id,
            title: item.title || '',
            description: item.description || ''
        });
        setSelectedItem(null);
        setShowAddModal(true);
    };

    const handleDeleteContent = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this content item?')) return;
        try {
            await gmApi.deleteContent(id);
            setSelectedItem(null);
            fetchCalendarData();
        } catch (err) { console.error(err); alert('Failed to delete content'); }
    };

    const handleAddContent = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await gmApi.updateContent(editingItem.id, formData);
            } else {
                await gmApi.addContent(formData);
            }
            setShowAddModal(false);
            setEditingItem(null);
            setFormData({
                content_type: 'Post',
                scheduled_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                client_id: clientId,
                title: '',
                description: ''
            });
            fetchCalendarData();
        } catch (err) { console.error(err); alert('Error saving content'); }
    };

    if (!client && !loading) return <div className="p-8">Loading client info...</div>;

    return (
        <div>
            <header className="page-header">
                <div className="header-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => router.back()} className="btn-icon">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="header-info">
                            <h1 className="page-title">{client?.company_name} Calendar</h1>
                            <p className="page-subtitle">Manage scheduling and content for this client</p>
                        </div>
                    </div>

                    <div className="header-controls">
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
                            <button onClick={handlePrev} className="month-btn">
                                <ChevronLeft size={20}/>
                            </button>
                            <span className="month-label">
                                {viewMode === 'month' 
                                    ? format(currentMonth, 'MMMM yyyy')
                                    : `Week of ${format(startOfWeek(currentMonth, { weekStartsOn: 1 }), 'MMM d')}`
                                }
                            </span>
                            <button onClick={handleNext} className="month-btn">
                                <ChevronRight size={20}/>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {loading && <div className="loading-bar">Updating calendar...</div>}

            <div className="calendar-card">
                <div className="calendar-grid" style={{ gridTemplateRows: viewMode === 'week' ? 'auto 1fr' : 'repeat(6, 1fr)' }}>
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
                                    } else {
                                        setFormData({
                                            ...formData,
                                            scheduled_datetime: format(day, "yyyy-MM-dd") + 'T10:00'
                                        });
                                        setShowAddModal(true);
                                    }
                                }}
                                className={`calendar-day ${viewMode === 'week' ? 'weekly-cell' : ''} ${!isSameMonth(day, currentMonth) && viewMode === 'month' ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                style={{ minHeight: viewMode === 'week' ? '300px' : '110px', cursor: 'pointer' }}
                            >
                                <span className="day-number">{format(day, 'd')}</span>
                                <div className="day-items desktop-only">
                                    {dayContent.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                            className={`content-item ${item.content_type.toLowerCase()}`}
                                        >
                                            {item.content_type === 'Post' ? <FileText size={10}/> : <Video size={10}/>}
                                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                {item.content_type}
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
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.content_type}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg">
                        <div className="modal-header">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span className={`type-badge ${selectedItem.item.content_type.toLowerCase()}`}>
                                        {selectedItem.item.content_type}
                                    </span>
                                </div>
                                <h3 className="modal-title">{selectedItem.item.content_type}</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                    onClick={() => handleEditClick(selectedItem.item)} 
                                    className="btn-icon" 
                                    title="Edit Content"
                                    style={{ color: 'var(--accent)' }}
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteContent(selectedItem.item.id)} 
                                    className="btn-icon" 
                                    title="Delete Content"
                                    style={{ color: '#ef4444' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button onClick={() => setSelectedItem(null)} className="modal-close"><X size={20}/></button>
                            </div>
                        </div>
                        
                        <div className="detail-grid">
                            <div className="detail-info" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>


                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <div>
                                        <label className="detail-label">Scheduled Date</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            <CalendarIcon size={14} style={{ color: 'var(--accent)' }}/>
                                            {format(parseISO(selectedItem.item.scheduled_datetime), 'MMM d, yyyy')}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="detail-label">Posting Time</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            <Clock size={14} style={{ color: 'var(--accent)' }}/>
                                            {format(parseISO(selectedItem.item.scheduled_datetime), 'hh:mm a')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="detail-label">Workflow Status</label>
                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '4px' }}>Current</p>
                                    <p style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{selectedItem.item.status}</p>
                                </div>

                                <label className="detail-label">Activity Log</label>
                                <div className="log-list">
                                    {selectedItem.history.map((log: any) => (
                                        <div key={log.log_id} className="log-entry">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }}></div>
                                                <span>{log.new_status}</span>
                                            </div>
                                            <span className="log-time">{format(parseISO(log.changed_at), 'MMM d, HH:mm')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Content Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 className="modal-title">{editingItem ? 'Edit Content' : 'Schedule New Content'}</h3>
                            <button onClick={() => { setShowAddModal(false); setEditingItem(null); }} className="modal-close"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleAddContent}>

                            <div className="form-group">
                                <label className="form-label">Content Type</label>
                                <select 
                                    className="form-input"
                                    value={formData.content_type}
                                    onChange={(e) => setFormData({...formData, content_type: e.target.value as 'Post' | 'Reel'})}
                                    disabled={!!editingItem}
                                >
                                    <option value="Post">Post</option>
                                    <option value="Reel">Reel</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Scheduled Date & Time *</label>
                                <input 
                                    type="datetime-local" 
                                    className="form-input" 
                                    required
                                    value={formData.scheduled_datetime}
                                    onChange={(e) => setFormData({...formData, scheduled_datetime: e.target.value})}
                                />
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => { setShowAddModal(false); setEditingItem(null); }}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                                    {editingItem ? 'Update' : 'Schedule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

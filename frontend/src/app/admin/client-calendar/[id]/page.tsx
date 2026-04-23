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
    ArrowLeft
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
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content_type: 'Post',
        scheduled_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        client_id: clientId
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

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });

    const handleItemClick = async (item: ContentItem) => {
        try {
            const res = await gmApi.getContentDetails(item.id);
            setSelectedItem(res.data);
        } catch (err) { console.error(err); }
    };

    const handleAddContent = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await gmApi.addContent(formData);
            setShowAddModal(false);
            setFormData({
                title: '',
                description: '',
                content_type: 'Post',
                scheduled_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                client_id: clientId
            });
            fetchCalendarData();
        } catch (err) { console.error(err); }
    };

    if (!client && !loading) return <div className="p-8">Loading client info...</div>;

    return (
        <div>
            <header className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => router.back()} className="btn-icon">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="page-title">{client?.company_name} Calendar</h1>
                        <p className="page-subtitle">Manage scheduling and content for this client</p>
                    </div>
                </div>

                <div className="header-controls">
                    <div className="month-nav">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="month-btn">
                            <ChevronLeft size={20}/>
                        </button>
                        <span className="month-label">{format(currentMonth, 'MMMM yyyy')}</span>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="month-btn">
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                    <button className="btn-add" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> Schedule Content
                    </button>
                </div>
            </header>

            {loading && <div className="loading-bar">Updating calendar...</div>}

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
                                className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                            >
                                <span className="day-number">{format(day, 'd')}</span>
                                <div className="day-items">
                                    {dayContent.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={() => handleItemClick(item)}
                                            className={`content-item ${item.content_type.toLowerCase()}`}
                                        >
                                            {item.content_type === 'Post' ? <FileText size={10}/> : <Video size={10}/>}
                                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
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
                                <h3 className="modal-title">{selectedItem.item.title}</h3>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="modal-close"><X size={20}/></button>
                        </div>
                        
                        <div className="detail-grid">
                            <div className="detail-info" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label className="detail-label">Description</label>
                                    <p className="detail-text">{selectedItem.item.description || 'No description provided.'}</p>
                                </div>

                                <div style={{ display: 'flex', gap: '24px' }}>
                                    <div>
                                        <label className="detail-label">Scheduled Date</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                            <CalendarIcon size={14} style={{ color: '#4f46e5' }}/>
                                            {format(parseISO(selectedItem.item.scheduled_datetime), 'MMM d, yyyy')}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="detail-label">Posting Time</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                            <Clock size={14} style={{ color: '#4f46e5' }}/>
                                            {format(parseISO(selectedItem.item.scheduled_datetime), 'hh:mm a')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="detail-label">Workflow Status</label>
                                <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: '4px' }}>Current</p>
                                    <p style={{ fontSize: '18px', fontWeight: 900, color: '#312e81' }}>{selectedItem.item.status}</p>
                                </div>

                                <label className="detail-label">Activity Log</label>
                                <div className="log-list">
                                    {selectedItem.history.map((log: any) => (
                                        <div key={log.log_id} className="log-entry">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#1e293b' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }}></div>
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
                            <h3 className="modal-title">Schedule New Content</h3>
                            <button onClick={() => setShowAddModal(false)} className="modal-close"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleAddContent}>
                            <div className="form-group">
                                <label className="form-label">Title / Brief *</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    required 
                                    value={formData.title}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    placeholder="e.g. Summer Collection Launch Post"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Content Type</label>
                                <select 
                                    className="form-input"
                                    value={formData.content_type}
                                    onChange={(e) => setFormData({...formData, content_type: e.target.value})}
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
                            <div className="form-group">
                                <label className="form-label">Description / Instructions</label>
                                <textarea 
                                    className="form-input" 
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Add any specific details for the content creation team..."
                                    style={{ resize: 'none' }}
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                                    Schedule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

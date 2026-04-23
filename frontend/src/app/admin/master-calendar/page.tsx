"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
    Filter,
    ChevronDown
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
    clients?: { company_name: string };
}

export default function MasterCalendar() {
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const res = await adminApi.getClients();
                setClients(res.data);
            } catch (err) { console.error(err); }
        };
        fetchClients();
    }, []);

    const fetchMasterData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await gmApi.getMasterCalendar(
                format(currentMonth, 'yyyy-MM'),
                selectedClient === 'all' ? undefined : selectedClient,
                selectedType === 'all' ? undefined : selectedType
            );
            setCalendarData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [currentMonth, selectedClient, selectedType]);

    useEffect(() => {
        fetchMasterData();
    }, [fetchMasterData]);

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

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">Master Schedule</h1>
                    <p className="page-subtitle">Company-wide view of all scheduled content</p>
                </div>

                <div className="header-controls">
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#f8fafc', padding: '4px', borderRadius: '14px', border: '1px solid #e2e8f0', marginRight: '8px' }}>
                        <div style={{ padding: '0 8px', color: '#94a3b8' }}>
                            <Filter size={14} />
                        </div>
                        <div className="client-dropdown-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <select 
                                value={selectedClient} 
                                onChange={(e) => setSelectedClient(e.target.value)}
                                style={{ 
                                    minWidth: '130px', border: 'none', background: 'transparent', 
                                    boxShadow: 'none', padding: '6px 32px 6px 4px', 
                                    fontSize: '13px', fontWeight: 700, width: 'auto',
                                    color: '#1e293b', outline: 'none', appearance: 'none',
                                    WebkitAppearance: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Clients</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.company_name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
                        </div>
                        <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }}></div>
                        <div className="client-dropdown-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <select 
                                value={selectedType} 
                                onChange={(e) => setSelectedType(e.target.value)}
                                style={{ 
                                    minWidth: '100px', border: 'none', background: 'transparent', 
                                    boxShadow: 'none', padding: '6px 32px 6px 4px', 
                                    fontSize: '13px', fontWeight: 700, width: 'auto',
                                    color: '#1e293b', outline: 'none', appearance: 'none',
                                    WebkitAppearance: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Types</option>
                                <option value="Post">Posts</option>
                                <option value="Reel">Reels</option>
                            </select>
                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
                        </div>
                    </div>

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
            </header>


            {loading && <div className="loading-bar">Updating calendar...</div>}

            <div className="calendar-card">
                <div className="calendar-grid" style={{ gridTemplateRows: viewMode === 'week' ? 'auto 1fr' : 'auto', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
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
                                className={`calendar-day ${viewMode === 'week' ? 'weekly-cell' : ''} ${!isSameMonth(day, currentMonth) && viewMode === 'month' ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                style={{ minHeight: viewMode === 'week' ? '300px' : '110px' }}
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
                                                [{item.clients?.company_name?.substring(0, 3)}] {item.title}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg">
                        <div className="modal-header">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span className={`type-badge ${selectedItem.item.content_type.toLowerCase()}`}>
                                        {selectedItem.item.content_type}
                                    </span>
                                    <span style={{ color: '#cbd5e1', fontSize: '12px' }}>•</span>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>{selectedItem.item.clients?.company_name}</span>
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
                                            <CalendarIcon size={14} style={{ color: '#818cf8' }}/>
                                            {format(parseISO(selectedItem.item.scheduled_datetime), 'MMM d, yyyy')}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="detail-label">Posting Time</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                                            <Clock size={14} style={{ color: '#818cf8' }}/>
                                            {format(parseISO(selectedItem.item.scheduled_datetime), 'hh:mm a')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="detail-label">Workflow Status</label>
                                <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '4px' }}>Current</p>
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
                                    {selectedItem.history.length === 0 && <p style={{ fontSize: '13px', color: '#cbd5e1' }}>No status changes recorded.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

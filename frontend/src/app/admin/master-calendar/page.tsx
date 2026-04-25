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
import { Skeleton } from '@/components/ui/skeleton';

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
    const [dailyAgenda, setDailyAgenda] = useState<{ date: Date, items: ContentItem[] } | null>(null);

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
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '14px', border: '1px solid var(--border)', marginRight: '8px' }}>
                        <div style={{ padding: '0 8px', color: 'var(--text-muted)' }}>
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
                                    color: 'var(--text-primary)', outline: 'none', appearance: 'none',
                                    WebkitAppearance: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Clients</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.company_name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        </div>
                        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }}></div>
                        <div className="client-dropdown-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <select 
                                value={selectedType} 
                                onChange={(e) => setSelectedType(e.target.value)}
                                style={{ 
                                    minWidth: '100px', border: 'none', background: 'transparent', 
                                    boxShadow: 'none', padding: '6px 32px 6px 4px', 
                                    fontSize: '13px', fontWeight: 700, width: 'auto',
                                    color: 'var(--text-primary)', outline: 'none', appearance: 'none',
                                    WebkitAppearance: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Types</option>
                                <option value="Post">Posts</option>
                                <option value="Reel">Reels</option>
                            </select>
                            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
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


            {/* Loading bar removed in favor of skeletons */}

            <div className="calendar-card">
                <div className="calendar-grid" style={{ gridTemplateRows: viewMode === 'week' ? 'auto 1fr' : 'auto', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
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
                                            }
                                        }}
                                        className={`calendar-day ${viewMode === 'week' ? 'weekly-cell' : ''} ${!isSameMonth(day, currentMonth) && viewMode === 'month' ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                        style={{ minHeight: viewMode === 'week' ? '300px' : '110px', cursor: dayContent.length > 0 ? 'pointer' : 'default' }}
                                    >
                                        <span className="day-number">{format(day, 'd')}</span>
                                        <div className="day-items desktop-only">
                                            {dayContent.map(item => (
                                                <div 
                                                    key={item.id}
                                                    onClick={() => handleItemClick(item)}
                                                    className={`content-item ${item.content_type.toLowerCase()}`}
                                                >
                                                    {item.content_type === 'Post' ? <FileText size={10}/> : <Video size={10}/>}
                                                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                        [{item.clients?.company_name?.substring(0, 3)}] {item.content_type}
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
                        </>
                    )}
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
                                        background: '#f8fafc', border: '1px solid #e2e8f0',
                                        display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ 
                                        width: '4px', height: '24px', borderRadius: '2px', 
                                        background: item.content_type === 'Post' ? '#10b981' : '#6366f1' 
                                    }}></div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                            {item.clients?.company_name}
                                        </p>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{item.content_type}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg">
                        <div className="modal-header">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span className={`type-badge ${selectedItem.item.content_type.toLowerCase()}`}>
                                        {selectedItem.item.content_type}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>•</span>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{selectedItem.item.clients?.company_name}</span>
                                </div>
                                <h3 className="modal-title">{selectedItem.item.content_type}</h3>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="modal-close"><X size={20}/></button>
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
                                    {selectedItem.history.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No status changes recorded.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

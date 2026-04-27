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
    parseISO,
    isPast,
    isBefore,
    startOfDay
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
    ChevronDown,
    Check,
    CalendarClock,
    Undo2
} from 'lucide-react';
import { gmApi, adminApi, emergencyApi } from '@/lib/api';
import { ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
            const res = await adminApi.getMasterCalendar(
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
            const res = await adminApi.getContentDetails(item.id);
            setSelectedItem(res.data);
        } catch (err) { console.error(err); }
    };

    const handleUndoStatus = async () => {
        if (!selectedItem) return;
        if (!window.confirm('Are you sure you want to undo the last status change?')) return;
        try {
            await adminApi.undoStatus(selectedItem.item.id);
            const res = await adminApi.getContentDetails(selectedItem.item.id);
            setSelectedItem(res.data);
            fetchMasterData();
        } catch (err) { 
            console.error(err); 
            alert('Failed to undo status change. It might be because there is no more history to undo.'); 
        }
    };

    const handleToggleEmergency = async () => {
        if (!selectedItem) return;
        try {
            const res: any = await emergencyApi.toggle(selectedItem.item.id);
            if (res.data.success) {
                setSelectedItem({
                    ...selectedItem,
                    item: {
                        ...selectedItem.item,
                        is_emergency: res.data.is_emergency
                    }
                });
                // Update calendar data
                setCalendarData(prev => prev.map(item => 
                    item.id === selectedItem.item.id 
                        ? { ...item, is_emergency: res.data.is_emergency } 
                        : item
                ));
            }
        } catch (err) { console.error('Error toggling emergency:', err); }
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
                                                    className={`content-item ${item.is_rescheduled ? 'rescheduled' : item.content_type.toLowerCase()} ${item.is_emergency ? 'emergency' : ''}`}
                                                >
                                                    {item.content_type === 'Post' ? <FileText size={10}/> : <Video size={10}/>}
                                                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                        {item.is_rescheduled ? '[R] ' : ''}
                                                        [{item.clients?.company_name?.substring(0, 3)}] {item.content_type}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                    <span className={`type-badge ${selectedItem.item.content_type.toLowerCase()}`}>
                                        {selectedItem.item.content_type}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>•</span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedItem.item.clients?.company_name}</span>
                                </div>
                                <h3 className="modal-title">{selectedItem.item.title || selectedItem.item.content_type}</h3>
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="modal-close"><X size={20}/></button>
                        </div>
                        
                        <div className="detail-grid" style={{ padding: '32px' }}>
                            <div className="detail-info">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                    <div>
                                        <label className="detail-label">Scheduled Date</label>
                                        <div className="date-item">
                                            <CalendarIcon size={14} />
                                            <span className="date-display">{format(parseISO(selectedItem.item.scheduled_datetime), 'MMM d, yyyy')}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="detail-label">Posting Time</label>
                                        <div className="date-item">
                                            <Clock size={14} />
                                            <span className="date-display">{format(parseISO(selectedItem.item.scheduled_datetime), 'hh:mm a')}</span>
                                        </div>
                                    </div>
                                </div>
                                {(() => {
                                    const isOverdue = isBefore(parseISO(selectedItem.item.scheduled_datetime), new Date()) && selectedItem.item.status !== 'POSTED';
                                    if (isOverdue) {
                                        return (
                                            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
                                                <CalendarClock size={18} />
                                                Overdue - Needs Reschedule
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            <div>
                                <label className="detail-label">Workflow Status</label>
                                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '4px' }}>Current</p>
                                    <p style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>{selectedItem.item.status}</p>
                                </div>

                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between', 
                                    background: 'var(--bg-elevated)', 
                                    padding: '12px 16px', 
                                    borderRadius: '12px', 
                                    border: '1px solid var(--border)',
                                    marginBottom: '24px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <ShieldAlert size={18} color={selectedItem.item.is_emergency ? "#ef4444" : "var(--text-muted)"} />
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: selectedItem.item.is_emergency ? "#ef4444" : "var(--text-primary)" }}>
                                            Emergency Priority
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleToggleEmergency}
                                        style={{
                                            width: '44px',
                                            height: '24px',
                                            borderRadius: '12px',
                                            background: selectedItem.item.is_emergency ? '#ef4444' : 'var(--bg-surface)',
                                            border: `1px solid ${selectedItem.item.is_emergency ? '#ef4444' : 'var(--border)'}`,
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: selectedItem.item.is_emergency ? 'white' : 'var(--text-muted)',
                                            position: 'absolute',
                                            top: '2px',
                                            left: selectedItem.item.is_emergency ? '22px' : '2px',
                                            transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                                        }}></div>
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label className="detail-label" style={{ marginBottom: 0 }}>Activity Log</label>
                                    {selectedItem.history.length > 0 && (
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
                                <div style={{ marginTop: '24px', position: 'relative', paddingLeft: '12px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ 
                                        position: 'absolute', left: '23px', top: '12px', bottom: '12px', 
                                        width: '2px', background: 'linear-gradient(to bottom, #10b981 0%, var(--border) 100%)', opacity: 0.3, zIndex: 1 
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
                                        const flow = flows[selectedItem.item.content_type] || [];
                                        const currentStatus = selectedItem.item.status;
                                        const currentIdx = flow.indexOf(currentStatus);

                                        return flow.map((status: string, idx: number) => {
                                            const isCompleted = idx < currentIdx || currentStatus === 'POSTED';
                                            const isCurrent = idx === currentIdx && currentStatus !== 'POSTED';
                                            const historyEntry = selectedItem.history.find((h: any) => h.new_status === status);

                                            return (
                                                <div key={status} style={{ 
                                                    display: 'flex', alignItems: 'flex-start', gap: '20px', 
                                                    paddingBottom: idx === flow.length - 1 ? 0 : '32px', 
                                                    position: 'relative', zIndex: 2 
                                                }}>
                                                    <div style={{ 
                                                        width: '24px', height: '24px', borderRadius: '50%', 
                                                        background: isCompleted ? '#10b981' : isCurrent ? 'var(--accent)' : 'var(--bg-surface)',
                                                        border: `2px solid ${isCompleted ? '#10b981' : isCurrent ? 'var(--accent)' : '#ef4444'}`,
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
                                                            <div style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%' }}></div>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ 
                                                            fontSize: isCurrent ? '15px' : '14px', fontWeight: 800, 
                                                            color: isCompleted ? '#10b981' : isCurrent ? 'var(--text-primary)' : '#ef4444',
                                                            letterSpacing: '0.02em', transition: 'all 0.3s'
                                                        }}>{status}</span>
                                                        {historyEntry && (
                                                            <div style={{ 
                                                                display: 'flex', flexDirection: 'column', marginTop: '6px',
                                                                padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)',
                                                                borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)'
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
                                                                        background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', 
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
                </div>
            )}
        </div>
    );
}

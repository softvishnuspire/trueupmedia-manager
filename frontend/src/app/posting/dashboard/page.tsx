'use client';

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
    ChevronDown,
    ListChecks,
    Calendar as CalendarIcon,
    Globe,
    Clock,
    FileText,
    Video,
    CheckCircle2,
    Send,
    X,
    Filter,
    Inbox,
    Menu
} from 'lucide-react';
import { postingApi } from '@/lib/api';
import { createClient } from '@/utils/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import './posting.css';

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

export default function PostingDashboard() {
    const [view, setView] = useState<'queue' | 'client-cal' | 'master-cal'>('queue');
    const [queue, setQueue] = useState<ContentItem[]>([]);
    const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [postingId, setPostingId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [detailItem, setDetailItem] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    const supabase = createClient();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUser(user);
        };
        fetchUser();
        fetchClients();
    }, []);

    useEffect(() => {
        if (view === 'queue') fetchTodayQueue();
        else if (view === 'client-cal' && selectedClient) fetchClientCalendar();
        else if (view === 'master-cal') fetchMasterCalendar();
    }, [view, selectedClient, currentMonth]);

    const fetchClients = async () => {
        try {
            const res = await postingApi.getClients();
            setClients(res.data);
            if (res.data.length > 0) setSelectedClient(res.data[0].id);
        } catch (err) { console.error(err); }
    };

    const fetchTodayQueue = async () => {
        setLoading(true);
        try {
            const res = await postingApi.getToday();
            setQueue(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchClientCalendar = async () => {
        if (!selectedClient) return;
        setLoading(true);
        try {
            const res = await postingApi.getCalendar(selectedClient, format(currentMonth, 'yyyy-MM'));
            setCalendarData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchMasterCalendar = async () => {
        setLoading(true);
        try {
            const res = await postingApi.getMasterCalendar(format(currentMonth, 'yyyy-MM'));
            setCalendarData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleMarkPosted = async (id: string) => {
        setPostingId(id);
        try {
            const actorId = user?.id;
            await postingApi.markAsPosted(id, actorId);
            setToast('Content marked as POSTED!');
            setTimeout(() => setToast(null), 3000);
            // Refresh
            if (view === 'queue') fetchTodayQueue();
            else if (view === 'client-cal') fetchClientCalendar();
            else fetchMasterCalendar();
            if (detailItem?.item?.id === id) setDetailItem(null);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to mark as posted');
        } finally { setPostingId(null); }
    };

    const handleItemClick = async (item: ContentItem) => {
        try {
            const res = await postingApi.getContentDetails(item.id);
            setDetailItem(res.data);
        } catch (err) { console.error(err); }
    };

    const formatTime = (datetime: string) => {
        const d = parseISO(datetime);
        return { time: format(d, 'hh:mm'), ampm: format(d, 'a') };
    };

    // Calendar helpers
    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    });

    const queuePosts = queue.filter(i => i.content_type === 'Post').length;
    const queueReels = queue.filter(i => i.content_type === 'Reel').length;

    return (
        <>
            {/* Mobile Header */}
            <div className="mobile-header-top">
                <div className="menu-toggle">
                    <Menu size={24} />
                </div>
                <img src="/logo.png" alt="TrueUp Media" className="mobile-logo-img" />
                <div style={{ width: '40px' }}></div>
            </div>

            <header className="page-header">
                <div className="header-content">
                    <div className="header-info">
                        <h1 className="page-title">
                            {view === 'queue' && "Today's Posting Queue"}
                            {view === 'client-cal' && 'Client Calendar'}
                            {view === 'master-cal' && 'Master Calendar'}
                        </h1>
                        <p className="page-subtitle">
                            {view === 'queue' && `${format(new Date(), 'EEEE, MMMM d, yyyy')} — Items ready for publishing`}
                            {view === 'client-cal' && 'Content awaiting posting by client'}
                            {view === 'master-cal' && 'All content waiting for posting across clients'}
                        </p>
                    </div>
                    <div className="header-controls">
                        {/* View Toggle */}
                        <div className="view-mode-toggle">
                            <button
                                onClick={() => setView('queue')}
                                className={`view-mode-btn ${view === 'queue' ? 'active' : ''}`}
                                title="Today's Queue"
                            >
                                <ListChecks size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Queue
                            </button>
                            <button
                                onClick={() => setView('client-cal')}
                                className={`view-mode-btn ${view === 'client-cal' ? 'active' : ''}`}
                                title="Client Calendar"
                            >
                                <CalendarIcon size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Client
                            </button>
                            <button
                                onClick={() => setView('master-cal')}
                                className={`view-mode-btn ${view === 'master-cal' ? 'active' : ''}`}
                                title="Master Calendar"
                            >
                                <Globe size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Master
                            </button>
                        </div>

                        {/* Calendar Controls */}
                        {view === 'client-cal' && (
                            <div className="client-dropdown-wrapper">
                                <select
                                    className="client-dropdown"
                                    value={selectedClient}
                                    onChange={(e) => setSelectedClient(e.target.value)}
                                >
                                    <option value="" disabled>Select client</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.company_name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="dropdown-chevron" />
                            </div>
                        )}

                        {(view === 'client-cal' || view === 'master-cal') && (
                            <div className="month-nav">
                                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="month-btn"><ChevronLeft size={20} /></button>
                                <span className="month-label">{format(currentMonth, 'MMMM yyyy')}</span>
                                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="month-btn"><ChevronRight size={20} /></button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ─── TODAY'S QUEUE VIEW ─── */}
            {view === 'queue' && (
                <div>
                    {/* Stats Row */}
                    <div className="posting-stats-row">
                        <div className="posting-stat-card">
                            <div className="posting-stat-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent)' }}>
                                <Inbox size={22} />
                            </div>
                            <div className="posting-stat-info">
                                <h4>Total Queue</h4>
                                <p className="stat-number">{queue.length}</p>
                            </div>
                        </div>
                        <div className="posting-stat-card">
                            <div className="posting-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
                                <FileText size={22} />
                            </div>
                            <div className="posting-stat-info">
                                <h4>Posts</h4>
                                <p className="stat-number">{queuePosts}</p>
                            </div>
                        </div>
                        <div className="posting-stat-card">
                            <div className="posting-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>
                                <Video size={22} />
                            </div>
                            <div className="posting-stat-info">
                                <h4>Reels</h4>
                                <p className="stat-number">{queueReels}</p>
                            </div>
                        </div>
                    </div>

                    {/* Queue List */}
                    {loading ? (
                        <div className="posting-queue">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="queue-item" style={{ opacity: 1 }}>
                                    <div className="queue-item-left">
                                        <Skeleton className="h-14 w-20 rounded-xl" />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <Skeleton className="h-3 w-20" />
                                            <Skeleton className="h-5 w-40" />
                                        </div>
                                    </div>
                                    <div className="queue-item-right">
                                        <Skeleton className="h-6 w-14 rounded-lg" />
                                        <Skeleton className="h-10 w-36 rounded-xl" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : queue.length === 0 ? (
                        <div className="posting-empty-state">
                            <div className="empty-icon">
                                <CheckCircle2 size={36} />
                            </div>
                            <h3>All Clear!</h3>
                            <p>No posts are scheduled for today, or everything has already been posted. Check the calendars for upcoming items.</p>
                        </div>
                    ) : (
                        <div className="posting-queue">
                            {queue.map(item => {
                                const { time, ampm } = formatTime(item.scheduled_datetime);
                                const isPosting = postingId === item.id;
                                return (
                                    <div key={item.id} className="queue-item">
                                        <div className="queue-item-left" onClick={() => handleItemClick(item)} style={{ cursor: 'pointer' }}>
                                            <div className="queue-time-badge">
                                                <span className="time-text">{time}</span>
                                                <span className="ampm-text">{ampm}</span>
                                            </div>
                                            <div className="queue-item-info">
                                                <span className="queue-item-client">{item.clients?.company_name || 'Unknown'}</span>
                                                <span className="queue-item-title">{item.title}</span>
                                            </div>
                                        </div>
                                        <div className="queue-item-right">
                                            <span className={`queue-type-badge ${item.content_type.toLowerCase()}`}>
                                                {item.content_type === 'Post' ? <FileText size={12} /> : <Video size={12} />}
                                                {item.content_type}
                                            </span>
                                            <button
                                                className="btn-mark-posted"
                                                onClick={() => handleMarkPosted(item.id)}
                                                disabled={isPosting}
                                            >
                                                {isPosting ? (
                                                    <><div className="spinner-small"></div> Posting...</>
                                                ) : (
                                                    <><Send size={14} /> Mark as Posted</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── CALENDAR VIEWS ─── */}
            {(view === 'client-cal' || view === 'master-cal') && (
                <div className="calendar-card">
                    <div className="calendar-grid">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="calendar-header-cell">
                                <span className="desktop-day">{day}</span>
                                <span className="mobile-day">{day.charAt(0)}</span>
                            </div>
                        ))}

                        {loading ? (
                            Array.from({ length: 35 }).map((_, idx) => (
                                <div key={idx} className="calendar-day" style={{ minHeight: 110 }}>
                                    <Skeleton className="h-4 w-4 mb-2" />
                                    <Skeleton className="h-4 w-full rounded" />
                                </div>
                            ))
                        ) : (
                            days.map((day, idx) => {
                                const dayContent = calendarData.filter(item => {
                                    const itemDate = parseISO(item.scheduled_datetime);
                                    return isSameDay(itemDate, day);
                                });
                                return (
                                    <div
                                        key={idx}
                                        className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                        style={{ minHeight: 110 }}
                                    >
                                        <span className="day-number">{format(day, 'd')}</span>
                                        <div className="day-items desktop-only">
                                            {dayContent.map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => handleItemClick(item)}
                                                    className={`content-item ${item.content_type.toLowerCase()}`}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {item.content_type === 'Post' ? <FileText size={10} /> : <Video size={10} />}
                                                    <span className="truncate">
                                                        {view === 'master-cal' ? `[${item.clients?.company_name?.substring(0, 3)}] ` : ''}
                                                        {item.title}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Mobile dots */}
                                        {dayContent.length > 0 && (
                                            <div className="mobile-only" style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                                                {dayContent.map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleItemClick(item)}
                                                        style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            background: item.content_type === 'Post' ? 'var(--success)' : 'var(--warning)',
                                                            cursor: 'pointer'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ─── DETAIL MODAL ─── */}
            {detailItem && (
                <div className="posting-detail-overlay" onClick={() => setDetailItem(null)}>
                    <div className="posting-detail-card" onClick={e => e.stopPropagation()}>
                        <div className="posting-detail-header">
                            <h3 className="posting-detail-title">{detailItem.item.title}</h3>
                            <button className="posting-detail-close" onClick={() => setDetailItem(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="detail-field">
                            <div className="detail-label">Client</div>
                            <div className="detail-value">{detailItem.item.clients?.company_name || '—'}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="detail-field">
                                <div className="detail-label">Type</div>
                                <span className={`queue-type-badge ${detailItem.item.content_type.toLowerCase()}`}>
                                    {detailItem.item.content_type === 'Post' ? <FileText size={12} /> : <Video size={12} />}
                                    {detailItem.item.content_type}
                                </span>
                            </div>
                            <div className="detail-field">
                                <div className="detail-label">Scheduled</div>
                                <div className="detail-value">
                                    {format(parseISO(detailItem.item.scheduled_datetime), 'MMM d, yyyy h:mm a')}
                                </div>
                            </div>
                        </div>
                        <div className="detail-field">
                            <div className="detail-label">Status</div>
                            <div className="detail-value" style={{ color: 'var(--accent)' }}>{detailItem.item.status}</div>
                        </div>
                        {detailItem.item.description && (
                            <div className="detail-field">
                                <div className="detail-label">Description</div>
                                <div className="detail-value" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{detailItem.item.description}</div>
                            </div>
                        )}

                        {/* Mark as Posted action */}
                        {detailItem.item.status === 'WAITING FOR POSTING' && (
                            <button
                                className="btn-mark-posted"
                                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                                onClick={() => handleMarkPosted(detailItem.item.id)}
                                disabled={postingId === detailItem.item.id}
                            >
                                {postingId === detailItem.item.id ? (
                                    <><div className="spinner-small"></div> Posting...</>
                                ) : (
                                    <><Send size={14} /> Mark as Posted</>
                                )}
                            </button>
                        )}

                        {/* Status History */}
                        {detailItem.history?.length > 0 && (
                            <div className="history-timeline">
                                <div className="detail-label" style={{ marginBottom: 12 }}>Status History</div>
                                {detailItem.history.map((h: any, idx: number) => (
                                    <div key={idx} className="history-item">
                                        <div className="history-dot" style={{
                                            background: h.new_status === 'POSTED' ? 'var(--success)' : 'var(--accent)'
                                        }}></div>
                                        <div className="history-content">
                                            <div className="history-status">
                                                {h.old_status} → {h.new_status}
                                            </div>
                                            <div className="history-meta">
                                                {h.users?.name || 'System'} {h.users?.role_identifier ? `(${h.users.role_identifier})` : ''}
                                                {' • '}
                                                {format(parseISO(h.changed_at), 'MMM d, h:mm a')}
                                            </div>
                                            {h.note && (
                                                <div className="history-meta" style={{ fontStyle: 'italic', marginTop: 2 }}>
                                                    "{h.note}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="posting-toast">
                    <CheckCircle2 size={20} />
                    {toast}
                </div>
            )}
        </>
    );
}

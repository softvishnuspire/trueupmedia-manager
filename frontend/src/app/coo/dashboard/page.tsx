"use client";

import React, { useEffect, useState } from 'react';
import { cooApi, emergencyApi } from '@/lib/api';
import { Users, Calendar, Activity, ShieldAlert, FileText, Video, ArrowRight, ChevronDown, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { endOfWeek, format, isSameDay, parseISO, startOfWeek } from 'date-fns';

interface Stats {
    totalClients: number;
    totalItemsThisMonth: number;
    statusSummary: Record<string, number>;
}

export default function CooDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [calendarData, setCalendarData] = useState<any[]>([]);
    const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, percentage: 0, remaining: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [emergencyTasks, setEmergencyTasks] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('all');

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch clients if not already loaded
            if (clients.length === 0) {
                const clientsRes = await cooApi.getClients();
                setClients(clientsRes.data);
            }

            // Fetch master calendar for the current month to get throughput and status breakdown
            const calendarRes = await cooApi.getMasterCalendar(
                format(new Date(), 'yyyy-MM'),
                selectedClient === 'all' ? undefined : selectedClient
            );
            const data = calendarRes.data;
            setCalendarData(data);

            const breakdown = data.reduce((acc: any, item: any) => {
                acc[item.status] = (acc[item.status] || 0) + 1;
                return acc;
            }, {});

            // Calculate today's stats
            const today = new Date();
            const todayItems = data.filter((item: any) => isSameDay(parseISO(item.scheduled_datetime), today));
            const totalToday = todayItems.length;
            const completedToday = todayItems.filter((item: any) => item.status === 'POSTED').length;

            setTodayStats({
                total: totalToday,
                completed: completedToday,
                remaining: totalToday - completedToday,
                percentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0
            });

            // Update stats state
            if (selectedClient === 'all') {
                const statsRes = await cooApi.getStats();
                setStats({
                    ...statsRes.data,
                    statusSummary: breakdown,
                    totalItemsThisMonth: data.length
                });
            } else {
                setStats({
                    totalClients: clients.length,
                    totalItemsThisMonth: data.length,
                    statusSummary: breakdown
                });
            }

            const emergencyRes = await emergencyApi.getAll();
            setEmergencyTasks(emergencyRes.data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [selectedClient]);

    const monthTotal = stats?.totalItemsThisMonth || 0;
    const monthCompleted = (stats?.statusSummary?.POSTED || 0) as number;
    const monthPercentage = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekItems = calendarData.filter((item: any) => {
        const itemDate = parseISO(item.scheduled_datetime);
        return itemDate >= weekStart && itemDate <= weekEnd;
    });
    const weekTotal = weekItems.length;
    const weekCompleted = weekItems.filter((item: any) => (item.status || '').toUpperCase() === 'POSTED').length;
    const weekPercentage = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

    if (error) return <div className="error-message">{error}</div>;

    return (
        <div>
            <header className="page-header">
                <div>
                    <h1 className="page-title">COO Dashboard</h1>
                    <p className="page-subtitle">Monitoring overview of system activity and client pipelines</p>
                </div>
            </header>

            <div className="stats-grid" style={{ marginBottom: '32px' }}>
                {loading ? (
                    <>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="stat-card">
                                <Skeleton className="h-12 w-12 rounded-xl" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-8 w-12" />
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <div className="stat-card">
                            <div className="stat-icon-box">
                                <Users size={24} />
                            </div>
                            <div className="stat-info">
                                <h3>Total Clients</h3>
                                <p className="stat-value">{stats?.totalClients || 0}</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                                <Calendar size={24} />
                            </div>
                            <div className="stat-info">
                                <h3>Scheduled (Month)</h3>
                                <p className="stat-value">{stats?.totalItemsThisMonth || 0}</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                                <Activity size={24} />
                            </div>
                            <div className="stat-info">
                                <h3>Active Pipelines</h3>
                                <p className="stat-value">
                                    {Object.values(stats?.statusSummary || {}).reduce((a, b) => a + b, 0)}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="daily-stats-banner" style={{ marginTop: '24px' }}>
                <div className="progress-meter-card">
                    <div className="progress-top-row">
                        <div className="progress-main-info">
                            <h3 className="stat-label">Today&apos;s Progress</h3>
                        </div>
                        <div className="progress-values">
                            <span className="current">{todayStats.completed}</span>
                            <span className="separator">/</span>
                            <span className="total">{todayStats.total}</span>
                            <span className="unit">Tasks</span>
                        </div>
                    </div>
                    <div className="meter-labels">
                        <span className="percentage">{todayStats.percentage}% Done</span>
                    </div>
                </div>

                <div className="progress-meter-card">
                    <div className="progress-top-row">
                        <div className="progress-main-info">
                            <h3 className="stat-label">Week&apos;s Progress</h3>
                        </div>
                        <div className="progress-values">
                            <span className="current">{weekCompleted}</span>
                            <span className="separator">/</span>
                            <span className="total">{weekTotal}</span>
                            <span className="unit">Tasks</span>
                        </div>
                    </div>
                    <div className="meter-labels">
                        <span className="percentage">{weekPercentage}% Done</span>
                    </div>
                </div>

                <div className="progress-meter-card">
                    <div className="progress-top-row">
                        <div className="progress-main-info">
                            <h3 className="stat-label">Month&apos;s Progress</h3>
                        </div>
                        <div className="progress-values">
                            <span className="current">{monthCompleted}</span>
                            <span className="separator">/</span>
                            <span className="total">{monthTotal}</span>
                            <span className="unit">Tasks</span>
                        </div>
                    </div>
                    <div className="meter-labels">
                        <span className="percentage">{monthPercentage}% Done</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '32px' }}>
                <div className="dashboard-card" style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Production Pipeline</h3>
                        <span style={{ fontSize: '11px', background: 'var(--bg-elevated)', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, color: 'var(--accent)' }}>Live Status</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Total Tasks</p>
                            <p style={{ fontSize: '20px', fontWeight: 900 }}>{stats?.totalItemsThisMonth || 0}</p>
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <p style={{ fontSize: '10px', color: 'var(--success)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Completed</p>
                            <p style={{ fontSize: '20px', fontWeight: 900, color: 'var(--success)' }}>{stats?.statusSummary?.['POSTED'] || 0}</p>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            <p style={{ fontSize: '10px', color: 'var(--warning)', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Pending</p>
                            <p style={{ fontSize: '20px', fontWeight: 900, color: 'var(--warning)' }}>{(stats?.totalItemsThisMonth || 0) - (stats?.statusSummary?.['POSTED'] || 0)}</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(stats?.statusSummary || {}).map(([status, count]) => (
                            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>{status}</span>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{count}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ {stats?.totalItemsThisMonth || 0}</span>
                                </div>
                            </div>
                        ))}
                        {Object.keys(stats?.statusSummary || {}).length === 0 && (
                            <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No content items this month.</p>
                        )}
                    </div>
                </div>

                <div className="dashboard-card" style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Filter by Client</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Select a client to monitor their specific pipeline progress.</p>
                    </div>

                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                        <select
                            style={{ 
                                width: '100%', 
                                padding: '14px 40px 14px 16px', 
                                background: 'var(--bg-elevated)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '16px', 
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                                fontWeight: 600,
                                appearance: 'none',
                                cursor: 'pointer'
                            }}
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                        >
                            <option value="all">All Clients</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.company_name}</option>
                            ))}
                        </select>
                        <ChevronDown size={18} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>

                    <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '16px', borderRadius: '16px', border: '1px dashed var(--accent)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)', marginBottom: '8px' }}>
                            <Filter size={16} />
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>Filter Active</span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            Currently showing {selectedClient === 'all' ? 'aggregated data for all clients' : `data for ${clients.find(c => c.id === selectedClient)?.company_name}`}.
                        </p>
                    </div>
                </div>
            </div>


            {emergencyTasks.length > 0 && (
                <div className="emergency-panel" style={{ marginTop: '32px' }}>
                    <div className="emergency-panel-header">
                        <ShieldAlert size={24} color="#ef4444" />
                        <h2 className="emergency-panel-title">All Emergency Tasks</h2>
                    </div>
                    <div className="emergency-list">
                        {emergencyTasks.map((task: any) => (
                            <div key={task.id} className="emergency-card">
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
        </div>
    );
}

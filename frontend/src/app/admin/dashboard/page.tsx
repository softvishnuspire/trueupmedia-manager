"use client";

import React, { useEffect, useState } from 'react';
import { 
  Users, Calendar, Activity, ShieldAlert, FileText, Video, ArrowRight, 
  X, Clock, Undo2, Check, Edit2, Trash2, ChevronDown, Filter 
} from 'lucide-react';
import { adminApi, emergencyApi, gmApi, ContentItem, StatusHistoryItem } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { endOfWeek, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { createClient } from '@/utils/supabase/client';

interface Stats {
  totalClients: number;
  totalItemsThisMonth: number;
  statusSummary: Record<string, number>;
}

interface ContentDetails {
  item: ContentItem;
  history: StatusHistoryItem[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, percentage: 0, remaining: 0 });
  const [calendarData, setCalendarData] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emergencyTasks, setEmergencyTasks] = useState<ContentItem[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [activeItem, setActiveItem] = useState<ContentDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    time: '12:00',
    content_type: 'Post' as 'Post' | 'Reel'
  });
  
  const supabase = createClient();

  const fetchEmergencyTasks = async () => {
    try {
      const emergencyRes = await emergencyApi.getAll();
      setEmergencyTasks(emergencyRes.data);
    } catch (err) {
      console.error('Failed to load emergency tasks:', err instanceof Error ? err.message : String(err));
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch clients if not already loaded
      if (clients.length === 0) {
        const clientsRes = await adminApi.getClients();
        setClients(clientsRes.data);
      }

      // Fetch master calendar for the current month to get throughput and status breakdown
      const calendarRes = await adminApi.getMasterCalendar(
        format(new Date(), 'yyyy-MM'),
        selectedClient === 'all' ? undefined : selectedClient
      );
      const data = calendarRes.data;
      setCalendarData(data);

      const breakdown = data.reduce((acc: any, item: ContentItem) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});

      // Calculate today's stats
      const today = new Date();
      const todayItems = data.filter((item: ContentItem) => isSameDay(parseISO(item.scheduled_datetime), today));
      const totalToday = todayItems.length;
      const completedToday = todayItems.filter((item: ContentItem) => item.status === 'POSTED').length;
      
      setTodayStats({
        total: totalToday,
        completed: completedToday,
        remaining: totalToday - completedToday,
        percentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0
      });

      // Update stats state for the pipeline and summary
      if (selectedClient === 'all') {
        const statsRes = await adminApi.getStats();
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

      // Fetch all emergency tasks
      await fetchEmergencyTasks();

    } catch (err) {
      console.error('Failed to load dashboard data:', err instanceof Error ? err.message : String(err));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedClient]);

  const handleTaskClick = async (taskId: string) => {
    try {
      const res = await adminApi.getContentDetails(taskId);
      setActiveItem(res.data);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!activeItem) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await gmApi.updateStatus(activeItem.item.id, newStatus, statusNote, user?.id);
      
      // Refresh details
      const res = await adminApi.getContentDetails(activeItem.item.id);
      setActiveItem(res.data);
      setStatusNote('');
      fetchDashboardData(); // Refresh the whole dashboard to update stats
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert(String(err));
    }
  };

  const handleUndoStatus = async () => {
    if (!activeItem) return;
    if (!window.confirm('Are you sure you want to undo the last status change?')) return;
    try {
      await adminApi.undoStatus(activeItem.item.id);
      const res = await adminApi.getContentDetails(activeItem.item.id);
      setActiveItem(res.data);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Failed to undo status change.');
    }
  };

  const handleToggleEmergency = async () => {
    if (!activeItem) return;
    try {
      const res = await emergencyApi.toggle(activeItem.item.id) as { data: { success: boolean } };
      if (res.data.success) {
        const detailsRes = await adminApi.getContentDetails(activeItem.item.id);
        setActiveItem(detailsRes.data);
        fetchEmergencyTasks();
      }
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert(String(err));
    }
  };

  const handleSaveEdit = async () => {
    if (!activeItem) return;
    try {
      const scheduled_datetime = `${format(parseISO(activeItem.item.scheduled_datetime), 'yyyy-MM-dd')}T${formData.time}:00`;
      
      await adminApi.updateContent(activeItem.item.id, {
        title: formData.title,
        description: formData.description,
        content_type: formData.content_type,
        scheduled_datetime
      });
      
      const res = await adminApi.getContentDetails(activeItem.item.id);
      setActiveItem(res.data);
      setIsRescheduling(false);
      fetchDashboardData();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert(String(err));
    }
  };

  const monthTotal = stats?.totalItemsThisMonth || 0;
  const monthCompleted = (stats?.statusSummary?.POSTED || 0) as number;
  const monthPercentage = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekItems = calendarData.filter((item) => {
    const itemDate = parseISO(item.scheduled_datetime);
    return itemDate >= weekStart && itemDate <= weekEnd;
  });
  const weekTotal = weekItems.length;
  const weekCompleted = weekItems.filter((item) => (item.status || '').toUpperCase() === 'POSTED').length;
  const weekPercentage = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  return (
    <div className="dashboard-view">
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Overview of system activity and client pipelines</p>
        </div>
      </header>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: '14px' }}>Error: {error}</p>
          <button onClick={() => setError(null)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

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
              <div className="stat-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent)' }}>
                <Users size={28} />
              </div>
              <div className="stat-info">
                <h3>Total Clients</h3>
                <p className="stat-value">{stats?.totalClients || 0}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                <Calendar size={28} />
              </div>
              <div className="stat-info">
                <h3>Scheduled (Month)</h3>
                <p className="stat-value">{stats?.totalItemsThisMonth || 0}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                <Activity size={28} />
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
            {emergencyTasks.map((task: ContentItem) => (
              <div
                key={task.id}
                className="emergency-card"
                onClick={() => handleTaskClick(task.id)}
              >
                <div className="emergency-card-icon">
                  {task.content_type === 'Post' ? <FileText size={20} /> : <Video size={20} />}
                </div>
                <div className="emergency-card-body">
                  <div className="emergency-card-client">{task.clients?.company_name?.toUpperCase()}</div>
                  <div className="emergency-card-details">
                    <span className="type">{task.content_type}</span>
                    <span className="dot">•</span>
                    <span className="time">{format(parseISO(task.scheduled_datetime), 'h:mm a')}</span>
                  </div>
                </div>
                <div className="emergency-card-arrow">
                  <ArrowRight size={18} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {isModalOpen && activeItem && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content detail-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div className="detail-header-info">
                <span className={`type-badge ${activeItem.item.content_type.toLowerCase()}`}>
                  {activeItem.item.content_type}
                </span>
                <span className="dot">•</span>
                <span className="client-name">{activeItem.item.clients?.company_name}</span>
              </div>
              <div className="modal-actions">
                <button className="action-icon-btn edit" onClick={() => {
                  setFormData({
                    title: activeItem.item.title,
                    description: activeItem.item.description || '',
                    time: format(parseISO(activeItem.item.scheduled_datetime), 'HH:mm'),
                    content_type: activeItem.item.content_type
                  });
                  setIsRescheduling(true);
                }}>
                  <Edit2 size={18} />
                </button>
                <button className="action-icon-btn delete" onClick={() => {
                  if(confirm('Delete this task permanently?')) {
                    adminApi.deleteContent(activeItem.item.id).then(() => {
                      setIsModalOpen(false);
                      fetchDashboardData();
                    });
                  }
                }}>
                  <Trash2 size={18} />
                </button>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="detail-body">
              <h2 className="detail-title">{activeItem.item.title}</h2>
              {activeItem.item.description && (
                <p className="detail-description">{activeItem.item.description}</p>
              )}

              <div className="detail-grid">
                <div className="detail-section">
                  <label className="detail-label">Schedule Info</label>
                  <div className="info-card">
                    <div className="info-item">
                      <Calendar size={16} />
                      <span>{format(parseISO(activeItem.item.scheduled_datetime), 'MMMM do, yyyy')}</span>
                    </div>
                    <div className="info-item">
                      <Clock size={16} />
                      <span>{format(parseISO(activeItem.item.scheduled_datetime), 'h:mm a')}</span>
                    </div>
                    <div className="emergency-toggle-row" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldAlert size={16} color={activeItem.item.is_emergency ? '#ef4444' : 'var(--text-muted)'} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: activeItem.item.is_emergency ? '#ef4444' : 'var(--text-muted)' }}>Emergency Priority</span>
                        </div>
                        <button 
                            onClick={handleToggleEmergency}
                            style={{
                                width: '42px',
                                height: '22px',
                                borderRadius: '11px',
                                background: activeItem.item.is_emergency ? '#ef4444' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${activeItem.item.is_emergency ? '#ef4444' : 'var(--border)'}`,
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: activeItem.item.is_emergency ? 'white' : 'var(--text-muted)',
                                position: 'absolute',
                                top: '1px',
                                left: activeItem.item.is_emergency ? '21px' : '1px',
                                transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                            }}></div>
                        </button>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <label className="detail-label">Workflow Status</label>
                  <div className="info-card" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="status-current">
                      <p className="status-label">CURRENT</p>
                      <p className="status-value" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{activeItem.item.status}</p>
                    </div>

                    {(() => {
                      const flows: Record<string, string[]> = {
                        'Reel': ['CONTENT READY', 'SHOOT DONE', 'EDITING IN PROGRESS', 'EDITED', 'WAITING FOR APPROVAL', 'APPROVED', 'WAITING FOR POSTING', 'POSTED'],
                        'Post': ['CONTENT APPROVED', 'DESIGNING IN PROGRESS', 'DESIGNING COMPLETED', 'WAITING FOR APPROVAL', 'APPROVED', 'WAITING FOR POSTING', 'POSTED']
                      };
                      const flow = flows[activeItem.item.content_type] || [];
                      const currentIndex = flow.indexOf(activeItem.item.status);
                      const nextStatus = flow[currentIndex + 1];

                      if (nextStatus && activeItem.item.status !== 'WAITING FOR POSTING') {
                        return (
                          <div className="advance-section" style={{ marginTop: '16px' }}>
                            <textarea
                              placeholder="Add a note..."
                              value={statusNote}
                              onChange={(e) => setStatusNote(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                marginBottom: '10px',
                                resize: 'none'
                              }}
                              rows={2}
                            />
                            <button
                              onClick={() => handleStatusUpdate(nextStatus)}
                              className="btn-primary"
                              style={{ padding: '10px' }}
                            >
                              Advance to {nextStatus}
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {activeItem.item.status === 'WAITING FOR POSTING' && (
                        <div className="workflow-waiting-posting" style={{ 
                            marginTop: '16px', 
                            padding: '16px', 
                            background: 'rgba(59, 130, 246, 0.05)', 
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            color: '#3b82f6', 
                            borderRadius: '12px', 
                            fontSize: '13px', 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center', 
                            textAlign: 'center',
                            gap: '8px' 
                        }}>
                            <Clock size={20} />
                            <div style={{ fontWeight: 700 }}>Waiting for Posting Team</div>
                            <div style={{ opacity: 0.8, fontSize: '12px' }}>This item has been sent to the posting team queue. They will mark it as posted once published.</div>
                        </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="activity-log" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="detail-label" style={{ marginBottom: 0 }}>Activity Log</label>
                  {activeItem.history.length > 0 && (
                    <button 
                      onClick={handleUndoStatus}
                      className="undo-btn"
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', 
                        background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', 
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer' 
                      }}
                    >
                      <Undo2 size={14} />
                      Undo Last Step
                    </button>
                  )}
                </div>
                <div className="timeline-container">
                  <div className="timeline-line"></div>
                  {(() => {
                    const flows: Record<string, string[]> = {
                      'Reel': [
                        'CONTENT READY', 'SHOOT DONE', 'EDITING IN PROGRESS', 'EDITED',
                        'WAITING FOR APPROVAL', 'APPROVED', 'WAITING FOR POSTING', 'POSTED'
                      ],
                      'Post': [
                        'CONTENT APPROVED', 'DESIGNING IN PROGRESS', 'DESIGNING COMPLETED',
                        'WAITING FOR APPROVAL', 'APPROVED', 'WAITING FOR POSTING', 'POSTED'
                      ]
                    };
                    const flow = flows[activeItem.item.content_type] || [];
                    const currentIdx = flow.indexOf(activeItem.item.status);

                    return flow.map((status: string, idx: number) => {
                      const isCompleted = idx < currentIdx || activeItem.item.status === 'POSTED';
                      const isCurrent = idx === currentIdx && activeItem.item.status !== 'POSTED';
                      const historyEntry = activeItem.history.find((h: StatusHistoryItem) => h.new_status === status);

                      return (
                        <div key={status} className={`timeline-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                          <div className="step-indicator">
                            {isCompleted ? <Check size={14} /> : isCurrent ? <div className="current-dot" /> : null}
                          </div>
                          <div className="step-content">
                            <span className="step-title">{status}</span>
                            {historyEntry && (
                              <div className="step-meta">
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span className="step-user">{historyEntry.users?.role_identifier || historyEntry.users?.name || 'System'}</span>
                                  <span className="step-time">{format(parseISO(historyEntry.changed_at), 'MMM d, HH:mm')}</span>
                                </div>
                                {historyEntry.note && <p className="step-note">&quot;{historyEntry.note}&quot;</p>}
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

      {/* Edit Modal */}
      {isRescheduling && (
        <div className="modal-overlay" style={{ zIndex: 4000 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Edit Content</h3>
              <button onClick={() => setIsRescheduling(false)} className="modal-close"><X size={20} /></button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-input"
                    value={formData.content_type}
                    onChange={(e) => setFormData({ ...formData, content_type: e.target.value as 'Post' | 'Reel' })}
                  >
                    <option value="Post">Post</option>
                    <option value="Reel">Reel</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setIsRescheduling(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveEdit}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

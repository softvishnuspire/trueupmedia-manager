"use client";

import React, { useEffect, useState } from 'react';
import { 
  Users, Calendar, Activity, ShieldAlert, FileText, Video, ArrowRight, 
  X, Clock, Undo2, Check, Edit2, Trash2 
} from 'lucide-react';
import { adminApi, emergencyApi, gmApi, ContentItem, StatusHistoryItem } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSameDay, parseISO } from 'date-fns';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emergencyTasks, setEmergencyTasks] = useState<ContentItem[]>([]);
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await adminApi.getStats();
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load stats:', err instanceof Error ? err.message : String(err));
        setError(err instanceof Error ? err.message : String(err));
      }

      // Fetch master calendar separately so stats still show if this fails
      try {
        const calendarRes = await adminApi.getMasterCalendar(format(new Date(), 'yyyy-MM'));
        const data = calendarRes.data;
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

        // Fetch all emergency tasks
        await fetchEmergencyTasks();

      } catch (err) {
        console.error('Failed to load calendar:', err instanceof Error ? err.message : String(err));
      }

      setLoading(false);
    };
    fetchStats();
  }, []);

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
      // Admin uses adminApi for status updates if available, else we can use gmApi or similar
      // For now let's assume adminApi has what we need or we can add it to api.ts if missing
      // Actually let's use the patch endpoint directly if we can
      await gmApi.updateStatus(activeItem.item.id, newStatus, statusNote, user?.id);
      
      // Refresh details
      const res = await adminApi.getContentDetails(activeItem.item.id);
      setActiveItem(res.data);
      setStatusNote('');
      fetchEmergencyTasks();
      fetchEmergencyTasks();
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
      fetchEmergencyTasks();
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
      fetchEmergencyTasks();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert(String(err));
    }
  };

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

      <div className="daily-stats-banner">
        <div className="progress-meter-card">
          <div className="progress-main-info">
            <h3 className="stat-label">Today&apos;s Progress</h3>
            <div className="progress-values">
              <span className="current">{todayStats.completed}</span>
              <span className="separator">/</span>
              <span className="total">{todayStats.total}</span>
              <span className="unit">Tasks Posted</span>
            </div>
          </div>
          <div className="meter-visual">
            <div className="meter-bar">
              <div className="meter-fill" style={{ width: `${todayStats.percentage}%` }}>
                <div className="meter-glow"></div>
              </div>
            </div>
            <div className="meter-labels">
              <span className="percentage">{todayStats.percentage}% Done</span>
              <span className="remaining">{todayStats.remaining} remaining today</span>
            </div>
          </div>
        </div>
      </div>

      {emergencyTasks.length > 0 && (
        <div className="emergency-panel">
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
                  <div className="emergency-card-client">{task.clients?.company_name.toUpperCase()}</div>
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

      <div className="stats-grid">
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

      <div style={{ margin: '48px 0 24px 0' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Pipeline Distribution</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Current status of all content items across the platform</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </>
        ) : (
          <>
            {Object.entries(stats?.statusSummary || {}).map(([status, count]) => {
              return (
                <div key={status} style={{ 
                  background: 'var(--bg-surface)', 
                  padding: '24px', 
                  borderRadius: '20px', 
                  border: '1px solid var(--border)', 
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="type-badge post" style={{ fontSize: '11px', fontWeight: 800 }}>{status}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 900, fontSize: '24px', color: 'var(--accent)', textShadow: '0 0 15px var(--accent-glow)' }}>{count}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700 }}> / {stats?.totalItemsThisMonth || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {Object.keys(stats?.statusSummary || {}).length === 0 && (
              <div style={{ 
                background: 'var(--bg-surface)', 
                padding: '60px', 
                borderRadius: '20px', 
                border: '1px dashed var(--border)',
                gridColumn: '1 / -1',
                textAlign: 'center'
              }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>No active content items found for this month.</p>
              </div>
            )}
          </>
        )}
      </div>

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
                      fetchEmergencyTasks();
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

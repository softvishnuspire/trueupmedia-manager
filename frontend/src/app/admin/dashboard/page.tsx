"use client";

import React, { useEffect, useState } from 'react';
import { adminApi, emergencyApi } from '@/lib/api';
import { Users, Calendar, Activity, ShieldAlert, FileText, Video, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isSameDay, parseISO } from 'date-fns';

interface Stats {
  totalClients: number;
  totalItemsThisMonth: number;
  statusSummary: Record<string, number>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayStats, setTodayStats] = useState({ total: 0, completed: 0, percentage: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emergencyTasks, setEmergencyTasks] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await adminApi.getStats();
        setStats(res.data);
        
        // Fetch master calendar for today's stats
        const calendarRes = await adminApi.getMasterCalendar(format(new Date(), 'yyyy-MM'));
        const data = calendarRes.data;
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

        // Fetch all emergency tasks
        const emergencyRes = await emergencyApi.getAll();
        setEmergencyTasks(emergencyRes.data);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (error) return <div className="error-message">{error}</div>;

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Overview of system activity and client pipelines</p>
        </div>
      </header>

      <div className="daily-stats-banner">
        <div className="progress-meter-card">
          <div className="progress-info">
            <h3 className="stat-label">Today's Progress</h3>
            <div className="progress-values">
              <span className="current">{todayStats.completed}</span>
              <span className="separator">/</span>
              <span className="total">{todayStats.total}</span>
              <span className="unit"> Tasks Posted</span>
            </div>
          </div>
          <div className="meter-container">
            <div className="meter-bar">
              <div className="meter-fill" style={{ width: `${todayStats.percentage}%` }}>
                <div className="meter-glow"></div>
              </div>
            </div>
            <div className="meter-label">
              <span className="percentage">{todayStats.percentage}% Done</span>
              <span className="remaining">{todayStats.remaining} remaining</span>
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
            {emergencyTasks.map((task: any) => (
              <div
                key={task.id}
                className="emergency-card"
                onClick={() => {
                  // Admin dashboard doesn't have an item detail modal on this page
                  // Usually we'd redirect or show a modal, but for now just highlight
                }}
              >
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

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Pipeline Distribution</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Current status of all content items across the platform</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </>
        ) : (
          <>
            {Object.entries(stats?.statusSummary || {}).map(([status, count]) => (
              <div key={status} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="type-badge post">{status}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--accent)' }}>{count}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700 }}> / {stats?.totalItemsThisMonth || 0}</span>
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(stats?.statusSummary || {}).length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                No active content items found for this month.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

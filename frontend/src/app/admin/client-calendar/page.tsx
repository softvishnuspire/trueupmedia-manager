"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, Client } from '@/lib/api';
import { Search, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

export default function ClientCalendarsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await adminApi.getClients();
        setClients(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c => 
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Client Calendars</h1>
            <p className="page-subtitle">Access and manage individual content schedules for each client</p>
          </div>
        </div>
      </header>

      <div className="table-header" style={{ background: 'var(--bg-surface)', borderRadius: '16px 16px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '24px' }}>
        <div className="search-input-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-card" style={{ borderRadius: '0 0 16px 16px' }}>
        {loading ? (
          <div className="loading-bar">Loading client list...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', padding: '20px' }}>
            {filteredClients.map((client) => (
              <Link 
                key={client.id} 
                href={`/admin/client-calendar/${client.id}`}
                className="stat-card" 
                style={{ textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              >
                <div className="stat-icon-box" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)' }}>
                  <CalendarIcon size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>{client.company_name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{client.email || 'No email provided'}</p>
                </div>
                <ChevronRight size={20} style={{ color: 'var(--text-muted)' }} />
              </Link>
            ))}
            {filteredClients.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No clients found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

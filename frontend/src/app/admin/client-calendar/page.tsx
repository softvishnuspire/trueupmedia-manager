"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Search, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

interface Client {
  id: string;
  company_name: string;
  email: string;
}

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
        <div>
          <h1 className="page-title">Client Calendars</h1>
          <p className="page-subtitle">Access and manage individual content schedules for each client</p>
        </div>
      </header>

      <div className="table-header" style={{ background: 'white', borderRadius: '16px 16px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none', padding: '24px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', padding: '24px' }}>
            {filteredClients.map((client) => (
              <Link 
                key={client.id} 
                href={`/admin/client-calendar/${client.id}`}
                className="stat-card" 
                style={{ textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              >
                <div className="stat-icon-box" style={{ background: '#eef2ff', color: '#4f46e5' }}>
                  <CalendarIcon size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>{client.company_name}</h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>{client.email || 'No email provided'}</p>
                </div>
                <ChevronRight size={20} style={{ color: '#cbd5e1' }} />
              </Link>
            ))}
            {filteredClients.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                No clients found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

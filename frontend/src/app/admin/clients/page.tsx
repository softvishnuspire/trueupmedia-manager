"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Plus, Search, Edit2, Trash2, X, Calendar as CalendarIcon } from 'lucide-react';

interface Client {
  id: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  created_at: string;
}

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState({
    company_name: '',
    phone: '',
    email: '',
    address: '',
  });

  const fetchClients = async () => {
    try {
      const res = await adminApi.getClients();
      setClients(res.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAddClick = () => {
    setEditingClient(null);
    setFormData({ company_name: '', phone: '', email: '', address: '' });
    setShowModal(true);
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setFormData({
      company_name: client.company_name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
    });
    setShowModal(true);
  };

  const handleDeleteClick = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name}? This will delete all associated calendar data.`)) {
      try {
        await adminApi.deleteClient(id);
        fetchClients();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await adminApi.updateClient(editingClient.id, formData);
      } else {
        await adminApi.addClient(formData);
      }
      setShowModal(false);
      fetchClients();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const filteredClients = clients.filter(c => 
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Client Management</h1>
          <p className="page-subtitle">Onboard and manage TrueUp Media client companies</p>
        </div>
        <button className="btn-add" onClick={handleAddClick}>
          <Plus size={18} />
          Add New Client
        </button>
      </header>

      <div className="table-card">
        <div className="table-header">
          <div className="search-input-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search clients by name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-bar">Loading clients...</div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Address</th>
                <th>Date Added</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id}>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{client.company_name}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.email || '-'}</td>
                  <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.address || '-'}</td>
                  <td>{new Date(client.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                      <Link href={`/admin/client-calendar/${client.id}`} className="btn-icon">
                        <CalendarIcon size={14} />
                      </Link>
                      <button className="btn-icon" onClick={() => handleEditClick(client)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-icon delete" onClick={() => handleDeleteClick(client.id, client.company_name)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No clients found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
              <button onClick={() => setShowModal(false)} className="modal-close"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  placeholder="Enter legal company name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="client@company.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Physical Address</label>
                <textarea 
                  className="form-input" 
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Office address, city, country"
                  style={{ resize: 'none' }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                  {editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { notificationApi } from '@/lib/api';

interface Props {
    onClose: () => void;
    userRole: string | null;
    onSuccess: () => void;
}

export default function SendNotificationModal({ onClose, userRole, onSuccess }: Props) {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'INFO' | 'WARNING' | 'URGENT'>('INFO');
    
    const isAdmin = userRole === 'admin';
    const [targetType, setTargetType] = useState<'ALL' | 'ROLE' | 'ROLE_IDENTIFIER'>(isAdmin ? 'ALL' : 'ROLE');
    const [targetRole, setTargetRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // If GM defaults to ROLE, set it automatically if it was ALL
        let finalTargetType = targetType;
        if (!isAdmin && targetType === 'ALL') {
            finalTargetType = 'ROLE'; // fallback to prevent errors
        }

        try {
            await notificationApi.sendNotification({
                title,
                message,
                type,
                target: {
                    type: finalTargetType,
                    value: targetRole || undefined
                }
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send notification');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'var(--bg-surface)',
                width: '100%',
                maxWidth: '500px',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Send Notification</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {error && (
                        <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '14px' }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>Title</label>
                        <input 
                            type="text" 
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                            placeholder="Notification title..."
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>Message</label>
                        <textarea 
                            required
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', resize: 'vertical', minHeight: '80px' }}
                            placeholder="What do you want to say?"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>Priority/Type</label>
                            <select 
                                value={type} 
                                onChange={e => setType(e.target.value as 'INFO' | 'WARNING' | 'URGENT')}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                            >
                                <option value="INFO">Info (Blue)</option>
                                <option value="WARNING">Warning (Orange)</option>
                                <option value="URGENT">Urgent (Red)</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>Target Group</label>
                            <select 
                                value={targetType} 
                                onChange={e => {
                                    setTargetType(e.target.value as 'ALL' | 'ROLE' | 'ROLE_IDENTIFIER');
                                    if (e.target.value !== 'ROLE') setTargetRole('');
                                }}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                            >
                                {isAdmin && <option value="ALL">All Users</option>}
                                <option value="ROLE">Specific Role</option>
                            </select>
                        </div>
                    </div>

                    {targetType === 'ROLE' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>Select Role</label>
                            <select 
                                required
                                value={targetRole} 
                                onChange={e => setTargetRole(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                            >
                                <option value="" disabled>Choose a role...</option>
                                {isAdmin && <option value="Admin">Admin</option>}
                                {isAdmin && <option value="GM">General Manager</option>}
                                {isAdmin && <option value="COO">COO</option>}
                                <option value="TEAM LEAD">Team Leads</option>
                                <option value="POSTING_TEAM">Posting Team</option>
                            </select>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button 
                            type="button" 
                            onClick={onClose}
                            style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            style={{ 
                                padding: '10px 16px', 
                                background: 'var(--accent)', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '8px', 
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            <Send size={16} /> {loading ? 'Sending...' : 'Send Notification'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

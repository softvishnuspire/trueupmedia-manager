import axios from 'axios';
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://trueupmedia-manager.onrender.com';

const api = axios.create({
    baseURL: `${API_BASE_URL}/api/gm`,
});

api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export interface Client {
    id: string;
    company_name: string;
    phone?: string;
    email?: string;
    address?: string;
    is_active?: boolean;
    posts_per_month?: number;
    reels_per_month?: number;
    created_at: string;
}

export interface ContentItem {
    id: string;
    title: string;
    description: string;
    content_type: 'Post' | 'Reel';
    scheduled_datetime: string;
    status: string;
    client_id: string;
    is_rescheduled?: boolean;
    is_emergency?: boolean;
    emergency_marked_at?: string;
    clients?: { company_name: string };
}

export interface StatusHistoryItem {
    [key: string]: unknown;
}

export const gmApi = {
    getClients: () => api.get<Client[]>('/clients'),
    getCalendar: (clientId: string, month: string) => api.get(`/calendar?client_id=${clientId}&month=${month}`),
    getMasterCalendar: (month: string, clientId?: string, contentType?: string) =>
        api.get<ContentItem[]>(`/master-calendar?month=${month}${clientId ? `&client_id=${clientId}` : ''}${contentType ? `&content_type=${contentType}` : ''}`),
    getContentDetails: (id: string) => api.get<{ item: ContentItem, history: StatusHistoryItem[] }>(`/content/${id}`),
    addContent: (data: Partial<ContentItem>) => api.post('/content', data),
    updateContent: (id: string, data: Partial<ContentItem>) => api.put(`/content/${id}`, data),
    deleteContent: (id: string) => api.delete(`/content/${id}`),
    updateStatus: (id: string, new_status: string, note?: string, changed_by?: string) =>
        api.patch(`/content/${id}/status`, { new_status, note, changed_by }),
    getTeamLeads: () => api.get('/team-leads'),
    assignClient: (clientId: string, teamLeadId: string) => api.patch(`/clients/${clientId}/assign`, { team_lead_id: teamLeadId }),
    getTeamLeadClients: (teamLeadId: string) => api.get(`/team-leads/${teamLeadId}/clients`),
    undoStatus: (contentId: string) => api.post(`/content/${contentId}/undo-status`),
};

const adminBase = axios.create({
    baseURL: `${API_BASE_URL}/api/admin`,
});

adminBase.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export interface TeamMember {
    user_id: string; // The primary key from Supabase 'users' table
    id?: string;     // Legacy/fallback
    name: string;
    email: string;
    role: string;
    role_identifier?: string;
    created_at: string;
}

export const adminApi = {
    getClients: () => adminBase.get<Client[]>('/clients'),
    addClient: (data: Partial<Client>) => adminBase.post('/clients', data),
    updateClient: (id: string, data: Partial<Client>) => adminBase.put(`/clients/${id}`, data),
    deleteClient: (id: string) => adminBase.delete(`/clients/${id}`),
    getStats: () => adminBase.get('/stats'),
    getTeam: () => adminBase.get<TeamMember[]>('/team'),
    addTeamMember: (data: Partial<TeamMember>) => adminBase.post('/team', data),
    updateTeamMember: (id: string, data: Record<string, unknown>) => adminBase.put(`/team/${id}`, data),
    deleteTeamMember: (id: string) => adminBase.delete(`/team/${id}`),
    getMasterCalendar: (month: string) =>
        api.get<ContentItem[]>(`/master-calendar?month=${month}`),
};

const tlBase = axios.create({
    baseURL: `${API_BASE_URL}/api/tl`,
});

tlBase.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export const tlApi = {
    getClients: (tlId: string) => tlBase.get<Client[]>(`/clients?tlId=${tlId}`),
    getCalendar: (clientId: string, month: string, tlId: string) => tlBase.get(`/calendar?client_id=${clientId}&month=${month}&tlId=${tlId}`),
    getMasterCalendar: (month: string, tlId: string, contentType?: string) =>
        tlBase.get<ContentItem[]>(`/master-calendar?month=${month}&tlId=${tlId}${contentType ? `&content_type=${contentType}` : ''}`),
};

// ─── Posting Team API ───
const postingBase = axios.create({
    baseURL: `${API_BASE_URL}/api/posting`,
});

postingBase.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export const postingApi = {
    getToday: () => postingBase.get<ContentItem[]>('/today'),
    getClients: () => postingBase.get<Client[]>('/clients'),
    getCalendar: (clientId: string, month: string) =>
        postingBase.get<ContentItem[]>(`/calendar?client_id=${clientId}&month=${month}`),
    getMasterCalendar: (month: string, clientId?: string) =>
        postingBase.get<ContentItem[]>(`/master-calendar?month=${month}${clientId ? `&client_id=${clientId}` : ''}`),
    getContentDetails: (id: string) =>
        postingBase.get<{ item: ContentItem; history: StatusHistoryItem[] }>(`/content/${id}`),
    markAsPosted: (id: string, changedBy?: string) =>
        postingBase.patch(`/content/${id}/post`, { changed_by: changedBy }),
};

const notificationBase = axios.create({
    baseURL: `${API_BASE_URL}/api/notifications`,
});

notificationBase.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export interface NotificationItem {
    id: string;
    is_read: boolean;
    read_at: string | null;
    notification_id: string;
    notifications: {
        title: string;
        message: string;
        type: 'INFO' | 'WARNING' | 'URGENT';
        created_at: string;
        sender_id: string;
    };
}

export interface NotificationTarget {
    type: 'ALL' | 'ROLE' | 'ROLE_IDENTIFIER' | 'USER';
    value?: string;
}

export const notificationApi = {
    getNotifications: () => notificationBase.get<NotificationItem[]>('/'),
    getUnreadCount: () => notificationBase.get<{ count: number }>('/unread-count'),
    markAsRead: (notificationId: string) => notificationBase.patch(`/${notificationId}/read`),
    sendNotification: (payload: {
        title: string;
        message: string;
        type: 'INFO' | 'WARNING' | 'URGENT';
        target: NotificationTarget;
    }) => notificationBase.post('/send', payload),
};

// ─── Emergency Tasks API ───
const emergencyBase = axios.create({
    baseURL: `${API_BASE_URL}/api/emergency`,
});

emergencyBase.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export const emergencyApi = {
    getToday: () => emergencyBase.get<ContentItem[]>('/today'),
    getAll: () => emergencyBase.get<ContentItem[]>('/all'),
    getMonth: (month: string) => emergencyBase.get<ContentItem[]>(`/month?month=${month}`),
    toggle: (id: string) => emergencyBase.post(`/${id}/toggle`),
};

export default api;

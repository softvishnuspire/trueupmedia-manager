import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://trueupmedia-manager.onrender.com';

const api = axios.create({
    baseURL: `${API_BASE_URL}/api/gm`,
});

export interface Client {
    id: string;
    company_name: string;
    phone?: string;
    email?: string;
    address?: string;
    is_active?: boolean;
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
    clients?: { company_name: string };
}

export const gmApi = {
    getClients: () => api.get<Client[]>('/clients'),
    getCalendar: (clientId: string, month: string) => api.get(`/calendar?client_id=${clientId}&month=${month}`),
    getMasterCalendar: (month: string, clientId?: string, contentType?: string) =>
        api.get<ContentItem[]>(`/master-calendar?month=${month}${clientId ? `&client_id=${clientId}` : ''}${contentType ? `&content_type=${contentType}` : ''}`),
    getContentDetails: (id: string) => api.get<{ item: ContentItem, history: any[] }>(`/content/${id}`),
    addContent: (data: Partial<ContentItem>) => api.post('/content', data),
    updateContent: (id: string, data: Partial<ContentItem>) => api.put(`/content/${id}`, data),
    deleteContent: (id: string) => api.delete(`/content/${id}`),
    updateStatus: (id: string, new_status: string, note?: string, changed_by?: string) =>
        api.patch(`/content/${id}/status`, { new_status, note, changed_by }),
    getTeamLeads: () => api.get('/team-leads'),
    assignClient: (clientId: string, teamLeadId: string) => api.patch(`/clients/${clientId}/assign`, { team_lead_id: teamLeadId }),
    getTeamLeadClients: (teamLeadId: string) => api.get(`/team-leads/${teamLeadId}/clients`),
};

const adminBase = axios.create({
    baseURL: `${API_BASE_URL}/api/admin`,
});

export interface TeamMember {
    id: string;
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
    updateTeamMember: (id: string, data: any) => adminBase.put(`/team/${id}`, data),
    deleteTeamMember: (id: string) => adminBase.delete(`/team/${id}`),
};

const tlBase = axios.create({
    baseURL: `${API_BASE_URL}/api/tl`,
});

export const tlApi = {
    getClients: (tlId: string) => tlBase.get<Client[]>(`/clients?tlId=${tlId}`),
    getCalendar: (clientId: string, month: string, tlId: string) => tlBase.get(`/calendar?client_id=${clientId}&month=${month}&tlId=${tlId}`),
    getMasterCalendar: (month: string, tlId: string, contentType?: string) =>
        tlBase.get<ContentItem[]>(`/master-calendar?month=${month}&tlId=${tlId}${contentType ? `&content_type=${contentType}` : ''}`),
};

export default api;

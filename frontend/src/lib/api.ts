import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api/gm',
});

export const gmApi = {
    getClients: () => api.get('/clients'),
    getCalendar: (clientId: string, month: string) => api.get(`/calendar?client_id=${clientId}&month=${month}`),
    getMasterCalendar: (month: string, clientId?: string, contentType?: string) => 
        api.get(`/master-calendar?month=${month}${clientId ? `&client_id=${clientId}` : ''}${contentType ? `&content_type=${contentType}` : ''}`),
    getContentDetails: (id: string) => api.get(`/content/${id}`),
    addContent: (data: any) => api.post('/content', data),
    updateContent: (id: string, data: any) => api.put(`/content/${id}`, data),
    deleteContent: (id: string) => api.delete(`/content/${id}`),
    updateStatus: (id: string, new_status: string) => api.patch(`/content/${id}/status`, { new_status }),
    getTeamLeads: () => api.get('/team-leads'),
    assignClient: (clientId: string, teamLeadId: string) => api.patch(`/clients/${clientId}/assign`, { team_lead_id: teamLeadId }),
    getTeamLeadClients: (teamLeadId: string) => api.get(`/team-leads/${teamLeadId}/clients`),
};

const adminBase = axios.create({
    baseURL: 'http://localhost:3001/api/admin',
});

export const adminApi = {
    getClients: () => adminBase.get('/clients'),
    addClient: (data: any) => adminBase.post('/clients', data),
    updateClient: (id: string, data: any) => adminBase.put(`/clients/${id}`, data),
    deleteClient: (id: string) => adminBase.delete(`/clients/${id}`),
    getStats: () => adminBase.get('/stats'),
    getTeam: () => adminBase.get('/team'),
    addTeamMember: (data: any) => adminBase.post('/team', data),
    deleteTeamMember: (id: string) => adminBase.delete(`/team/${id}`),
};

export default api;

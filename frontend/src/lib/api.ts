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
};

export default api;

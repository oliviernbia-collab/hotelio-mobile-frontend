import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '@/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  timeout: 15000,
});

// Injection automatique du token + gestion FormData
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Pour FormData, React Native gère lui-même le Content-Type (avec boundary)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Gestion globale des erreurs
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:          (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (formData: FormData) =>
    api.post('/auth/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  logout:         () => api.post('/auth/logout'),
  me:             () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
};

// ─── Profil ──────────────────────────────────────────────────────────────────
export const profileApi = {
  get:            () => api.get('/profile'),
  update:         (data: object) => api.put('/profile', data),
  updatePassword: (data: object) => api.put('/profile/password', data),
  uploadAvatar:   (formData: FormData) => api.post('/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

// ─── Hôtels ──────────────────────────────────────────────────────────────────
export const hotelApi = {
  list:    (params?: object) => api.get('/hotels', { params }),
  mine:    () => api.get('/hotels/mine'),
  get:     (id: number) => api.get(`/hotels/${id}`),
  create:  (data: object | FormData) => api.post('/hotels', data),
  update:  (id: number, data: object | FormData) => api.put(`/hotels/${id}`, data),
  delete:  (id: number) => api.delete(`/hotels/${id}`),
  reviews: {
    create: (hotelId: number, data: object) => api.post(`/hotels/${hotelId}/reviews`, data),
  },
  favorite: (hotelId: number) => api.post(`/hotels/${hotelId}/favorite`),
};

// ─── Chambres ────────────────────────────────────────────────────────────────
export const roomApi = {
  list:         (params?: object) => api.get('/rooms', { params }),
  mine:         (params?: object) => api.get('/rooms/mine', { params }),
  create:       (data: object) => api.post('/rooms', data),
  update:       (id: number, data: object) => api.put(`/rooms/${id}`, data),
  updateStatus: (id: number, status: string) => api.patch(`/rooms/${id}/status`, { status }),
  markCleaned:  (id: number) => api.post(`/rooms/${id}/cleaned`),
  delete:       (id: number) => api.delete(`/rooms/${id}`),
};

// ─── Réservations ────────────────────────────────────────────────────────────
export const reservationApi = {
  list:           (params?: object) => api.get('/reservations', { params }),
  mine:           (params?: object) => api.get('/reservations/mine', { params }),
  get:            (id: number) => api.get(`/reservations/${id}`),
  create:         (data: object) => api.post('/reservations', data),
  updateStatus:   (id: number, status: string) =>
    api.patch(`/reservations/${id}/status`, { status }),
  checkIn:        (id: number) => api.post(`/reservations/${id}/checkin`),
  checkOut:       (id: number) => api.post(`/reservations/${id}/checkout`),
  processPayment: (id: number, data: object) => api.post(`/reservations/${id}/payment`, data),
};

// ─── Clients ─────────────────────────────────────────────────────────────────
export const clientApi = {
  list:      (params?: object)              => api.get('/clients', { params }),
  top:       (params?: object)              => api.get('/clients/top', { params }),
  get:       (id: number)                   => api.get(`/clients/${id}`),
  create:    (data: object)                 => api.post('/clients', data),
  update:    (id: number, data: object)     => api.put(`/clients/${id}`, data),
  addPoints: (id: number, data: object)     => api.post(`/clients/${id}/points`, data),
};

// ─── Staff ───────────────────────────────────────────────────────────────────
export const staffApi = {
  me:             () => api.get('/staff/me'),
  list:           (params?: object) => api.get('/staff', { params }),
  create:         (data: object) => api.post('/staff', data),
  update:         (id: number, data: object) => api.put(`/staff/${id}`, data),
  delete:         (id: number) => api.delete(`/staff/${id}`),
  schedules:      (params?: object) => api.get('/staff/schedules', { params }),
  addSchedule:    (data: object) => api.post('/staff/schedules', data),
};

// ─── Menu ────────────────────────────────────────────────────────────────────
export const menuApi = {
  list:   (params?: object) => api.get('/menu', { params }),
  create: (data: object) => api.post('/menu', data),
  update: (id: number, data: object) => api.put(`/menu/${id}`, data),
  delete: (id: number) => api.delete(`/menu/${id}`),
};

// ─── Commandes restaurant ────────────────────────────────────────────────────
export const orderApi = {
  list:   (params?: object) => api.get('/orders', { params }),
  create: (data: object) => api.post('/orders', data),
  update: (id: number, data: object) => api.put(`/orders/${id}`, data),
  delete: (id: number) => api.delete(`/orders/${id}`),
};

// ─── Charges ─────────────────────────────────────────────────────────────────
export const expenseApi = {
  list:   (params?: object) => api.get('/expenses', { params }),
  create: (data: object) => api.post('/expenses', data),
  update: (id: number, data: object) => api.put(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
};

// ─── Piscines ────────────────────────────────────────────────────────────────
export const poolApi = {
  list:   (params?: object) => api.get('/pools', { params }),
  create: (data: object) => api.post('/pools', data),
  update: (id: number, data: object) => api.put(`/pools/${id}`, data),
};

// ─── Tickets ─────────────────────────────────────────────────────────────────
export const ticketApi = {
  list:   (params?: object) => api.get('/tickets', { params }),
  create: (data: object) => api.post('/tickets', data),
  update: (id: number, data: object) => api.put(`/tickets/${id}`, data),
  delete: (id: number) => api.delete(`/tickets/${id}`),
};

// ─── Facturations ────────────────────────────────────────────────────────────
export const facturationApi = {
  list:        (params?: object) => api.get('/facturations', { params }),
  get:         (id: number) => api.get(`/facturations/${id}`),
  create:      (data: object) => api.post('/facturations', data),
  update:      (id: number, data: object) => api.put(`/facturations/${id}`, data),
  pay:         (id: number, data: object) => api.patch(`/facturations/${id}/pay`, data),
  delete:      (id: number) => api.delete(`/facturations/${id}`),
  downloadUrl: (id: number, token: string) =>
    `${API_BASE_URL}/facturations/${id}/download?token=${encodeURIComponent(token)}`,
};

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationApi = {
  list:        (params?: object) => api.get('/notifications', { params }),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete:      (id: string) => api.delete(`/notifications/${id}`),
};

// ─── Favoris ─────────────────────────────────────────────────────────────────
export const favoriteApi = {
  list:   () => api.get('/favorites'),
  toggle: (hotelId: number) => api.post(`/hotels/${hotelId}/favorite`),
};

// ─── Boutique ────────────────────────────────────────────────────────────────
export const boutiqueApi = {
  products:       (params?: object) => api.get('/boutique/products', { params }),
  product:        (id: number) => api.get(`/boutique/products/${id}`),
  myProducts:     () => api.get('/boutique/products/mine'),
  createProduct:  (data: FormData) => api.post('/boutique/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateProduct:  (id: number, data: FormData) => api.put(`/boutique/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteProduct:  (id: number) => api.delete(`/boutique/products/${id}`),
  cart:           () => api.get('/boutique/cart'),
  addToCart:      (id: number, quantity?: number) => api.post(`/boutique/cart/${id}`, { quantity }),
  removeFromCart: (id: number) => api.delete(`/boutique/cart/${id}`),
  placeOrder:     (payment_method: string) => api.post('/boutique/order', { payment_method }),
  myOrders:       () => api.get('/boutique/my-orders'),
  orderItems:     (id: number) => api.get(`/boutique/orders/${id}/items`),
  cancelOrder:    (id: number) => api.patch(`/boutique/orders/${id}/cancel`),
};

// ─── Services prestataire ────────────────────────────────────────────────────
export const serviceApi = {
  list:   (params?: object) => api.get('/services', { params }),
  create: (data: object) => api.post('/services', data),
  update: (id: number, data: object) => api.put(`/services/${id}`, data),
  delete: (id: number) => api.delete(`/services/${id}`),
  toggle: (id: number, available: boolean) => api.put(`/services/${id}`, { available: available ? 1 : 0 }),
};

// ─── Pointage ────────────────────────────────────────────────────────────────
export const pointageApi = {
  me:       () => api.get('/pointage/me'),
  checkIn:  () => api.post('/pointage/check-in'),
  checkOut: () => api.post('/pointage/check-out'),
  report:   (params?: object) => api.get('/pointage/report', { params }),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  users: {
    list:   (params?: object) => api.get('/admin/users', { params }),
    create: (data: object) => api.post('/admin/users', data),
    update: (id: number, data: object) => api.put(`/admin/users/${id}`, data),
    delete: (id: number) => api.delete(`/admin/users/${id}`),
  },
  logs: {
    list:  (params?: object) => api.get('/admin/logs', { params }),
    clear: () => api.delete('/admin/logs'),
  },
  reviews: {
    approve: (id: number) => api.patch(`/admin/reviews/${id}/approve`),
    reject:  (id: number) => api.patch(`/admin/reviews/${id}/reject`),
  },
};

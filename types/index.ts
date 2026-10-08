export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'prestataire' | 'employe' | 'client';
  status: string;
  permissions: string[];
  hotels?: string;
  two_fa: boolean;
  avatar?: string;
}

export interface Hotel {
  id: number;
  user_id?: number;
  name: string;
  short_name: string;
  city: string;
  commune?: string;
  quartier?: string;
  stars: number;
  category: string;
  price: number;
  rating: number;
  image?: string;
  image_url?: string;
  status: string;
  phone?: string;
  email?: string;
  description?: string;
  services?: string[];
  manager?: string;
  revenue?: number;
  occupancy?: number;
  rooms_count?: number;
  reservations_count?: number;
}

export interface Room {
  id: number;
  hotel_id: number;
  number: string;
  floor: number;
  type: string;
  status: 'disponible' | 'réservée' | 'occupée' | 'en_nettoyage' | 'hors_service';
  price: number;
  capacity: number;
  superficie_m2?: number;
  description?: string;
  hotel?: Partial<Hotel>;
}

export interface Client {
  id: number;
  code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  city?: string;
  status: string;
  total_stays: number;
  total_spend: number;
  points_fidelite: number;
  last_visit?: string;
}

export interface Reservation {
  id: number;
  code: string;
  client_id: number;
  hotel_id: number;
  room_id?: number;
  checkin: string;
  checkout: string;
  nights: number;
  price: number;
  total: number;
  status: 'en_attente' | 'confirmée' | 'annulée' | 'terminée';
  paid: boolean;
  payment_method?: string;
  checkin_at?: string;
  checkout_at?: string;
  notes?: string;
  hotel?: Partial<Hotel>;
  client?: Partial<Client>;
  room?: Partial<Room>;
}

export interface Staff {
  id: number;
  hotel_id: number;
  first_name: string;
  last_name: string;
  role: string;
  phone?: string;
  email?: string;
  salary?: number;
  hired_at?: string;
  status: string;
  photo?: string;
}

export interface Pointage {
  id: number;
  staff_id: number;
  hotel_id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_source?: 'mobile' | 'web' | null;
  check_out_source?: 'mobile' | 'web' | null;
  late_minutes: number;
  worked_minutes: number | null;
  status: 'present' | 'retard' | 'absent';
  first_name?: string;
  last_name?: string;
  hotel_name?: string;
  hotel_short_name?: string;
}

export interface MenuItem {
  id: number;
  hotel_id: number;
  name: string;
  item_type: 'plat' | 'boisson';
  category: string;
  price: number;
  stock?: number;
  emoji?: string;
  description?: string;
  available: boolean;
}

export interface Order {
  id: number;
  hotel_id: number;
  client_id?: number;
  menu_item_id: number;
  quantity: number;
  total: number;
  status: string;
  notes?: string;
  ordered_at: string;
  delivered_at?: string;
  menu_item?: Partial<MenuItem>;
  client?: Partial<Client>;
}

export interface Expense {
  id: number;
  hotel_id: number;
  description: string;
  amount: number;
  expense_type: string;
  occurred_at: string;
  notes?: string;
}

export interface Pool {
  id: number;
  hotel_id: number;
  name: string;
  status: string;
  area?: number;
  depth?: number;
  temperature?: number;
  description?: string;
}

export interface Ticket {
  id: number;
  hotel_id: number;
  client_id?: number;
  title: string;
  ticket_type: string;
  status: string;
  priority: 'faible' | 'normal' | 'urgent';
  description?: string;
  opened_at: string;
  closed_at?: string;
  assigned_to?: string;
}

export interface Facturation {
  id: number;
  numero: string;
  client: string;
  prestation: string;
  date_facture: string;
  date_echeance: string;
  montant: number;
  montant_paye: number;
  statut: 'paid' | 'pending' | 'overdue' | 'partial' | 'draft';
  mode_paiement?: string;
  notes?: string;
}

export interface Review {
  id: number;
  user_id: number;
  hotel_id: number;
  rating: number;
  title?: string;
  comment?: string;
  user?: Partial<User>;
  created_at?: string;
}

export interface Product {
  id: number;
  user_id?: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  emoji?: string;
  description?: string;
  image?: string;
  image_url?: string;
}

export interface Notification {
  id: string;
  type: string;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
}

export interface DashboardStats {
  role: string;
  stats: Record<string, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

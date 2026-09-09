export type Role = "student" | "faculty" | "librarian" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: string;
  identifier: string | null;
  phone: string | null;
  department_id: string | null;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminUser extends User {
  borrow_limit_override: number | null;
  staff_notes: string | null;
  failed_login_count: number;
  locked_until: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface BookSummary {
  id: string;
  title: string;
  subtitle: string | null;
  isbn: string | null;
  publication_year: number | null;
  language: string;
  cover_image_url: string | null;
  status: string;
  author_names: string[];
  total_copies: number;
  available_copies: number;
  ai_tags: string[] | null;
}

export interface Copy {
  id: string;
  book_id: string;
  barcode: string;
  status: string;
  condition: string;
  shelf_location: string | null;
  shelf_id: string | null;
  acquisition_date: string | null;
  price: number | null;
  notes: string | null;
}

export interface CopyRow extends Copy {
  book_title: string;
  shelf_code: string | null;
}

export interface BookDetail extends BookSummary {
  description: string | null;
  keywords: string | null;
  edition: string | null;
  subject: string | null;
  digital_resource_url: string | null;
  publisher: { id: string; name: string } | null;
  category: { id: string; name: string; code: string | null } | null;
  copies: Copy[];
  created_at: string;
}

export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface SearchResultItem {
  book: BookSummary;
  score: number;
  reason: string;
}
export interface SearchResponse {
  query: string;
  mode: SearchMode;
  ai_used: boolean;
  count: number;
  results: SearchResultItem[];
  note: string | null;
}

export interface Loan {
  id: string;
  book_id: string;
  copy_id: string;
  user_id: string;
  issued_at: string;
  due_at: string;
  returned_at: string | null;
  renewed_count: number;
  status: "active" | "returned" | "overdue" | "lost";
  book: { id: string; title: string };
  member_name: string | null;
  member_identifier: string | null;
}

export interface Fine {
  id: string;
  user_id: string;
  loan_id: string | null;
  type: string;
  amount: number;
  paid_amount: number;
  status: string;
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
  member_name: string | null;
}

export interface BorrowingStatus {
  active_loans: number;
  borrow_limit: number;
  can_borrow: boolean;
  outstanding_fines: number;
  fine_block_threshold: number;
}

export interface Reservation {
  id: string;
  book_id: string;
  user_id: string;
  status: "pending" | "ready" | "fulfilled" | "cancelled" | "expired";
  queue_position: number;
  ready_at: string | null;
  expires_at: string | null;
  created_at: string;
  book: BookSummary;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}
export interface NotificationList {
  items: Notification[];
  unread: number;
}

export interface Favorite {
  book: BookSummary;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  book_count: number;
}
export interface Publisher {
  id: string;
  name: string;
  book_count: number;
}
export interface Author {
  id: string;
  name: string;
  bio: string | null;
  book_count: number;
}
export interface Shelf {
  id: string;
  code: string;
  name: string;
  location: string | null;
  capacity: number | null;
  description: string | null;
  copy_count: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface AuditEntry {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  ip_address: string | null;
  request_id: string | null;
  created_at: string;
}

export interface DashboardData {
  role: string;
  // member
  active_loans?: number;
  borrow_limit?: number;
  can_borrow?: boolean;
  outstanding_fines?: number;
  reservations_active?: number;
  loans_all_time?: number;
  due_soon?: {
    id: string;
    book_id: string;
    title: string;
    due_at: string;
    status: string;
  }[];
  // staff
  total_titles?: number;
  total_copies?: number;
  available_copies?: number;
  overdue_loans?: number;
  reservations_ready?: number;
  reservations_pending?: number;
  unpaid_fines_total?: number;
  issued_last_7d?: number;
  returned_last_7d?: number;
  popular_books?: { id: string; title: string; loans: number }[];
  // admin
  total_users?: number;
  users_by_role?: Record<string, number>;
  suspended_users?: number;
  logins_24h?: number;
  searches_last_7d?: number;
  failed_searches_total?: number;
  loans_by_category?: { category: string; loans: number }[];
}

export interface ChatSource {
  kind: string;
  label: string;
  ref: string | null;
}
export interface ChatResponse {
  session_id: string;
  answer: string;
  ai_used: boolean;
  sources: ChatSource[];
  disclaimer: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
    timestamp?: string;
  };
}

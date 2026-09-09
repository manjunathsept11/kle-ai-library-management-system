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
  barcode: string;
  status: string;
  condition: string;
  shelf_location: string | null;
  acquisition_date: string | null;
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
}

export interface BorrowingStatus {
  active_loans: number;
  borrow_limit: number;
  can_borrow: boolean;
  outstanding_fines: number;
  fine_block_threshold: number;
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

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  message: string;
  pagination?: Paginacao;
  timestamp: string;
}

export interface Paginacao {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErro {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  details: string[];
  timestamp: string;
  path: string;
}

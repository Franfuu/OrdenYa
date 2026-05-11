// Tipos relacionados con autenticación

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  departamento?: string;
  created_at: string;
}

export interface AuthSession {
  user: User;
  token?: string;
}

export interface AuthResponse {
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

import axios, { isAxiosError } from "axios";
import type { AuthResponse } from "../types/Auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const authService = {
    login(email: string, password: string) {
        return axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, { email, password }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }).then((r) => r.data);
    },

    logout(token: string) {
        return axios.post(`${API_BASE_URL}/auth/logout`, {}, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Accept': 'application/json' 
            },
        }).then(() => {});
    },

    getUser() {
        const session = localStorage.getItem('auth_session');
        if (!session) return null;
        try {
            const parsed = JSON.parse(session);
            return parsed.user || null;
        } catch {
            return null;
        }
    },

    isAuthError: isAxiosError,
};


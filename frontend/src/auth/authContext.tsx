import { createContext, use, useEffect, useMemo, useState } from "react";
import type { User } from "../types/Auth";
import { authService } from "../services/authService";
import { disconnectEcho } from "../services/echo";
import { http } from "../services/http";

type AuthContextValue = {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (user: User) => void;
    logout: () => void;
    updateUser: (patch: Partial<User>) => void;
}

const SESSION_FLAG = 'pgs-session';

function hasSessionFlag(): boolean {
    return document.cookie.split(';').some(c => c.trim().startsWith(SESSION_FLAG + '='));
}

function setSessionFlag(): void {
    document.cookie = `${SESSION_FLAG}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function clearSessionFlag(): void {
    document.cookie = `${SESSION_FLAG}=; path=/; max-age=0; SameSite=Lax`;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(hasSessionFlag());

    useEffect(() => {
        if (!hasSessionFlag()) return;
        http.get<{ user: User }>('/auth/me')
            .then(res => {
                if (!res.data?.user) clearSessionFlag();
                setUser(res.data?.user ?? null);
            })
            .catch(() => { clearSessionFlag(); setUser(null); })
            .finally(() => setLoading(false));
    }, []);

    function login(user: User) {
        setSessionFlag();
        setUser(user);
    }

    function logout() {
        clearSessionFlag();
        disconnectEcho();
        authService.logout().finally(() => {
            setUser(null);
            window.location.assign('/login');
        });
    }

    function updateUser(patch: Partial<User>) {
        setUser(prev => prev ? { ...prev, ...patch } : null);
    }

    const value = useMemo<AuthContextValue>(() => ({
        user,
        isAuthenticated: Boolean(user),
        loading,
        login,
        logout,
        updateUser,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [user, loading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const ctx = use(AuthContext);
    if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider />");
    return ctx;
}

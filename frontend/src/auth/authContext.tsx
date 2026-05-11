import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthSession, User } from "../types/Auth";
import { authStorage } from "./authStorage";

type AuthContextValue = {
    user: User | null;
    isAuthenticated: boolean;
    login: (session: AuthSession) => void;
    logout: () => void;
    /** Actualiza los datos del usuario en el contexto Y en el localStorage
     *  sin cerrar sesión ni tocar el token. */
    updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const initial: AuthSession | null = authStorage.get();

    const [user, setUser] = useState<User | null>(initial?.user ?? null)
    const [token, setToken] = useState<string | null>(initial?.token ?? null)

    function syncFromStorage() {
        const session: AuthSession | null = authStorage.get();
        setUser(session?.user ?? null)
        setToken(session?.token ?? null)
    }

    function login(session: AuthSession) {
        authStorage.set(session);
        setUser(session.user);
        setToken(session.token);
    }

    function logout() {
        authStorage.clear();
        setUser(null);
        setToken(null);
    }

    /**
     * Aplica un cambio parcial sobre el usuario de la sesión activa.
     * Persiste los nuevos datos en localStorage y actualiza el estado React
     * → el Sidebar y cualquier componente que use `useAuth()` se re-renderiza.
     */
    function updateUser(patch: Partial<User>) {
        if (!user || !token) return;

        const updatedUser: User = { ...user, ...patch };
        const updatedSession: AuthSession = { user: updatedUser, token };

        authStorage.set(updatedSession);  // actualiza localStorage
        setUser(updatedUser);             // dispara re-render global
    }

    const value = useMemo<AuthContextValue>(() => {
        return {
            user,
            isAuthenticated: Boolean(user),
            login,
            logout,
            updateUser,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, token])

    useEffect(() => {
        window.addEventListener("storage", syncFromStorage)
        return () => window.removeEventListener("storage", syncFromStorage)
    }, [])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const contexto = useContext(AuthContext);
    if (!contexto) throw new Error("useAuth debe usarse dentro de <AuthProvider />");
    return contexto;
}
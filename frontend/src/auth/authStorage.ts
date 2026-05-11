import type { AuthSession } from "../types/Auth";

const CLAVE = "auth_session";

export const authStorage = {
    get() : AuthSession | null {
        const datosBrutos = localStorage.getItem(CLAVE);
        if (!datosBrutos) return null;
        try {
            return JSON.parse(datosBrutos) as AuthSession;
        } catch {
            return null;
        }
    },
    set(session: AuthSession) : void {
        localStorage.setItem(CLAVE, JSON.stringify(session)) // ← persiste para siempre la sesion
    },
    clear() {
        localStorage.removeItem(CLAVE);
    }
}
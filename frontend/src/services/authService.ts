import { isAxiosError } from "axios";
import type { User } from "../types/Auth";
import { http } from "./http";

export const authService = {
    login(email: string, password: string) {
        return http.post<{ user: User }>('/auth/login', { email, password })
            .then((r) => r.data);
    },

    logout() {
        return http.post('/auth/logout').then(() => {});
    },

    isAuthError: isAxiosError,
};

import axios from "axios";
import { sileo } from "sileo";
import { getErrorMessage } from "../utils/errorHelper";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const http = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,  // send HttpOnly cookie on every request
});

http.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers['Accept'] = 'application/json';

    // FormData must NOT have a forced Content-Type — axios sets multipart/form-data with boundary automatically
    if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }

    return config;
});

http.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        console.error("HTTP Interceptor error en URL:", error.config?.url, status);

        if (status === 401) {
            if (window.location.pathname !== '/login') {
                window.location.assign("/login");
            }
            error._interceptorHandled = true;
        } else if (status === 403) {
            sileo.error({ title: 'Sin permisos', description: getErrorMessage(error) });
            error._interceptorHandled = true;
        } else if (status === 422) {
            sileo.error({ title: 'Error de validación', description: getErrorMessage(error) });
            error._interceptorHandled = true;
        } else if (status === 500) {
            sileo.error({ title: 'Error del servidor', description: getErrorMessage(error) });
            error._interceptorHandled = true;
        } else if (!status) {
            // Network error / timeout
            sileo.error({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor.' });
            error._interceptorHandled = true;
        }

        return Promise.reject(error);
    }
);

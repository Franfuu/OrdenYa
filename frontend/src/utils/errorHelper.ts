export const getErrorMessage = (err: any): string => {
    // Si es un error de validación de Laravel (422)
    if (err.response?.status === 422 && err.response?.data?.errors) {
        const errors = err.response.data.errors;
        const firstKey = Object.keys(errors)[0];
        const firstMsg = errors[firstKey][0];
        
        // Traducciones comunes de campos
        const translations: Record<string, string> = {
            'email': 'el correo electrónico',
            'password': 'la contraseña',
            'name': 'el nombre',
            'codigo_orden': 'el código de orden',
            'nombre_orden': 'el nombre de orden',
            'unidades': 'las unidades',
            'estado_orden': 'el estado',
            'fecha_inicio': 'la fecha de inicio',
            'fecha_fin': 'la fecha de fin',
        };

        let msg = firstMsg.toLowerCase();
        
        // Intentar traducir el mensaje de Laravel
        if (msg.includes('is required') || msg.includes('obligatorio')) {
            return `El campo ${translations[firstKey] || firstKey} es obligatorio.`;
        }
        if (msg.includes('has already been taken') || msg.includes('ya ha sido registrado')) {
            return `Este ${translations[firstKey] || firstKey} ya está registrado en el sistema.`;
        }
        
        return firstMsg; // Devolver el mensaje original si no hay patrón
    }

    // Errores de autenticación
    if (err.response?.status === 401) {
        return 'Tu sesión ha expirado o las credenciales son incorrectas.';
    }
    
    if (err.response?.status === 403) {
        return 'No tienes permisos suficientes para realizar esta acción.';
    }

    if (err.response?.status === 404) {
        return 'El recurso solicitado no existe.';
    }

    if (err.response?.status === 500) {
        return 'Ha ocurrido un error interno en el servidor. Inténtalo más tarde.';
    }

    return err.message || 'Ha ocurrido un error inesperado.';
};

import { sileo } from 'sileo';

/**
 * Muestra toast solo si el interceptor HTTP no lo manejó ya.
 */
export function showHttpError(err: any, fallbackTitle = 'Error'): void {
    if (err?._interceptorHandled) return;
    sileo.error({ title: fallbackTitle, description: getErrorMessage(err) });
}

const FIELD_LABELS: Record<string, string> = {
    'email': 'el correo electrónico',
    'password': 'la contraseña',
    'name': 'el nombre',
    'codigo_orden': 'el código de orden',
    'nombre_orden': 'el nombre de orden',
    'unidades': 'las unidades',
    'estado_orden': 'el estado',
    'fecha_inicio': 'la fecha de inicio',
    'fecha_fin': 'la fecha de fin',
    'piezas': 'las piezas',
    'notas': 'las notas',
    'hora_inicio': 'la hora de inicio',
    'hora_fin': 'la hora de fin',
    'fecha': 'la fecha',
    'work_order_department_id': 'el departamento',
    'work_order_phase_id': 'la fase',
    'departamento': 'el departamento',
    'role': 'el rol',
};

function translateLaravelMessage(field: string, rawMsg: string): string {
    const label = FIELD_LABELS[field] || field;
    const msg = rawMsg.toLowerCase();

    if (msg.includes('required') || msg.includes('obligatorio')) {
        return `Falta rellenar ${label}.`;
    }
    if (msg.includes('has already been taken') || msg.includes('ya ha sido')) {
        return `Ese valor para ${label} ya está registrado.`;
    }
    if (msg.includes('must be an integer') || msg.includes('debe ser un entero')) {
        return `${label.charAt(0).toUpperCase() + label.slice(1)} debe ser un número entero.`;
    }
    if (msg.includes('must be a number') || msg.includes('debe ser un número')) {
        return `${label.charAt(0).toUpperCase() + label.slice(1)} debe ser un número.`;
    }
    if (msg.includes('must be at least') || msg.includes('min:') || msg.includes('al menos')) {
        return `El valor de ${label} es demasiado bajo.`;
    }
    if (msg.includes('may not be greater') || msg.includes('no debe ser mayor')) {
        return `El valor de ${label} es demasiado alto.`;
    }
    if (msg.includes('must be a valid email') || msg.includes('correo')) {
        return `Introduce un correo electrónico válido.`;
    }
    if (msg.includes('does not exist') || msg.includes('invalid') || msg.includes('selected') && msg.includes('exist')) {
        return `${label.charAt(0).toUpperCase() + label.slice(1)} no es válido.`;
    }
    if (msg.includes('date_format') || msg.includes('formato')) {
        return `${label.charAt(0).toUpperCase() + label.slice(1)} tiene un formato inválido.`;
    }
    return rawMsg;
}

export const getErrorMessage = (err: any): string => {
    const data = err?.response?.data;
    const status = err?.response?.status;

    // Laravel validation errors { errors: { field: [msg, ...] } }
    if (status === 422 && data?.errors && typeof data.errors === 'object') {
        const firstKey = Object.keys(data.errors)[0];
        const firstMsg = data.errors[firstKey]?.[0];
        if (firstMsg) return translateLaravelMessage(firstKey, firstMsg);
    }

    // Custom backend message (used for business-rule errors, e.g. cuota, sesión activa…)
    if (typeof data?.message === 'string' && data.message.trim() !== '') {
        const m = data.message.trim();
        // Avoid leaking generic Laravel header
        if (!/^server error$/i.test(m)) return m;
    }

    if (status === 401) return 'Tu sesión ha expirado. Vuelve a iniciar sesión.';
    if (status === 403) return 'No tienes permisos para realizar esta acción.';
    if (status === 404) return 'No se ha encontrado el recurso solicitado.';
    if (status === 409) return 'La acción no se puede completar por un conflicto con el estado actual.';
    if (status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    if (status === 500) return 'Ha ocurrido un error en el servidor. Inténtalo de nuevo en unos minutos.';
    if (!status) return 'No se ha podido conectar con el servidor. Comprueba tu conexión.';

    return 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
};

import { sileo } from 'sileo';

/**
 * Muestra toast solo si el interceptor HTTP no lo manejó ya.
 */
export function showHttpError(err: any, fallbackTitle = 'Error'): void {
    if (err?._interceptorHandled) return;
    sileo.error({ title: fallbackTitle, description: getErrorMessage(err) });
}

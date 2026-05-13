import { http } from "./http";

export type Departamento = 'Taller' | 'Instalacion';

export interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'supervisor' | 'trabajador' | 'jefe';
    departamento?: Departamento;
    created_at?: string;
    updated_at?: string;
}

/** Desenvuelve la respuesta del backend, que puede venir como:
 *  - User directamente (r.data = User)
 *  - Envuelta en { data: User } (r.data = { data: User })
 *  Esto es necesario porque algunos endpoints de Laravel devuelven un Resource
 *  con un nivel extra de "data" y otros no.  */
function unwrapUser(raw: any): User {
    return (raw?.data && raw.data.id) ? raw.data : raw;
}

/** Igual pero para arrays */
function unwrapUsers(raw: any): User[] {
    // Puede llegar como array directo, o como { data: [...] }
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
}

export interface WorkerOrderStat {
    work_order_id: number;
    codigo_orden: string;
    nombre_orden: string;
    tipo: string | null;
    total_seconds: number;
    total_piezas: number;
    sessions_count: number;
}

export interface WorkerStats {
    user_id: number;
    name: string;
    total_seconds: number;
    total_piezas: number;
    orders: WorkerOrderStat[];
}

export interface Ausencia {
    id: number;
    user_id: number;
    fecha: string;
    dia_completo: boolean;
    hora_inicio: string | null;
    hora_fin: string | null;
    motivo: string;
    notas: string | null;
    created_at: string;
}

export interface AusenciaCreateDTO {
    fecha: string;
    dia_completo: boolean;
    hora_inicio?: string;
    hora_fin?: string;
    motivo?: string;
    notas?: string;
}

export interface OrderSessionStat {
    id: number;
    start_time: string;
    end_time: string | null;
    duration_in_seconds: number;
    piezas: number;
    department_name: string | null;
    phase_name: string | null;
    work_order_department_id: number | null;
    work_order_phase_id: number | null;
}

export interface FichajeLog {
    modified_by: { id: number; name: string; role: string };
    changes: Record<string, { from: string | number | null; to: string | number | null }>;
    at: string;
}

export interface FichajeEntry {
    id: number;
    user: { id: number; name: string; role: string };
    work_order: { id: number; codigo_orden: string; nombre_orden: string } | null;
    start_time: string;
    end_time: string | null;
    duration_in_seconds: number;
    piezas: number;
    department_name: string | null;
    phase_name: string | null;
    modificada: boolean;
    logs: FichajeLog[];
}

export const userService = {
    getUsers() {
        return http.get<any>('/users').then(r => unwrapUsers(r.data));
    },
    getUser(id: number) {
        return http.get<any>(`/users/${id}`).then(r => unwrapUser(r.data));
    },
    createUser(data: Partial<User> & { password?: string }) {
        return http.post<any>('/users', data).then(r => unwrapUser(r.data));
    },
    updateUser(id: number, data: Partial<User> & { password?: string }) {
        return http.put<any>(`/users/${id}`, data).then(r => unwrapUser(r.data));
    },
    deleteUser(id: number) {
        return http.delete(`/users/${id}`).then(r => r.data);
    },
    getStats(userId: number, from?: string, to?: string): Promise<WorkerStats> {
        return http.get<WorkerStats>(`/users/${userId}/stats`, { params: { from, to } }).then(r => r.data);
    },
    getOrderSessions(userId: number, workOrderId: number, from?: string, to?: string): Promise<OrderSessionStat[]> {
        return http.get<OrderSessionStat[]>(`/users/${userId}/orders/${workOrderId}/sessions`, { params: { from, to } }).then(r => r.data);
    },
    createAusencia(data: AusenciaCreateDTO): Promise<Ausencia> {
        return http.post<{ ausencia: Ausencia }>('/ausencias', data).then(r => r.data.ausencia);
    },
    getAusencias(userId: number, from?: string, to?: string): Promise<Ausencia[]> {
        return http.get<Ausencia[]>(`/users/${userId}/ausencias`, { params: { from, to } }).then(r => r.data);
    },
    getFichajes(params: { from?: string; to?: string; user_id?: number; work_order_id?: number }): Promise<FichajeEntry[]> {
        return http.get<FichajeEntry[]>('/admin/fichajes', { params }).then(r => r.data);
    },
};


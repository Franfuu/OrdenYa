import type {
    WorkOrder, WorkOrderCreateDTO, WorkOrderUpdateDTO, WorkSession,
    DepartmentSlug,
} from '../types/WorkOrder';
import { http } from './http';

const API_URL = '/work-orders';

export const workOrderService = {
    // ─── WORK ORDERS ───

    get(id: number): Promise<WorkOrder> {
        return http.get<any>(`${API_URL}/${id}`).then(response => {
            const raw = response.data;
            const order: WorkOrder = raw?.data ?? raw;
            if (!order || !order.codigo_orden) {
                throw new Error('La respuesta del servidor no tiene el formato esperado.');
            }
            return order;
        });
    },

    getAll(): Promise<WorkOrder[]> {
        return http.get<WorkOrder[]>(API_URL).then(r => r.data);
    },

    create(data: WorkOrderCreateDTO): Promise<WorkOrder> {
        return http.post<WorkOrder>(API_URL, data).then(r => r.data);
    },

    update(id: number, data: WorkOrderUpdateDTO): Promise<WorkOrder> {
        return http.put<WorkOrder>(`${API_URL}/${id}`, data).then(r => r.data);
    },

    uploadImage(id: number, file: File): Promise<WorkOrder> {
        const fd = new FormData();
        fd.append('imagen', file);
        return http.post<WorkOrder>(`${API_URL}/${id}/upload-image`, fd).then(r => r.data);
    },

    delete(id: number): Promise<void> {
        return http.delete<void>(`${API_URL}/${id}`).then(() => {});
    },

    // ─── DEPARTMENT MANAGEMENT ───

    addDepartment(orderId: number, data: {
        department_slug: DepartmentSlug;
        department_phases?: string[];
        department_workers?: number[];
        piezas?: number | null;
    }): Promise<{ message: string; work_order: WorkOrder }> {
        return http.post<{ message: string; work_order: WorkOrder }>(`${API_URL}/${orderId}/add-department`, data).then(r => r.data);
    },

    addWorkersToDepartment(orderId: number, departmentId: number, userIds: number[]): Promise<{ message: string; work_order: WorkOrder }> {
        return http.post<{ message: string; work_order: WorkOrder }>(`${API_URL}/${orderId}/add-workers`, {
            department_id: departmentId,
            user_ids: userIds,
        }).then(r => r.data);
    },

    removeDepartment(orderId: number, deptId: number): Promise<{ message: string; work_order: WorkOrder }> {
        return http.delete<{ message: string; work_order: WorkOrder }>(
            `${API_URL}/${orderId}/departments/${deptId}`
        ).then(r => r.data);
    },

    updateDeptPhases(orderId: number, deptId: number, phaseSlugs: string[], piezas?: number | null): Promise<{ message: string; work_order: WorkOrder }> {
        return http.put<{ message: string; work_order: WorkOrder }>(
            `${API_URL}/${orderId}/departments/${deptId}/phases`,
            { phase_slugs: phaseSlugs, piezas: piezas ?? null }
        ).then(r => r.data);
    },

    setWorkerPiezas(orderId: number, deptId: number, workerId: number, piezasAsignadas: number): Promise<{ message: string; work_order: WorkOrder }> {
        return http.put<{ message: string; work_order: WorkOrder }>(
            `${API_URL}/${orderId}/departments/${deptId}/workers/${workerId}/piezas`,
            { piezas_asignadas: piezasAsignadas }
        ).then(r => r.data);
    },

    removeWorkerFromDepartment(orderId: number, departmentId: number, userId: number): Promise<{ message: string }> {
        return http.post<{ message: string }>(`${API_URL}/${orderId}/remove-worker`, {
            department_id: departmentId,
            user_id: userId,
        }).then(r => r.data);
    },

    finalizeDepartment(orderId: number, departmentId: number): Promise<{ message: string; work_order: WorkOrder }> {
        return http.post<{ message: string; work_order: WorkOrder }>(`${API_URL}/${orderId}/finalize-department`, {
            department_id: departmentId,
        }).then(r => r.data);
    },

    assignPieces(orderId: number, data: {
        work_order_department_id: number;
        work_order_phase_id: number;
        user_id: number;
        piezas_asignadas: number;
    }): Promise<{ message: string }> {
        return http.post<{ message: string }>(`${API_URL}/${orderId}/assign-pieces`, data).then(r => r.data);
    },

    // ─── SESSIONS ───

    startSession(orderId: number, data: {
        work_order_department_id: number;
        work_order_phase_id: number;
        on_behalf_of?: number;
    }): Promise<{ message: string; session: WorkSession }> {
        return http.post<{ message: string; session: WorkSession }>(`${API_URL}/${orderId}/start`, data).then(r => r.data);
    },

    startGenericSession(keyword: string): Promise<{ message: string; session: WorkSession; work_order: WorkOrder }> {
        return http.post<{ message: string; session: WorkSession; work_order: WorkOrder }>(`${API_URL}/generic-start`, { keyword }).then(r => r.data);
    },

    pauseSession(orderId: number, data: {
        piezas?: number;
        on_behalf_of?: number;
        notas?: string;
    }): Promise<{ message: string; session: WorkSession | null }> {
        return http.post<{ message: string; session: WorkSession | null }>(`${API_URL}/${orderId}/pause`, data).then(r => r.data);
    },

    stopSession(orderId: number, data: {
        piezas: number;
        on_behalf_of?: number;
        notas?: string;
    }): Promise<{ message: string; session: WorkSession; work_order: WorkOrder }> {
        return http.post<{ message: string; session: WorkSession; work_order: WorkOrder }>(`${API_URL}/${orderId}/stop`, data).then(r => r.data);
    },

    manualSession(orderId: number, data: {
        fecha: string;
        hora_inicio: string;
        hora_fin: string;
        piezas: number;
        work_order_department_id?: number;
        work_order_phase_id?: number;
    }): Promise<{ message: string; session: WorkSession }> {
        return http.post<{ message: string; session: WorkSession }>(`${API_URL}/${orderId}/manual-session`, data).then(r => r.data);
    },

    updateSession(sessionId: number, data: {
        hora_inicio: string;
        hora_fin: string;
        piezas: number;
        notas?: string;
    }): Promise<{ message: string; session: WorkSession }> {
        return http.put<{ message: string; session: WorkSession }>(`${API_BASE_URL}/work-sessions/${sessionId}`, data).then(r => r.data);
    },

    getSessionsForUser(userId: number, date?: string): Promise<WorkSession[]> {
        return http.get<WorkSession[]>(`${API_BASE_URL}/users/${userId}/sessions`, { params: { date } }).then(r => r.data);
    },
};

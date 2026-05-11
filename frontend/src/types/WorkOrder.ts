import { User } from './Auth';

// ─── DEPARTMENTS & PHASES ───

export type DepartmentSlug = 'taller' | 'instalacion';

export type PhaseType = 'regular';

export interface Department {
  id: number;
  name: string;
  slug: DepartmentSlug;
}

export interface Phase {
  id: number;
  department_id: number;
  name: string;
  slug: string;
  order: number;
  is_optional: boolean;
  pieces_from: boolean;
  type: PhaseType;
}

export interface WorkOrderPhase {
  id: number;
  work_order_department_id: number;
  phase_id: number | null;
  custom_name: string | null;
  is_active: boolean;
  phase?: Phase;
  display_name?: string;
}

export interface WorkerPhasePieces {
  id: number;
  work_order_department_worker_id: number;
  work_order_phase_id: number;
  piezas_asignadas: number;
  piezas_completadas: number;
  work_order_phase?: WorkOrderPhase;
}

export interface WorkOrderDepartmentWorker {
  id: number;
  work_order_department_id: number;
  user_id: number;
  piezas_asignadas: number | null;
  piezas_completadas: number;
  user?: User;
  phase_pieces?: WorkerPhasePieces[];
}

export interface WorkOrderDepartment {
  id: number;
  work_order_id: number;
  department_id: number;
  piezas: number | null;
  finalizado_at: string | null;
  department?: Department;
  phases?: WorkOrderPhase[];
  workers?: WorkOrderDepartmentWorker[];
}

// ─── SESSIONS ───

export interface WorkSession {
  id: number;
  work_order_id: number;
  work_order_department_id: number | null;
  work_order_phase_id: number | null;
  user_id: number;
  start_time: string;
  end_time: string | null;
  piezas: number;
  notas: string | null;
  duration_in_seconds?: number;
  created_at: string;
  updated_at: string;
  user?: User;
  work_order?: WorkOrder;
  work_order_department?: { department?: { name: string; slug: string } };
  work_order_phase?: { phase?: { name: string; slug: string } };
}

// ─── WORK ORDER ───

export type WorkOrderTipo = 'HL' | 'TE' | 'DK';

export interface WorkOrder {
  id: number;
  tipo: WorkOrderTipo | null;
  codigo_orden: string;
  nombre_orden: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  unidades: number | null;
  festividad: string | null;
  numero_pedido: number | null;
  codigo_cliente: number | null;
  nombre_cliente: string | null;
  modelo: string | null;
  numero_op: string | null;
  observacion: string | null;
  imagen: string | null;
  extra_data: Record<string, string | number | boolean | null> | null;
  created_at: string;
  updated_at: string;

  hl_referencia_id?: number | null;

  // Relations
  departments?: WorkOrderDepartment[];
  work_sessions?: WorkSession[];
  hl_referencia?: import('./HlReferencia').HlReferencia | null;
}

// ─── DTOs ───

export interface WorkOrderCreateDTO {
  tipo?: WorkOrderTipo | null;
  codigo_orden: string;
  nombre_orden: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  unidades?: number | null;
  festividad?: string | null;
  numero_pedido?: number | null;
  codigo_cliente?: number | null;
  nombre_cliente?: string | null;
  modelo?: string | null;
  numero_op?: string | null;
  observacion?: string | null;
  imagen?: File | string | null;
  // Departments to activate (slugs)
  departments?: DepartmentSlug[];
  // Phases per dept: { dept_slug: ['phase_slug', ...] }
  department_phases?: Partial<Record<DepartmentSlug, string[]>>;
  // Target pieces per dept: { dept_slug: number }
  department_piezas?: Partial<Record<DepartmentSlug, number | null>>;
  // Workers per dept: { dept_slug: [user_id, ...] }
  department_workers?: Partial<Record<DepartmentSlug, number[]>>;
}

export type WorkOrderUpdateDTO = Partial<Omit<WorkOrderCreateDTO, 'departments' | 'department_phases' | 'department_workers'>>;

// ─── HELPERS ───

export function isOrderFinalizada(order: WorkOrder): boolean {
  if (!order.departments || order.departments.length === 0) return false;
  return order.departments.every(d => d.finalizado_at !== null);
}

export function isGenericOrder(order: WorkOrder): boolean {
  return order.codigo_orden.startsWith('GEN-');
}

export function getDepartmentBySlug(order: WorkOrder, slug: DepartmentSlug): WorkOrderDepartment | undefined {
  return order.departments?.find(d => d.department?.slug === slug);
}

export function getTotalPiezasCompletadas(dept: WorkOrderDepartment): number {
  return (dept.workers ?? []).reduce((total, worker) => {
    const fromPieces = (worker.phase_pieces ?? [])
      .filter(pp => pp.work_order_phase?.phase?.pieces_from)
      .reduce((s, pp) => s + pp.piezas_completadas, 0);
    return total + fromPieces;
  }, 0);
}

// ─── TALLER PHASES (for display) ───
export const TALLER_PHASES_ORDER = ['cortar', 'doblar', 'soldar', 'pintar'];
export const INSTALACION_PHASES_ORDER = ['preparar_material', 'instalacion'];

// ─── LEGACY (remove after full frontend migration) ───
export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface ApiErrorResponse {
  response?: {
    data?: ApiError;
    status?: number;
  };
}

import { http } from './http';

export type ReportPeriod = 'week' | 'month';

export interface DepartamentoStat {
  departamento: string;
  horas: number;
  ordenes: number;
  piezas: number;
}

export interface RoleStat {
  role: string;
  horas: number;
  ordenes: number;
  piezas: number;
}

export interface UserStat {
  user_id: number;
  name: string;
  role: string;
  horas: number;
  ordenes: string[];
  piezas: number;
}

export interface GlobalReport {
  period: ReportPeriod;
  from: string;
  to: string;
  totals: {
    horas: number;
    ordenes: number;
    piezas: number;
  };
  by_departamento: DepartamentoStat[];
  by_role: RoleStat[];
  by_user: UserStat[];
}

export const reportService = {
  getGlobal(period: ReportPeriod): Promise<GlobalReport> {
    return http
      .get<GlobalReport>('/reports/global', { params: { period } })
      .then(r => r.data);
  },
};

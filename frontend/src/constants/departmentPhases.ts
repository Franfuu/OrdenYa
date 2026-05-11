import type { DepartmentSlug } from '../types/WorkOrder';

export interface PhaseOption {
  slug: string;
  name: string;
  is_optional: boolean;
}

export const DEPT_PHASE_OPTIONS: Record<DepartmentSlug, PhaseOption[]> = {
  taller: [
    { slug: 'cortar', name: 'Cortar', is_optional: false },
    { slug: 'doblar', name: 'Doblar', is_optional: false },
    { slug: 'soldar', name: 'Soldar', is_optional: false },
    { slug: 'pintar', name: 'Pintar', is_optional: false },
  ],
  instalacion: [
    { slug: 'preparar_material', name: 'Preparar material', is_optional: false },
    { slug: 'instalacion',       name: 'Instalación',       is_optional: false },
  ],
};

export function defaultPhaseSlugs(slug: DepartmentSlug): string[] {
  return (DEPT_PHASE_OPTIONS[slug] ?? []).filter(p => !p.is_optional).map(p => p.slug);
}

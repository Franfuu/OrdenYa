declare module 'frappe-gantt' {
  export interface GanttTask {
    id: string;
    name: string;
    start: string;       // 'YYYY-MM-DD'
    end: string;         // 'YYYY-MM-DD' — must be strictly after start
    progress: number;    // 0–100
    custom_class?: string;
    dependencies?: string;
  }

  export interface GanttOptions {
    header_height?: number;
    column_width?: number;
    step?: number;
    view_modes?: string[];
    bar_height?: number;
    bar_corner_radius?: number;
    padding?: number;
    view_mode?: string;
    date_format?: string;
    language?: string;
    on_click?: (task: GanttTask) => void;
    readonly?: boolean;
    custom_popup_html?: ((task: GanttTask) => string) | null;
  }

  export default class Gantt {
    constructor(wrapper: HTMLElement | string, tasks: GanttTask[], options?: GanttOptions);
    change_view_mode(mode: string): void;
    refresh(tasks: GanttTask[]): void;
  }
}

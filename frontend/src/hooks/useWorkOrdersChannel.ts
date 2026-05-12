import { useEffect, useRef } from 'react';
import { getEcho } from '../services/echo';
import { useAuth } from '../auth/authContext';

export interface WorkOrdersChangedPayload {
    action: 'created' | 'updated' | 'deleted' | 'finalized' | 'session' | 'approved';
    work_order_id: number | null;
    meta?: Record<string, unknown>;
    at: string;
}

/**
 * Suscribe al canal público `work-orders`. Llama al callback con debounce
 * para evitar refetch en ráfagas.
 */
export function useWorkOrdersChannel(onChange: (e: WorkOrdersChangedPayload) => void, debounceMs = 400) {
    const cbRef = useRef(onChange);
    cbRef.current = onChange;
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return; // Sin login no abrimos WS
        let timer: ReturnType<typeof setTimeout> | null = null;
        let lastPayload: WorkOrdersChangedPayload | null = null;
        let channel: any = null;

        try {
            const echo = getEcho();
            channel = echo.channel('work-orders');
            const handler = (e: WorkOrdersChangedPayload) => {
                lastPayload = e;
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    if (lastPayload) cbRef.current(lastPayload);
                }, debounceMs);
            };
            channel.listen('.work-orders.changed', handler);
        } catch { /* noop — Reverb caído, polling de fondo cubre */ }

        return () => {
            if (timer) clearTimeout(timer);
            try { getEcho().leave('work-orders'); } catch { /* noop */ }
        };
    }, [debounceMs, user]);
}

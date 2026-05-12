import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { http } from './http';

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo?: Echo<'reverb'>;
    }
}

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Silenciar logs de Pusher (Reverb usa el cliente Pusher)
Pusher.logToConsole = false;
window.Pusher = Pusher;

let _instance: Echo<'reverb'> | null = null;

export function getEcho(): Echo<'reverb'> {
    if (_instance) return _instance;

    _instance = new Echo<'reverb'>({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
        wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
        enabledTransports: ['ws', 'wss'],
        authorizer: (channel: { name: string }) => ({
            authorize: (socketId: string, cb: (err: Error | null, data?: any) => void) => {
                http.post(`${apiBase}/broadcasting/auth`, {
                    socket_id: socketId,
                    channel_name: channel.name,
                })
                    .then(r => cb(null, r.data))
                    .catch(err => cb(err));
            },
        }),
    });

    // Swallow Pusher connection errors (Reverb caído → polling fallback ya cubre)
    try {
        const pusher = (_instance as any).connector?.pusher;
        if (pusher?.connection?.bind) {
            pusher.connection.bind('error', () => { /* noop — fail silently */ });
            pusher.connection.bind('unavailable', () => { /* noop */ });
            pusher.connection.bind('failed', () => { /* noop */ });
        }
    } catch { /* noop */ }

    window.Echo = _instance;
    return _instance;
}

export function disconnectEcho(): void {
    if (!_instance) return;
    try { _instance.disconnect(); } catch { /* noop */ }
    _instance = null;
    delete window.Echo;
}

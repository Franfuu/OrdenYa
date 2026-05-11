// Token is stored in HttpOnly cookie by PHP — JS cannot access it.
// Session is restored by calling GET /api/auth/me on app mount.
// This file is kept for compatibility but does nothing.
export const authStorage = {
    get() { return null; },
    set(_session: unknown) { /* noop — token lives in HttpOnly cookie */ },
    clear() { /* noop */ },
};

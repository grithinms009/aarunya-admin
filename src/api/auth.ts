/* Auth. POST /api/auth/* — the session is an HTTP-only cookie, so nothing is kept here.
   The reset request always resolves, so the response can't be used to probe which
   addresses are registered. */
import { ApiError, req } from './client';
import type { AdminUser } from '@/data/types';

export { ApiError };

export const auth = {
  async login(email: string, pass: string): Promise<AdminUser> {
    return req<AdminUser>('/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password: pass },
    });
  },

  async logout(): Promise<void> {
    await req('/auth/logout', { method: 'POST' });
  },

  /** Null when signed out, which is how the auth guard decides what to render. */
  async me(): Promise<AdminUser | null> {
    try {
      return await req<AdminUser | null>('/auth/me');
    } catch {
      return null;
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    await req('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
  },
};

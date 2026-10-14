/* Auth. Mock implementation; becomes POST /api/admin/auth/* when the API lands.
   The real version sets an HTTP-only cookie and never returns the password. */
import { db, mutate, reply, session } from './mock/store';
import type { AdminUser } from '@/data/types';

export class ApiError extends Error {}

export const auth = {
  isAuthenticated: (): boolean => session.get(),

  async login(email: string, pass: string): Promise<AdminUser> {
    const a = db().admin;
    const ok = email.trim().toLowerCase() === a.email.toLowerCase() && pass === a.pass;
    if (!ok) {
      await reply(null, 220);
      throw new ApiError('That email and password don’t match. Please try again.');
    }
    session.set(true);
    return reply({ email: a.email, name: a.name }, 220);
  },

  async logout(): Promise<void> {
    session.set(false);
    return reply(undefined, 0);
  },

  async me(): Promise<AdminUser | null> {
    if (!session.get()) return reply(null, 0);
    const a = db().admin;
    return reply({ email: a.email, name: a.name });
  },

  /** Always resolves, so the response can't be used to probe which emails exist. */
  async requestPasswordReset(_email: string): Promise<void> {
    return reply(undefined, 320);
  },

  async updateAccount(patch: {
    name?: string;
    email?: string;
    password?: string;
  }): Promise<AdminUser> {
    return reply(
      mutate((d) => {
        if (patch.name?.trim()) d.admin.name = patch.name.trim();
        if (patch.email?.trim()) d.admin.email = patch.email.trim();
        if (patch.password) d.admin.pass = patch.password;
        return { email: d.admin.email, name: d.admin.name };
      }),
    );
  },
};

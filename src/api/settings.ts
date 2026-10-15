/* Settings — GET/PUT /api/admin/settings, carrying the config, couriers, offline places,
   colour swatches and the signed-in account. The server re-runs every validation. */
import { ApiError, req } from './client';
import type { Config, Courier } from '@/data/types';

export interface SettingsPayload {
  config: Config;
  couriers: Courier[];
  locations: string[];
  colors: { key: string; label: string; hex: string }[];
  admin: { name: string; email: string };
}

export interface SettingsDraftInput {
  config: Record<string, string | boolean>;
  couriers: Courier[];
  locations: string[];
  colors: { key: string; label: string; hex: string }[];
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export class SettingsValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Please fix the highlighted fields');
  }
}

export const settings = {
  get: () => req<SettingsPayload>('/admin/settings'),

  /** Colour keys currently used by a product, which therefore cannot be removed. */
  colorsInUse: () => req<string[]>('/admin/settings/colors-in-use'),

  save: async (input: SettingsDraftInput): Promise<void> => {
    try {
      await req('/admin/settings', { method: 'PUT', body: input });
    } catch (e) {
      if (e instanceof ApiError && e.fields) throw new SettingsValidationError(e.fields);
      throw e;
    }
  },
};

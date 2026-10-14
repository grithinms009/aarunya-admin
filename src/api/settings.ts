/* Settings. Becomes GET/PUT /api/admin/settings, which carries the config, couriers,
   offline places and colour swatches, plus PATCH /api/admin/account for the login.

   Validation here mirrors what the backend must enforce: a WhatsApp number with the
   country code, valid emails, a password of at least six characters, and every colour
   named. A colour in use by a product is never dropped. */
import { num, slugify, tintOf } from '@/lib/format';
import { db, mutate, reply } from './mock/store';
import type { ColorDef, Config, Courier } from '@/data/types';

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
  get(): Promise<SettingsPayload> {
    const d = db();
    return reply({
      config: d.config,
      couriers: d.config.couriers ?? [],
      locations: d.config.locations ?? [],
      colors: Object.keys(d.colors).map((k) => ({
        key: k,
        label: d.colors[k].label,
        hex: d.colors[k].hex,
      })),
      admin: { name: d.admin.name, email: d.admin.email },
    });
  },

  /** Colour keys currently used by a product, which therefore cannot be removed. */
  colorsInUse(): Promise<string[]> {
    const d = db();
    return reply([...new Set(d.products.flatMap((p) => p.variants.map((v) => v.color)))]);
  },

  save(input: SettingsDraftInput): Promise<void> {
    const c = input.config;
    const fields: Record<string, string> = {};

    const whatsapp = String(c.WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
    if (whatsapp.length < 11 || whatsapp.length > 13) {
      fields.wa = 'Use country code + number, e.g. 919876543210';
    }
    if (!/^\S+@\S+\.\S+$/.test(String(c.EMAIL ?? ''))) fields.email = 'Enter a valid email';
    if (!/^\S+@\S+\.\S+$/.test(input.email)) fields.login = 'Enter a valid login email';
    if (input.password && input.password.length < 6) {
      fields.pass = 'Use at least 6 characters';
    } else if (input.password && input.password !== input.passwordConfirm) {
      fields.pass = 'Passwords don’t match';
    }
    if (input.colors.some((x) => !x.label.trim())) {
      fields.colors = 'Every colour needs a name';
    }

    if (Object.keys(fields).length) {
      return Promise.reject(new SettingsValidationError(fields));
    }

    const used = new Set(db().products.flatMap((p) => p.variants.map((v) => v.color)));

    return reply(
      mutate((dd) => {
        Object.assign(dd.config, {
          WHATSAPP_NUMBER: whatsapp,
          EMAIL: String(c.EMAIL ?? ''),
          INSTAGRAM_HANDLE: String(c.INSTAGRAM_HANDLE ?? ''),
          FREE_SHIPPING_THRESHOLD: num(c.FREE_SHIPPING_THRESHOLD),
          SHIPPING_FEE: num(c.SHIPPING_FEE),
          GIFT_WRAP_FEE: num(c.GIFT_WRAP_FEE),
          DISPATCH_CUTOFF_HOUR: num(c.DISPATCH_CUTOFF_HOUR),
          PAYMENT_PROVIDER: c.PAYMENT_PROVIDER as Config['PAYMENT_PROVIDER'],
          LOW_STOCK: Math.max(0, num(c.LOW_STOCK)),
          defaultCourier: String(c.defaultCourier ?? ''),
          notifyOnShip: !!c.notifyOnShip,
          shipMsg: String(c.shipMsg ?? ''),
          couriers: input.couriers
            .filter((x) => x.name.trim() && x.url.trim())
            .map((x) => ({ ...x, id: x.id || slugify(x.name) })),
          locations: input.locations.map((x) => x.trim()).filter(Boolean),
        });

        /* Keep the existing tint when the hex hasn't changed, else derive a new one. */
        const next: Record<string, ColorDef> = {};
        input.colors.forEach((x) => {
          const key = x.key || slugify(x.label);
          const existing = dd.colors[key];
          next[key] = {
            label: x.label.trim(),
            hex: x.hex,
            tint: existing && existing.hex === x.hex ? existing.tint : tintOf(x.hex),
          };
        });
        /* A colour a product still uses stays, even if it was removed from the list. */
        used.forEach((k) => {
          if (!next[k] && dd.colors[k]) next[k] = dd.colors[k];
        });
        dd.colors = next;

        dd.admin = {
          ...dd.admin,
          email: input.email.trim(),
          name: input.name.trim() || dd.admin.name,
          pass: input.password || dd.admin.pass,
        };
      }),
    );
  },
};

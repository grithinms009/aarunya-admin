import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsValidationError, settings } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Switch } from '@/components/ui/controls';
import { useAuth } from '@/store/useAuth';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import s from './SettingsPage.module.css';
import type { Courier } from '@/data/types';
import { useReference } from '@/hooks/useReference';


interface Draft {
  config: Record<string, string | boolean>;
  couriers: Courier[];
  locations: string[];
  colors: { key: string; label: string; hex: string }[];
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

const RATE_ZONES = ['home', 'rest', 'remote'] as const;
const rateToStr = (v: number | '' | null | undefined) => (v === '' || v == null ? '' : String(v));
/** '' stays '' (use the standard fee); anything else becomes a number, or NaN when invalid. */
const rateToValue = (v: string): number | '' => {
  const t = v.trim();
  return t === '' ? '' : Number(t);
};

export function SettingsPage() {
  const { dispatchCutoffs } = useReference();
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);
  const setUser = useAuth((st) => st.setUser);

  const { data: loaded } = useQuery({ queryKey: ['settings'], queryFn: settings.get });
  const { data: inUse = [] } = useQuery({
    queryKey: ['colors-in-use'],
    queryFn: settings.colorsInUse,
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded || draft) return;
    const c = loaded.config;
    setDraft({
      config: {
        WHATSAPP_NUMBER: c.WHATSAPP_NUMBER,
        EMAIL: c.EMAIL,
        INSTAGRAM_HANDLE: c.INSTAGRAM_HANDLE,
        FREE_SHIPPING_THRESHOLD: String(c.FREE_SHIPPING_THRESHOLD),
        SHIPPING_FEE: String(c.SHIPPING_FEE),
        RATE_home: rateToStr(c.SHIPPING_RATES?.home),
        RATE_rest: rateToStr(c.SHIPPING_RATES?.rest),
        RATE_remote: rateToStr(c.SHIPPING_RATES?.remote),
        GIFT_WRAP_FEE: String(c.GIFT_WRAP_FEE),
        DISPATCH_CUTOFF_HOUR: String(c.DISPATCH_CUTOFF_HOUR),
        PAYMENT_PROVIDER: c.PAYMENT_PROVIDER,
        LOW_STOCK: String(c.LOW_STOCK),
        defaultCourier: c.defaultCourier,
        notifyOnShip: c.notifyOnShip,
        shipMsg: c.shipMsg,
      },
      couriers: structuredClone(loaded.couriers),
      locations: [...loaded.locations],
      colors: structuredClone(loaded.colors),
      name: loaded.admin.name,
      email: loaded.admin.email,
      password: '',
      passwordConfirm: '',
    });
  }, [loaded, draft]);

  if (!draft) return null;

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setConfig = (key: string, value: string | boolean) => {
    setDraft({ ...draft, config: { ...draft.config, [key]: value } });
    setErrors((e) => ({ ...e, [key === 'WHATSAPP_NUMBER' ? 'wa' : key === 'EMAIL' ? 'email' : key]: '' }));
  };

  const save = async () => {
    const rateErrors: Record<string, string> = {};
    const SHIPPING_RATES = { home: '', rest: '', remote: '' } as Record<(typeof RATE_ZONES)[number], number | ''>;
    for (const z of RATE_ZONES) {
      const v = rateToValue(String(draft.config[`RATE_${z}`] ?? ''));
      if (v !== '' && (!Number.isFinite(v) || v < 0)) rateErrors[`RATE_${z}`] = 'Enter a non-negative amount, or leave blank';
      SHIPPING_RATES[z] = v;
    }
    if (Object.keys(rateErrors).length) {
      setErrors(rateErrors);
      flash('Please fix the highlighted fields');
      return;
    }
    setBusy(true);
    try {
      const config: Record<string, string | boolean> = { ...draft.config };
      for (const z of RATE_ZONES) delete config[`RATE_${z}`];
      await settings.save({ ...draft, config, SHIPPING_RATES });
      setErrors({});
      setDraft({ ...draft, password: '', passwordConfirm: '' });
      setUser({ name: draft.name, email: draft.email });
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['config'] });
      void qc.invalidateQueries({ queryKey: ['colors'] });
      void qc.invalidateQueries({ queryKey: ['inventory-summary'] });
      flash('Settings saved');
    } catch (e) {
      if (e instanceof SettingsValidationError) {
        setErrors(e.fields);
        flash('Please fix the highlighted fields');
      } else {
        flash('Could not save settings');
      }
    } finally {
      setBusy(false);
    }
  };

  const err = (key: string) => errors[key] || '';
  const invalid = (key: string) => (err(key) ? { borderColor: 'var(--red-line)' } : undefined);
  const messagePreview = String(draft.config.shipMsg ?? '')
    .replace('{name}', 'Anjali')
    .replace('{order}', 'AJ1052')
    .replace('{link}', 'shiprocket.co/tracking/1234567890');

  return (
    <>
      <PageHeader
        title="Settings"
        sub="Store details, shipping, tracking, colours and your login."
        actions={[{ label: 'Save settings', onClick: () => void save(), primary: true }]}
      />

      <div className={s.screen}>
        <section className={s.section}>
          <h2 className={s.h2}>Store contact</h2>
          <div className={s.grid}>
            <label className={f.label}>
              WhatsApp number
              <input
                inputMode="numeric"
                value={String(draft.config.WHATSAPP_NUMBER)}
                onChange={(e) => setConfig('WHATSAPP_NUMBER', e.target.value)}
                placeholder="919876543210"
                className={f.input}
                style={invalid('wa')}
              />
              {err('wa') && (
                <span role="alert" className={f.error}>
                  {err('wa')}
                </span>
              )}
            </label>
            <label className={f.label}>
              Email
              <input
                type="email"
                value={String(draft.config.EMAIL)}
                onChange={(e) => setConfig('EMAIL', e.target.value)}
                className={f.input}
                style={invalid('email')}
              />
              {err('email') && (
                <span role="alert" className={f.error}>
                  {err('email')}
                </span>
              )}
            </label>
            <label className={f.label}>
              Instagram handle
              <input
                value={String(draft.config.INSTAGRAM_HANDLE)}
                onChange={(e) => setConfig('INSTAGRAM_HANDLE', e.target.value)}
                className={f.input}
              />
            </label>
          </div>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>Shipping, fees and payments</h2>
          <div className={s.grid}>
            <label className={f.label}>
              Free shipping above (₹)
              <input
                inputMode="numeric"
                value={String(draft.config.FREE_SHIPPING_THRESHOLD)}
                onChange={(e) => setConfig('FREE_SHIPPING_THRESHOLD', e.target.value)}
                className={f.input}
              />
            </label>
            <label className={f.label}>
              Standard shipping fee (used where a zone is left blank)
              <input
                inputMode="numeric"
                value={String(draft.config.SHIPPING_FEE)}
                onChange={(e) => setConfig('SHIPPING_FEE', e.target.value)}
                className={f.input}
              />
            </label>
            <label className={f.label}>
              Shipping to home state (Kerala) (₹)
              <input
                inputMode="decimal"
                value={String(draft.config.RATE_home ?? '')}
                onChange={(e) => setConfig('RATE_home', e.target.value)}
                placeholder={String(draft.config.SHIPPING_FEE)}
                className={f.input}
                style={invalid('RATE_home')}
              />
              {err('RATE_home') && (
                <span role="alert" className={f.error}>
                  {err('RATE_home')}
                </span>
              )}
            </label>
            <label className={f.label}>
              Shipping to rest of India (₹)
              <input
                inputMode="decimal"
                value={String(draft.config.RATE_rest ?? '')}
                onChange={(e) => setConfig('RATE_rest', e.target.value)}
                placeholder={String(draft.config.SHIPPING_FEE)}
                className={f.input}
                style={invalid('RATE_rest')}
              />
              {err('RATE_rest') && (
                <span role="alert" className={f.error}>
                  {err('RATE_rest')}
                </span>
              )}
            </label>
            <label className={f.label}>
              Shipping to remote areas (₹)
              <input
                inputMode="decimal"
                value={String(draft.config.RATE_remote ?? '')}
                onChange={(e) => setConfig('RATE_remote', e.target.value)}
                placeholder={String(draft.config.SHIPPING_FEE)}
                className={f.input}
                style={invalid('RATE_remote')}
              />
              {err('RATE_remote') && (
                <span role="alert" className={f.error}>
                  {err('RATE_remote')}
                </span>
              )}
            </label>
            <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 12, color: 'var(--ink-muted)' }}>
              Blank = standard shipping fee. Zone is decided from the delivery PIN code. Remote = J&amp;K, Ladakh, Sikkim,
              the north-eastern states, Andaman &amp; Nicobar and Lakshadweep.
            </p>
            <label className={f.label}>
              Gift wrap fee (₹)
              <input
                inputMode="numeric"
                value={String(draft.config.GIFT_WRAP_FEE)}
                onChange={(e) => setConfig('GIFT_WRAP_FEE', e.target.value)}
                className={f.input}
              />
            </label>
            <label className={f.label}>
              Same-day dispatch cut-off
              <select
                value={String(draft.config.DISPATCH_CUTOFF_HOUR)}
                onChange={(e) => setConfig('DISPATCH_CUTOFF_HOUR', e.target.value)}
                className={f.select}
              >
                {dispatchCutoffs.map((h) => (
                  <option key={h} value={String(h)}>
                    {h > 12 ? h - 12 : h}:00 {h >= 12 ? 'pm' : 'am'}
                  </option>
                ))}
              </select>
            </label>
            <label className={f.label}>
              Payment provider
              <select
                value={String(draft.config.PAYMENT_PROVIDER)}
                onChange={(e) => setConfig('PAYMENT_PROVIDER', e.target.value)}
                className={f.select}
              >
                <option value="razorpay">Razorpay</option>
                <option value="cashfree">Cashfree</option>
              </select>
            </label>
            <label className={f.label}>
              Low stock warning at
              <input
                inputMode="numeric"
                value={String(draft.config.LOW_STOCK)}
                onChange={(e) => setConfig('LOW_STOCK', e.target.value)}
                className={f.input}
              />
            </label>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <h2 className={s.h2}>Order tracking</h2>
            <p className={s.note}>
              Couriers you ship with. <code className={s.code}>{'{awb}'}</code> in the link is
              replaced by the tracking number.
            </p>
          </div>

          <div className={s.rows}>
            {draft.couriers.map((c, i) => (
              <div key={i} className={s.courierRow}>
                <input
                  aria-label="Courier name"
                  value={c.name}
                  onChange={(e) =>
                    set({
                      couriers: draft.couriers.map((y, k) =>
                        k === i ? { ...y, name: e.target.value } : y,
                      ),
                    })
                  }
                  placeholder="Courier"
                  className={f.input}
                />
                <input
                  aria-label="Tracking link"
                  value={c.url}
                  onChange={(e) =>
                    set({
                      couriers: draft.couriers.map((y, k) =>
                        k === i ? { ...y, url: e.target.value } : y,
                      ),
                    })
                  }
                  placeholder="https://…/{awb}"
                  className={f.input}
                />
                <button
                  type="button"
                  aria-label="Remove courier"
                  onClick={() => set({ couriers: draft.couriers.filter((_, k) => k !== i) })}
                  className={s.removeBtn}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                set({
                  couriers: [
                    ...draft.couriers,
                    { id: '', name: '', url: 'https://example.com/track/{awb}' },
                  ],
                })
              }
              className={s.addBtn}
            >
              + Add courier
            </button>
          </div>

          <div className={s.grid}>
            <label className={f.label}>
              Default courier
              <select
                value={String(draft.config.defaultCourier)}
                onChange={(e) => setConfig('defaultCourier', e.target.value)}
                className={f.select}
              >
                {draft.couriers.map((c, i) => (
                  <option key={i} value={c.id || c.name}>
                    {c.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </label>
            <div className={s.toggleRow}>
              <span className={s.toggleText}>
                <span className={s.toggleTitle}>WhatsApp tracking message</span>
                <span className={s.toggleSub}>
                  Show a “Send tracking” button once an order ships.
                </span>
              </span>
              <Switch
                on={!!draft.config.notifyOnShip}
                onChange={(v) => setConfig('notifyOnShip', v)}
                label="WhatsApp tracking message"
              />
            </div>
          </div>

          <label className={f.label}>
            Message template
            <textarea
              rows={2}
              value={String(draft.config.shipMsg)}
              onChange={(e) => setConfig('shipMsg', e.target.value)}
              className={f.textarea}
            />
            <span className={s.preview}>Preview: {messagePreview}</span>
          </label>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <h2 className={s.h2}>Offline sale places</h2>
            <p className={s.note}>Where you sell in person. Used to filter offline sales.</p>
          </div>
          <div className={s.rows}>
            {draft.locations.map((l, i) => (
              <div key={i} className={s.locationRow}>
                <input
                  aria-label="Place"
                  value={l}
                  onChange={(e) =>
                    set({
                      locations: draft.locations.map((y, k) => (k === i ? e.target.value : y)),
                    })
                  }
                  className={f.input}
                />
                <button
                  type="button"
                  aria-label="Remove place"
                  onClick={() => set({ locations: draft.locations.filter((_, k) => k !== i) })}
                  className={s.removeBtn}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set({ locations: [...draft.locations, ''] })}
              className={s.addBtn}
            >
              + Add place
            </button>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <h2 className={s.h2}>Colours</h2>
            <p className={s.note}>
              Finishes a product can come in. Shown as swatches on the store and in the shop
              filter.
            </p>
            {err('colors') && (
              <span role="alert" className={f.error}>
                {err('colors')}
              </span>
            )}
          </div>

          <div className={s.colorGrid}>
            {draft.colors.map((c, i) => {
              const used = inUse.includes(c.key);
              return (
                <div key={i} className={s.colorRow}>
                  <input
                    type="color"
                    aria-label="Colour"
                    value={c.hex}
                    onChange={(e) =>
                      set({
                        colors: draft.colors.map((y, k) =>
                          k === i ? { ...y, hex: e.target.value.toUpperCase() } : y,
                        ),
                      })
                    }
                    className={s.swatch}
                  />
                  <input
                    aria-label="Colour name"
                    value={c.label}
                    onChange={(e) => {
                      set({
                        colors: draft.colors.map((y, k) =>
                          k === i ? { ...y, label: e.target.value } : y,
                        ),
                      });
                      setErrors((x) => ({ ...x, colors: '' }));
                    }}
                    placeholder="e.g. Antique Gold"
                    className={`${f.input} ${s.colorName}`}
                  />
                  {used ? (
                    <span title="In use by products" className={s.inUse}>
                      in use
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label="Remove colour"
                      onClick={() => set({ colors: draft.colors.filter((_, k) => k !== i) })}
                      className={s.removeBtn}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => set({ colors: [...draft.colors, { key: '', label: '', hex: '#C79A45' }] })}
            className={s.addBtn}
          >
            + Add colour
          </button>
        </section>

        <section className={s.section}>
          <h2 className={s.h2}>Your login</h2>
          <div className={s.grid}>
            <label className={f.label}>
              Name
              <input
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                className={f.input}
              />
            </label>
            <label className={f.label}>
              Login email
              <input
                type="email"
                value={draft.email}
                onChange={(e) => {
                  set({ email: e.target.value });
                  setErrors((x) => ({ ...x, login: '' }));
                }}
                className={f.input}
                style={invalid('login')}
              />
              {err('login') && (
                <span role="alert" className={f.error}>
                  {err('login')}
                </span>
              )}
            </label>
            <label className={f.label}>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => {
                  set({ password: e.target.value });
                  setErrors((x) => ({ ...x, pass: '' }));
                }}
                placeholder="Leave empty to keep"
                className={f.input}
                style={invalid('pass')}
              />
              {err('pass') && (
                <span role="alert" className={f.error}>
                  {err('pass')}
                </span>
              )}
            </label>
            <label className={f.label}>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={draft.passwordConfirm}
                onChange={(e) => {
                  set({ passwordConfirm: e.target.value });
                  setErrors((x) => ({ ...x, pass: '' }));
                }}
                className={f.input}
              />
            </label>
          </div>
        </section>

        <div className={s.footer}>
          <span className={s.note}>
            Changes apply to the store as soon as they are saved.
          </span>
          <button type="button" onClick={() => void save()} disabled={busy} className={s.save}>
            Save settings
          </button>
        </div>
      </div>
    </>
  );
}

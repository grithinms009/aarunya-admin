import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_IMAGES,
  OFFER_LINKS,
  media,
  storefront,
  type StorefrontContent,
} from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Switch } from '@/components/ui/controls';
import { useViewport } from '@/hooks/useViewport';
import { num } from '@/lib/format';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import s from './StorefrontPage.module.css';
import type { Banners, Offer } from '@/data/types';

const STORE_URL = import.meta.env.VITE_STORE_URL ?? 'http://localhost:5173';

export function StorefrontPage() {
  const { w, desk } = useViewport();
  const qc = useQueryClient();
  const flash = useUi((st) => st.flash);

  const { data: loaded } = useQuery({
    queryKey: ['storefront-content'],
    queryFn: storefront.content,
  });

  const [draft, setDraft] = useState<StorefrontContent | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loaded && !draft) setDraft(structuredClone(loaded));
  }, [loaded, draft]);

  if (!draft) return null;

  const setBanners = (patch: Partial<Banners>) => {
    setDraft({ ...draft, banners: { ...draft.banners, ...patch } });
    setDirty(true);
  };
  const setOffer = (i: number, patch: Partial<Offer>) => {
    setDraft({
      ...draft,
      offers: draft.offers.map((o, k) => (k === i ? { ...o, ...patch } : o)),
    });
    setDirty(true);
  };
  const setAnnouncements = (list: string[]) => {
    setDraft({ ...draft, announcements: list });
    setDirty(true);
  };

  const pick = (apply: (url: string) => void, max = 1800) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        apply(await media.upload(file, max));
      } catch (err) {
        flash(err instanceof Error ? err.message : 'Could not read that image');
      }
    };

  const save = async () => {
    await storefront.save(draft);
    void qc.invalidateQueries({ queryKey: ['storefront-content'] });
    setDirty(false);
    flash('Storefront updated. Refresh the store to see it.');
  };

  const discard = () => {
    if (loaded) setDraft(structuredClone(loaded));
    setDirty(false);
  };

  const b = draft.banners;
  const heroCols = w >= 900 ? 'minmax(0,2fr) minmax(0,1fr)' : '1fr';
  const halfCols = w >= 900 ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr';

  return (
    <>
      <PageHeader
        title="Banners & homepage"
        sub="Images and messages on the store home page."
        actions={[
          { label: 'View store', href: STORE_URL },
          { label: 'Save changes', onClick: () => void save(), primary: true },
        ]}
      />

      <div className={s.screen}>
        <div className={s.saveBar} style={{ top: desk ? 12 : 64 }}>
          <span
            className={s.saveNote}
            style={{ color: dirty ? 'var(--orange)' : 'var(--ink-muted)' }}
          >
            {dirty ? 'You have unsaved changes' : 'Everything is saved'}
          </span>
          <span className={s.saveBtns}>
            {dirty && (
              <button type="button" onClick={discard} className={s.discard}>
                Discard
              </button>
            )}
            <button type="button" onClick={() => void save()} className={s.save}>
              Save changes
            </button>
          </span>
        </div>

        <section className={s.section}>
          <div className={s.head}>
            <h2 className={s.h2}>Main banner</h2>
            <p className={s.note}>The first image on the home page. Also used on the About page.</p>
          </div>
          <div className={s.cols} style={{ gridTemplateColumns: heroCols }}>
            <div className={s.col}>
              <span className={s.colLabel}>Desktop and tablet</span>
              <div className={s.frame}>
                <img src={b.heroDesktop} alt="" className={s.img} />
              </div>
              <div className={s.btnRow}>
                <label className={s.upload}>
                  Replace image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={pick((u) => setBanners({ heroDesktop: u }))}
                    className={s.file}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setBanners({ heroDesktop: DEFAULT_IMAGES.heroDesktop })}
                  className={s.textBtn}
                >
                  Restore original
                </button>
              </div>
            </div>
            <div className={s.col}>
              <span className={s.colLabel}>Phones</span>
              <div className={s.frame}>
                <img
                  src={b.heroMobile || b.heroDesktop}
                  alt=""
                  className={s.img}
                  style={{ maxHeight: 420, objectFit: 'contain' }}
                />
              </div>
              <span className={s.mobNote}>
                {b.heroMobile ? 'Custom image for phones' : 'Using the desktop image'}
              </span>
              <div className={s.btnRow}>
                <label className={s.upload}>
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    onChange={pick((u) => setBanners({ heroMobile: u }), 1200)}
                    className={s.file}
                  />
                </label>
                {b.heroMobile && (
                  <button
                    type="button"
                    onClick={() => setBanners({ heroMobile: '' })}
                    className={s.textBtn}
                  >
                    Use desktop image
                  </button>
                )}
              </div>
            </div>
          </div>
          <label className={f.label}>
            Image description (for screen readers and Google)
            <input
              value={b.heroAlt}
              onChange={(e) => setBanners({ heroAlt: e.target.value })}
              className={f.input}
            />
          </label>
        </section>

        <section className={s.section}>
          <div className={s.head}>
            <h2 className={s.h2}>Personalised gift banner</h2>
            <p className={s.note}>
              The button opens WhatsApp so customers can ask for engraving.
            </p>
          </div>
          <div className={s.cols} style={{ gridTemplateColumns: heroCols }}>
            <div className={s.col}>
              <span className={s.colLabel}>Banner (wide screens)</span>
              <div className={s.frame} style={{ position: 'relative' }}>
                <img src={b.personalised} alt="" className={s.img} />
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 24,
                    bottom: 20,
                    padding: '8px 16px',
                    borderRadius: 'var(--r-pill)',
                    background: 'rgba(255,250,246,.88)',
                    color: 'var(--gold-hover)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  {b.personalisedCta} →
                </span>
              </div>
              <div className={s.btnRow}>
                <label className={s.upload}>
                  Replace image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={pick((u) => setBanners({ personalised: u }))}
                    className={s.file}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setBanners({ personalised: DEFAULT_IMAGES.personalised })}
                  className={s.textBtn}
                >
                  Restore original
                </button>
              </div>
            </div>
            <div className={s.col}>
              <span className={s.colLabel}>Photo (phones)</span>
              <div className={s.frame}>
                <img
                  src={b.personalisedMobile}
                  alt=""
                  className={s.img}
                  style={{ maxHeight: 420, objectFit: 'cover' }}
                />
              </div>
              <div className={s.btnRow}>
                <label className={s.upload}>
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    onChange={pick((u) => setBanners({ personalisedMobile: u }), 1200)}
                    className={s.file}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setBanners({ personalisedMobile: DEFAULT_IMAGES.personalisedMobile })
                  }
                  className={s.textBtn}
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
          <div className={s.twoCol}>
            <label className={f.label}>
              Button text
              <input
                value={b.personalisedCta}
                onChange={(e) => setBanners({ personalisedCta: e.target.value })}
                className={f.input}
              />
            </label>
            <label className={f.label}>
              Image description
              <input
                value={b.personalisedAlt}
                onChange={(e) => setBanners({ personalisedAlt: e.target.value })}
                className={f.input}
              />
            </label>
          </div>
        </section>

        <section className={s.plain}>
          <div className={s.head}>
            <h2 className={s.h2}>Sale &amp; offers banners</h2>
            <p className={s.note}>
              The titles are part of the image, so move the button to sit under your text.
            </p>
          </div>
          <div className={s.offerGrid} style={{ gridTemplateColumns: halfCols }}>
            {draft.offers.map((o, i) => (
              <div key={o.title} className={s.offerCard}>
                <div className={s.offerHead}>
                  <h3 className={s.offerTitle}>
                    {o.title} {o.accent}
                  </h3>
                  <span className={s.showLabel}>Show</span>
                  <Switch
                    on={!o.hidden}
                    onChange={(v) => setOffer(i, { hidden: !v })}
                    label={`Show ${o.title} ${o.accent}`}
                  />
                </div>

                <div className={s.offerPreview} style={{ opacity: o.hidden ? 0.45 : 1 }}>
                  <img src={o.image} alt="" className={s.img} />
                  <span
                    aria-hidden="true"
                    className={s.cta}
                    style={{
                      left: `${o.bx}%`,
                      top: `${o.by}%`,
                      background: o.btn === 'outline' ? 'rgba(255,250,246,.78)' : '#C48F3E',
                      color: o.btn === 'outline' ? '#8A6527' : '#FFF9F6',
                      borderColor: o.btn === 'outline' ? '#C9A06A' : '#C48F3E',
                    }}
                  >
                    {o.cta} →
                  </span>
                </div>

                <div className={s.btnRow}>
                  <label className={s.upload}>
                    Replace image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={pick((u) => setOffer(i, { image: u }))}
                      className={s.file}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setOffer(i, { image: DEFAULT_IMAGES.offers[i] ?? o.image })
                    }
                    className={s.textBtn}
                  >
                    Restore original
                  </button>
                </div>

                <div className={s.twoCol}>
                  <label className={f.label}>
                    Opens
                    <select
                      value={o.match}
                      onChange={(e) => {
                        const link = OFFER_LINKS.find((l) => l[0] === e.target.value);
                        setOffer(i, {
                          match: e.target.value as Offer['match'],
                          href: link ? link[1] : o.href,
                        });
                      }}
                      className={f.select}
                    >
                      {OFFER_LINKS.map(([v, , label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={f.label}>
                    Button text
                    <input
                      value={o.cta}
                      onChange={(e) => setOffer(i, { cta: e.target.value })}
                      className={f.input}
                    />
                  </label>
                  <label className={f.label}>
                    Button from left (%)
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={0.5}
                      value={o.bx}
                      onChange={(e) =>
                        setOffer(i, { bx: Math.max(0, Math.min(90, num(e.target.value))) })
                      }
                      className={s.range}
                    />
                  </label>
                  <label className={f.label}>
                    Button from top (%)
                    <input
                      type="range"
                      min={0}
                      max={92}
                      step={0.5}
                      value={o.by}
                      onChange={(e) =>
                        setOffer(i, { by: Math.max(0, Math.min(95, num(e.target.value))) })
                      }
                      className={s.range}
                    />
                  </label>
                </div>

                <label className={f.label}>
                  Image description
                  <input
                    value={o.alt}
                    onChange={(e) => setOffer(i, { alt: e.target.value })}
                    className={f.input}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className={s.section} style={{ gap: 14 }}>
          <div className={s.head}>
            <h2 className={s.h2}>Announcement bar</h2>
            <p className={s.note}>Scrolls across the top of every page.</p>
          </div>
          <div className={s.marquee}>
            {draft.announcements.filter((x) => x.trim()).join('   ◇   ') || 'No messages'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.announcements.map((text, i) => (
              <div key={i} className={s.annRow}>
                <span className={s.annNum}>{i + 1}</span>
                <input
                  aria-label={`Message ${i + 1}`}
                  value={text}
                  onChange={(e) =>
                    setAnnouncements(
                      draft.announcements.map((y, k) => (k === i ? e.target.value : y)),
                    )
                  }
                  placeholder="e.g. Onam sale: 15% off all bangles"
                  className={`${f.input} ${s.annInput}`}
                />
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => {
                    const a = draft.announcements.slice();
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    setAnnouncements(a);
                  }}
                  className={s.iconBtn}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i >= draft.announcements.length - 1}
                  onClick={() => {
                    const a = draft.announcements.slice();
                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                    setAnnouncements(a);
                  }}
                  className={s.iconBtn}
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label="Remove message"
                  onClick={() => setAnnouncements(draft.announcements.filter((_, k) => k !== i))}
                  className={s.removeBtn}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAnnouncements([...draft.announcements, ''])}
            className={s.addBtn}
          >
            + Add message
          </button>
        </section>
      </div>
    </>
  );
}

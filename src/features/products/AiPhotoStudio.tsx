import { useState } from 'react';
import { media, type GeneratedLook } from '@/api';
import { PATH } from '@/components/ui/icons';
import type { LookKind } from '@/lib/image';
import { useUi } from '@/store/useUi';
import s from './AiPhotoStudio.module.css';
import type { Draft } from './useDraft';

const SLOTS = ['Front', 'On model', 'Detail'];

/** The five looks, from the prototype's AIK list. */
const LOOKS: [LookKind, string, string][] = [
  ['studio', 'Clean studio', 'Soft white backdrop for the main photo'],
  ['blush', 'Aarunya blush', 'Brand pink backdrop with a soft glow'],
  ['flatlay', 'Styled flat-lay', 'Warm beige tabletop with a gold frame'],
  ['detail', 'Close-up detail', 'Zoomed crop that shows texture'],
  ['model', 'On model', 'Worn by a model. Needs the image AI connection'],
];

const LOOK_LABEL = Object.fromEntries(LOOKS.map(([k, l]) => [k, l])) as Record<LookKind, string>;

interface Props {
  draft: Draft;
  /** Variant index and photo slot the studio was opened from. */
  vi: number;
  si: number;
  colorLabel: (key: string) => string;
  onUse: (slot: number, url: string) => void;
  onClose: () => void;
}

export function AiPhotoStudio({ draft, vi, si, colorLabel, onUse, onClose }: Props) {
  const flash = useUi((st) => st.flash);
  const variant = draft.variants[vi];

  /** Start from a photo already on this colour, else any photo on the product. */
  const initialSrc =
    variant?.images.find(Boolean) ??
    draft.variants.find((x) => x.images.some(Boolean))?.images.find(Boolean) ??
    '';

  const [src, setSrc] = useState(initialSrc);
  const [kinds, setKinds] = useState<LookKind[]>(['studio', 'blush', 'detail']);
  const [notes, setNotes] = useState('');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GeneratedLook[]>([]);
  const [usedAs, setUsedAs] = useState<Record<number, string>>({});

  if (!variant) return null;

  const pool = [...new Set(draft.variants.flatMap((x) => x.images).filter(Boolean))].slice(0, 8);
  const canGenerate = !!src && kinds.length > 0;
  const total = kinds.length * count;

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setSrc(await media.upload(file, 1200));
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Could not read that image');
    }
  };

  const generate = async () => {
    setBusy(true);
    setResults([]);
    try {
      const ordered = LOOKS.map(([k]) => k).filter((k) => kinds.includes(k));
      setResults(await media.generateLooks(src, ordered, count));
      setUsedAs({});
    } finally {
      setBusy(false);
    }
  };

  const use = (ri: number, slot: number) => {
    const r = results[ri];
    if (!r?.src) return;
    onUse(slot, r.src);
    setUsedAs((u) => ({ ...u, [ri]: SLOTS[slot] }));
    flash(`Added as ${SLOTS[slot].toLowerCase()} photo`);
  };

  const isSetup = !busy && results.length === 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="Generate product photos" className={s.scrim}>
      <div className={s.modal}>
        <div className={s.head}>
          <div className={s.headText}>
            <span className={s.eyebrow}>
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}>
                <path d={PATH.sparkleSmall} />
              </svg>
              AI photo studio
            </span>
            <h2 className={s.title}>Generate product photos</h2>
            <span className={s.target}>
              {draft.name || 'New product'} · {colorLabel(variant.color)}
            </span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={s.close}>
            ×
          </button>
        </div>

        {isSetup && (
          <>
            <div className={s.body}>
              <div className={s.step}>
                <span className={s.stepTitle}>1. Start from a photo of the piece</span>
                <div className={s.sourceRow}>
                  <div
                    className={s.source}
                    style={src ? { backgroundImage: `url("${src}")` } : undefined}
                  >
                    {!src && <span className={s.sourceEmpty}>No photo yet</span>}
                  </div>
                  <div className={s.sourceSide}>
                    <div className={s.fileRow}>
                      <label className={s.fileBtn}>
                        Upload a photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void upload(e)}
                          className={s.file}
                        />
                      </label>
                      <label className={s.fileBtn}>
                        Take a photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => void upload(e)}
                          className={s.file}
                        />
                      </label>
                    </div>
                    <p className={s.hint}>
                      A plain phone photo is enough. Shoot in daylight on a plain surface.
                    </p>
                    {pool.length > 0 && (
                      <>
                        <span className={s.poolLabel}>Or use a photo already on this product</span>
                        <div className={s.pool}>
                          {pool.map((u) => (
                            <button
                              key={u.slice(-40)}
                              type="button"
                              aria-pressed={src === u}
                              aria-label="Use this photo"
                              onClick={() => setSrc(u)}
                              className={s.poolItem}
                              style={{
                                backgroundImage: `url("${u}")`,
                                boxShadow:
                                  src === u ? '0 0 0 2px var(--surface), 0 0 0 4px var(--gold)' : 'none',
                              }}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className={s.step}>
                <span className={s.stepTitle}>2. Choose the looks</span>
                <div className={s.kinds}>
                  {LOOKS.map(([k, label, sub]) => {
                    const on = kinds.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])
                        }
                        className={`${s.kind} ${on ? s.kindOn : ''}`}
                      >
                        <span aria-hidden="true" className={`${s.box} ${on ? s.boxOn : ''}`}>
                          {on ? '✓' : ''}
                        </span>
                        <span className={s.kindText}>
                          <span className={s.kindLabel}>{label}</span>
                          <span className={s.kindSub}>{sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className={s.notesLabel}>
                3. Notes for the AI (optional)
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. worn with a cream silk saree, soft morning light, keep the gold warm"
                  className={s.notes}
                />
              </label>

              <div className={s.countRow}>
                <span className={s.stepTitle}>Variations</span>
                <div role="group" aria-label="Variations" className={s.countGroup}>
                  {[1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={count === n}
                      onClick={() => setCount(n)}
                      className={`${s.countBtn} ${count === n ? s.countBtnOn : ''}`}
                    >
                      {n} of each
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={s.foot}>
              <p className={s.hint} style={{ flex: '1 1 260px' }}>
                Looks are composed from your photo in the browser. Once the image service is
                connected, the photo and notes are sent to it instead.
              </p>
              <button
                type="button"
                onClick={generate}
                disabled={!canGenerate}
                className={s.generate}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}>
                  <path d={PATH.sparkleSmall} />
                </svg>
                Generate {total} image{total === 1 ? '' : 's'}
              </button>
            </div>
          </>
        )}

        {busy && (
          <div className={s.busy}>
            <span aria-hidden="true" className={s.spinner} />
            <span className={s.busyTitle}>Creating your photos…</span>
            <span className={s.hint}>This usually takes a few seconds.</span>
          </div>
        )}

        {!busy && results.length > 0 && (
          <>
            <div className={s.results}>
              <p className={s.lede}>
                Pick where each photo goes. The highlighted button fills the{' '}
                {SLOTS[si].toLowerCase()} slot you opened this from.
              </p>
              <div className={s.resultsGrid}>
                {results.map((r, ri) => (
                  <div key={`${r.kind}-${ri}`} className={s.result}>
                    {r.pending ? (
                      <div className={s.resultPending}>
                        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>On-model photo</span>
                        Generated once the image AI service is connected.
                      </div>
                    ) : (
                      <div
                        role="img"
                        aria-label={LOOK_LABEL[r.kind]}
                        className={s.resultImg}
                        style={{ backgroundImage: `url("${r.src}")` }}
                      />
                    )}
                    <span className={s.resultLabel}>
                      {LOOK_LABEL[r.kind]}
                      {usedAs[ri] && (
                        <span className={s.used}>Added as {usedAs[ri].toLowerCase()}</span>
                      )}
                    </span>
                    {!r.pending && (
                      <div className={s.useRow}>
                        {SLOTS.map((label, slot) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => use(ri, slot)}
                            className={`${s.useBtn} ${slot === si ? s.useBtnOn : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className={s.foot}>
              <button type="button" onClick={() => setResults([])} className={s.ghost}>
                Change settings
              </button>
              <button type="button" onClick={onClose} className={s.generate}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

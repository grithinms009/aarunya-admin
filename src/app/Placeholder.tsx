import { PageHeader } from '@/components/layout/PageHeader';

/** Temporary stand-in for a screen that has not been built yet. Removed as each screen lands. */
export function Placeholder({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <PageHeader title={title} sub={sub} />
      <div
        style={{
          background: 'var(--surface)',
          border: '1px dashed var(--line)',
          borderRadius: 'var(--r)',
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--ink-muted)',
          fontSize: 13.5,
        }}
      >
        This screen is next in the build queue.
      </div>
    </>
  );
}

/** CSV building and download, as the prototype's csv()/download() helpers did. */

export type Cell = string | number | boolean | null | undefined;

export const toCsv = (rows: Cell[][]): string =>
  rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? '' : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');

export function downloadFile(name: string, text: string, type = 'text/csv'): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export const downloadCsv = (name: string, rows: Cell[][]): void =>
  downloadFile(name, toCsv(rows));

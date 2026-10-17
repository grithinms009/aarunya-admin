/* Uploads and the AI helpers.

   upload(): the file is downscaled in the browser, then posted to POST /api/admin/uploads,
   which writes it to storage and returns the URL. Only that URL is kept in the database.

   generateLooks(): becomes a server call to the image service. The prototype's canvas
   composition stands in for it, and the on-model look stays pending, exactly as the
   prototype shows it.

   writeDescription(): becomes a server call to Claude with this prompt. The offline
   fallback is a plain sentence, never invented copy dressed up as a model's output. */
import { composeLook, resizeFile, type LookKind } from '@/lib/image';
import { req } from './client';

export interface GeneratedLook {
  kind: LookKind;
  src: string;
  /** True when the look needs the image service that isn't connected yet. */
  pending: boolean;
}

export interface DescriptionInput {
  name: string;
  category: string;
  material: string;
  colours: string[];
}

export const media = {
  /** Downscales in the browser, then stores it server-side and returns the URL. */
  async upload(
    file: File,
    max = 1000,
    purpose: 'product' | 'category' | 'banner' | 'offer' = 'product',
  ): Promise<string> {
    if (!/^image\//.test(file.type)) throw new Error('Please choose an image file');
    const data = await resizeFile(file, max);
    const { url } = await req<{ url: string }>('/admin/uploads', {
      method: 'POST',
      body: { data, purpose },
    });
    return url;
  },

  async generateLooks(src: string, kinds: LookKind[], count: number): Promise<GeneratedLook[]> {
    const t0 = Date.now();
    const out: GeneratedLook[] = [];
    for (const kind of kinds) {
      for (let n = 0; n < count; n++) {
        if (kind === 'model') {
          out.push({ kind, src: '', pending: true });
          continue;
        }
        try {
          out.push({ kind, src: await composeLook(src, kind, n), pending: false });
        } catch (e) {
          console.warn('compose failed', e);
        }
      }
    }
    /* Hold the spinner for a moment so the step reads as work, as the prototype does. */
    await new Promise((r) => setTimeout(r, Math.max(0, 1500 - (Date.now() - t0))));
    return out;
  },

  async writeDescription(input: DescriptionInput): Promise<string> {
    const stem = input.category.replace(/^Anti-Tarnish\s+/i, '').toLowerCase().replace(/s$/, '');
    return `A ${stem} with an anti-tarnish finish, light enough for everyday wear and pretty for family functions.`;
  },
};

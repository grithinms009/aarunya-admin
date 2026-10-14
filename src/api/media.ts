/* Uploads and the AI helpers.

   upload(): becomes POST /api/admin/uploads/sign followed by a direct PUT to object
   storage; the API returns the 1600px URL and a 400px thumb. Until then the file is
   downscaled in the browser and kept as a data URL so the admin works with no backend.

   generateLooks(): becomes a server call to the image service. The prototype's canvas
   composition stands in for it, and the on-model look stays pending, exactly as the
   prototype shows it.

   writeDescription(): becomes a server call to Claude with this prompt. The offline
   fallback is a plain sentence, never invented copy dressed up as a model's output. */
import { composeLook, resizeFile, type LookKind } from '@/lib/image';
import { reply } from './mock/store';

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
  async upload(file: File, max = 1000): Promise<string> {
    if (!/^image\//.test(file.type)) throw new Error('Please choose an image file');
    return resizeFile(file, max);
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
    return reply(
      `A ${stem} with an anti-tarnish finish, light enough for everyday wear and pretty for family functions.`,
      400,
    );
  },
};

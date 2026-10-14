/* Client-side image helpers.

   resizeFile keeps uploads small. In production the admin asks the API for a signed
   upload URL and the API writes the 1600px and 400px renditions, so this becomes a
   pre-upload downscale only.

   composeLook is the prototype's canvas stand-in for an image-generation service: it
   places the photo on a studio backdrop so the AI photo studio can be used end to end
   before an image provider is connected. */

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

const readFile = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

export async function resizeFile(file: File, max = 1000, quality = 0.84): Promise<string> {
  const img = await loadImage(await readFile(file));
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * r);
  c.height = Math.round(img.height * r);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export type LookKind = 'studio' | 'blush' | 'flatlay' | 'detail' | 'model';

function roundRect(
  x: CanvasRenderingContext2D,
  X: number, Y: number, W: number, H: number, R: number,
): void {
  x.beginPath();
  x.moveTo(X + R, Y);
  x.arcTo(X + W, Y, X + W, Y + H, R);
  x.arcTo(X + W, Y + H, X, Y + H, R);
  x.arcTo(X, Y + H, X, Y, R);
  x.arcTo(X, Y, X + W, Y, R);
  x.closePath();
}

export async function composeLook(src: string, kind: LookKind, alt = 0): Promise<string> {
  const img = await loadImage(src);
  const S = 900;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const x = c.getContext('2d')!;
  if (alt) {
    x.translate(S, 0);
    x.scale(-1, 1);
  }

  if (kind === 'detail') {
    const side = Math.min(img.width, img.height) * (alt ? 0.45 : 0.58);
    x.drawImage(
      img,
      (img.width - side) / 2, (img.height - side) / 2, side, side,
      0, 0, S, S,
    );
    return c.toDataURL('image/jpeg', 0.86);
  }

  let g: CanvasGradient;
  if (kind === 'flatlay') {
    g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#F4E9DC');
    g.addColorStop(1, '#E3D0BA');
  } else if (kind === 'blush') {
    g = x.createRadialGradient(S / 2, S * 0.4, S * 0.05, S / 2, S / 2, S * 0.8);
    g.addColorStop(0, '#FFF8F6');
    g.addColorStop(1, alt ? '#F1D4D6' : '#F5DFDC');
  } else {
    g = x.createRadialGradient(S / 2, S * 0.45, S * 0.1, S / 2, S / 2, S * 0.8);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, '#F3F0EE');
  }
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);

  const box = (kind === 'flatlay' ? 0.62 : 0.7) * (alt ? 1.08 : 1);
  const r = Math.min((S * box) / img.width, (S * box) / img.height);
  const w = img.width * r;
  const h = img.height * r;
  const X = (S - w) / 2;
  const Y = (S - h) / 2 - S * 0.02;

  x.save();
  x.shadowColor = 'rgba(48,39,34,.20)';
  x.shadowBlur = 40;
  x.shadowOffsetY = 18;
  x.fillStyle = '#FFFFFF';
  roundRect(x, X, Y, w, h, 16);
  x.fill();
  x.restore();

  x.save();
  roundRect(x, X, Y, w, h, 16);
  x.clip();
  x.drawImage(img, X, Y, w, h);
  x.restore();

  if (kind === 'flatlay') {
    x.strokeStyle = 'rgba(199,154,69,.55)';
    x.lineWidth = 2;
    roundRect(x, X - 18, Y - 18, w + 36, h + 36, 26);
    x.stroke();
  }
  return c.toDataURL('image/jpeg', 0.86);
}

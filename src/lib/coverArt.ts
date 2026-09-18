// Generates a branded AI-style cover image for a material entirely in code
// (canvas-drawn, navy + gold, matching the academy logo aesthetic).
// Returns a data-URL PNG the admin can preview, regenerate or upload.

const PALETTES: { bg: [string, string]; accent: string }[] = [
  { bg: ['#14094d', '#28138c'], accent: '#f2b90d' },
  { bg: ['#0c0633', '#1d0d6b'], accent: '#f7cd4d' },
  { bg: ['#1d0d6b', '#3d1fa8'], accent: '#fbe08f' },
  { bg: ['#14094d', '#4a2b0a'], accent: '#f2b90d' },
];

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

export function generateCoverDataUrl(opts: {
  title: string;
  category: string;
  department: string;
  variant?: number;
}): string {
  const { title, category, department } = opts;
  const W = 800;
  const H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const pal = PALETTES[(opts.variant ?? 0) % PALETTES.length];

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, pal.bg[0]);
  grad.addColorStop(1, pal.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative gold circles
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.12, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.9, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Top brand bar
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = pal.accent;
  ctx.font = '700 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('DE-LITMUS ACADEMY', W / 2, 80);
  ctx.font = '400 20px Georgia, serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText('W E   K E E P   M O V I N G', W / 2, 115);
  ctx.globalAlpha = 1;

  // Category pill
  ctx.font = '700 30px Arial, sans-serif';
  const cat = (category || 'GENERAL').toUpperCase();
  const pillW = Math.min(W - 160, ctx.measureText(cat).width + 70);
  const pillX = (W - pillW) / 2;
  const pillY = 165;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  (ctx as any).roundRect(pillX, pillY, pillW, 62, 31);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.accent;
  ctx.textBaseline = 'middle';
  ctx.fillText(cat, W / 2, pillY + 33);

  // Title (wrapped, large serif)
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px Georgia, serif';
  const lines = wrapLines(ctx, title || 'Untitled Material', W - 140);
  const fs = lines.length > 2 ? 52 : 64;
  ctx.font = `800 ${fs}px Georgia, serif`;
  const relines = wrapLines(ctx, title || 'Untitled Material', W - 140);
  const startY = 420 - ((relines.length - 1) * (fs + 12)) / 2;
  relines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, startY + i * (fs + 12));
  });

  // Divider
  ctx.fillStyle = pal.accent;
  ctx.fillRect(W / 2 - 70, 640, 140, 5);

  // Department
  ctx.font = '600 32px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const deptLines = wrapLines(ctx, department || '', W - 180);
  deptLines.slice(0, 2).forEach((ln, i) => {
    ctx.fillText(ln, W / 2, 700 + i * 44);
  });

  // Book icon (simple gold spine)
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 6;
  const bx = W / 2 - 55;
  const by = 800;
  ctx.strokeRect(bx, by, 110, 130);
  ctx.beginPath();
  ctx.moveTo(bx + 22, by);
  ctx.lineTo(bx + 22, by + 130);
  ctx.stroke();

  // Footer
  ctx.font = '400 22px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Academy Library Edition', W / 2, H - 40);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return canvas.toDataURL('image/png');
}

export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:(.*?);/) || [])[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

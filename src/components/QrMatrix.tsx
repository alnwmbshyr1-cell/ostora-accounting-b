import React, { useMemo } from 'react';
import QRCode from 'qrcode';

export const HealthScoreRing: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-[108px] h-[108px] shrink-0">
      <svg width="108" height="108" viewBox="0 0 108 108" className="-rotate-90">
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="rgba(201, 162, 39, 0.22)"
          strokeWidth="9"
        />
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="#C9A227"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 350ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-2xl font-extrabold tabular-nums leading-none">{score}</span>
        <span className="text-[10px] text-white/80 mt-1 text-center px-2 leading-tight">{label}</span>
      </div>
    </div>
  );
};

export const QrMatrix: React.FC<{ data: string; size?: number }> = ({ data, size = 124 }) => {
  const { moduleSize, rects } = useMemo(() => {
    try {
      const qr = QRCode.create(data || 'OSTORA', { errorCorrectionLevel: 'M' });
      const n = qr.modules.size;
      const items: { x: number; y: number }[] = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.modules.get(r, c)) {
            items.push({ x: c, y: r });
          }
        }
      }
      return { moduleSize: n, rects: items };
    } catch {
      return { moduleSize: 21, rects: [] };
    }
  }, [data]);

  const quietZone = 4;
  const viewSize = moduleSize + quietZone * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      shapeRendering="crispEdges"
      className="bg-white rounded-lg border border-slate-300 shrink-0"
      role="img"
      aria-label="ZATCA Phase-1 QR Code"
    >
      <rect width={viewSize} height={viewSize} fill="#FFFFFF" />
      {rects.map((pt) => (
        <rect
          key={`${pt.y}-${pt.x}`}
          x={pt.x + quietZone}
          y={pt.y + quietZone}
          width={1}
          height={1}
          fill="#000000"
        />
      ))}
    </svg>
  );
};

export const BarcodeSvg: React.FC<{ code: string; height?: number }> = ({ code, height = 26 }) => {
  const bars = useMemo(() => {
    const clean = code.replace(/\D/g, '') || '6281001000001';
    const widths: { x: number; w: number }[] = [];
    let x = 2;
    widths.push({ x, w: 1.5 }, { x: x + 3, w: 1.5 });
    x += 7;
    for (let i = 0; i < clean.length; i++) {
      const d = parseInt(clean[i], 10);
      const w1 = (d % 3) + 1;
      const g1 = ((d >> 1) % 2) + 1;
      const w2 = ((d + 1) % 2) + 1;
      widths.push({ x, w: w1 });
      x += w1 + g1;
      widths.push({ x, w: w2 });
      x += w2 + 1.5;
    }
    widths.push({ x, w: 1.5 }, { x: x + 3, w: 1.5 });
    return { totalW: x + 6, widths };
  }, [code]);

  return (
    <svg
      height={height}
      viewBox={`0 0 ${bars.totalW} ${height}`}
      className="bg-white px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
      aria-label={`Barcode ${code}`}
    >
      {bars.widths.map((b, i) => (
        <rect key={i} x={b.x} y={2} width={b.w} height={height - 4} fill="#0F172A" />
      ))}
    </svg>
  );
};

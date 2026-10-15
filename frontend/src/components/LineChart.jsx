import { useState } from 'react';
import { cn } from '@/lib/utils';

// Small multi-series line chart (SVG). series: [{ key, label, values: number[], color, dashed? }]
// Hover anywhere shows a crosshair + tooltip with every series' value for that x.
const W = 600, H = 200, PAD = { t: 12, r: 8, b: 24, l: 8 };

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] || pts[i], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], [x3, y3] = pts[i + 2] || pts[i + 1];
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6], c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x2},${y2}`;
  }
  return d;
}

export default function LineChart({ labels, series, format = String, className, ariaLabel }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, labels.length - 1);
  const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const step = (W - PAD.l - PAD.r) / Math.max(1, labels.length - 1);

  return (
    <div className={cn('relative', className)}>
      <div className="mb-2 flex justify-end gap-4 text-xs text-muted-foreground">
        {series.map(s => (
          <span key={s.key} className="flex items-center gap-1.5">
            <svg width="16" height="2" aria-hidden><line x1="0" y1="1" x2="16" y2="1" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} /></svg>
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full overflow-visible" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        {[0, 0.5, 1].map(f => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)}
            stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map(s => (
          <path key={s.key} d={smoothPath(s.values.map((v, i) => [x(i), y(v)]))} fill="none" stroke={s.color} strokeWidth="2"
            strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            {series.map(s => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="var(--card)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          </>
        )}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-0.5 text-[11px] text-muted-foreground">
        {labels.map((l, i) => <span key={i} className={cn(i === labels.length - 1 && 'font-medium text-foreground')}>{l}</span>)}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute top-6 z-10 min-w-36 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: `clamp(72px, ${(x(hover) / W) * 100}%, calc(100% - 72px))` }}>
          <p className="mb-1 font-medium">{labels[hover]}</p>
          {series.map(s => (
            <p key={s.key} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{s.label}</span><span className="font-medium tabular">{format(s.values[hover])}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

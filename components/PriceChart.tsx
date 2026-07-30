"use client";

type Point = { label: string; value: number };

export default function PriceChart({ points }: { points: Point[] }) {
  const width = 900;
  const height = 300;
  const padding = 24;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, max * 0.02, 0.000001);

  const coords = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - min) / span) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <div className="chart-wrap" aria-label="Gráfico de precios">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1="24" x2="876" y1={height * ratio} y2={height * ratio} className="grid-line" />
        ))}
        <polygon points={`${padding},${height - padding} ${coords.join(" ")} ${width - padding},${height - padding}`} fill="url(#chartFill)" />
        <polyline points={coords.join(" ")} fill="none" className="price-line" />
      </svg>
    </div>
  );
}

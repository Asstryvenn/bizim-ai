interface StatsCardProps {
  icon: string;
  label: string;
  value: number | string;
  hint?: string;
  index?: number;
}

// Карточка метрики для Dashboard Overview. Лёгкая анимация появления
// (fade-in-up со сдвигом по времени через index) и hover-scale —
// без сторонних библиотек анимации.
export default function StatsCard({ icon, label, value, hint, index = 0 }: StatsCardProps) {
  return (
    <div
      className="card animate-fade-in-up transition hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs text-ink/40 uppercase tracking-wide">{label}</p>
        <span className="text-xl leading-none" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-ink/40 mt-1">{hint}</p>}
    </div>
  );
}

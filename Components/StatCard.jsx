import { cn } from '@/lib/utils'

export default function StatCard({ icon, label, value, color = 'default', trend }) {
  const colorClasses = {
    default: 'text-purple-400 bg-purple-500/15 border-purple-500/20',
    blue: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
    green: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
    yellow: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
    red: 'text-red-400 bg-red-500/15 border-red-500/20',
    pink: 'text-pink-400 bg-pink-500/15 border-pink-500/20',
  }

  return (
    <div className="bg-shadow-surface rounded-xl border border-shadow-border/50 p-5 transition-all duration-300 hover:border-purple-500/40 hover:shadow-cyber group">
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-xl border', colorClasses[color])}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-shadow-muted">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-shadow-text font-cyber">{value}</p>
            {trend && (
              <span className={cn('text-xs font-medium', trend > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'

export default function Card({ children, className, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-shadow-surface border-shadow-border/50 shadow-card',
    glass: 'bg-shadow-surface/30 backdrop-blur-md border-purple-500/20 shadow-card',
    solid: 'bg-shadow-card border-shadow-border/40',
    glow: 'bg-shadow-surface border-purple-500/30 shadow-neon',
  }

  return (
    <div 
      className={cn(
        'rounded-xl border p-6 transition-all duration-300 hover:border-purple-500/40',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn('text-xl font-bold text-shadow-text', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div className={cn('mt-6 pt-4 border-t border-shadow-border/40', className)} {...props}>
      {children}
    </div>
  )
}

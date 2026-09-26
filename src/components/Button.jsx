import { Link } from 'react-router-dom'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50'

// Solid fills only: no outlines, gradients or glow
const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-ink text-white hover:bg-ink/85',
  danger: 'bg-danger-text text-white hover:bg-[#8F2A12]',
  soft: 'bg-ink/[0.06] text-ink hover:bg-ink/10',
  admin: 'bg-admin-accent text-white hover:bg-[#335A72]',
  light: 'bg-white/10 text-white hover:bg-white/15',
}

const SIZES = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10 p-0',
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  )
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  to,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const classes = [
    BASE,
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {loading && <Spinner />}
      {children}
    </>
  )

  if (to && !disabled && !loading) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  )
}
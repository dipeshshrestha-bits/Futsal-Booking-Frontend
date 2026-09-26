const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 sm:p-7',
}

export default function Card({
  as: Tag = 'div',
  padding = 'md',
  interactive = false,
  title,
  eyebrow,
  action,
  className = '',
  bodyClassName = '',
  children,
  ...rest
}) {
  const hasHeader = Boolean(title || eyebrow || action)

  return (
    <Tag
      className={[
        'rounded-2xl border bg-surface',
        interactive ? 'transition-shadow hover:shadow-hover' : '',
        hasHeader ? '' : PADDING[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h3 className="mt-0.5 truncate text-base font-semibold">{title}</h3>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      {hasHeader ? (
        <div className={[PADDING[padding], bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      ) : (
        children
      )}
    </Tag>
  )
}

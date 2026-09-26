import Button from './Button.jsx'
import StatusPill from './StatusPill.jsx'

const ALIGN = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

// Hide less important columns on small screens
const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

/**
 * columns: [{ key, header, render?(row, i), align?: 'left'|'right'|'center',
 *             mono?: boolean, hideBelow?: 'sm'|'md'|'lg'|'xl', className? }]
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'Nothing to show yet.',
  emptyDeva,
  rowKey = 'id',
  onRowClick,
  skeletonRows = 5,
  toolbar,
  footer,
  minWidth = 640,
  className = '',
}) {
  const getKey = (row, i) =>
    typeof rowKey === 'function' ? rowKey(row, i) : (row?.[rowKey] ?? i)

  const hideClass = (col) => (col.hideBelow ? HIDE_BELOW[col.hideBelow] : '')

  const cellClass = (col) =>
    [
      ALIGN[col.align ?? 'left'],
      col.mono || col.align === 'right' ? 'num' : '',
      hideClass(col),
      col.className ?? '',
    ].join(' ')

  return (
    <div className={`overflow-hidden rounded-2xl border bg-surface ${className}`}>
      {toolbar && <div className="border-b px-4 py-3 sm:px-5">{toolbar}</div>}

      {error ? (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <StatusPill variant="danger">Error</StatusPill>
          <p className="max-w-sm text-sm text-muted">{error}</p>
          {onRetry && (
            <Button variant="soft" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth }}>
            <thead>
              <tr className="bg-[#F7F5F1]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`whitespace-nowrap px-4 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted first:pl-5 last:pr-5 ${ALIGN[col.align ?? 'left']} ${hideClass(col)}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-t">
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3.5 first:pl-5 last:pr-5 ${hideClass(col)}`}>
                        <div className={`skeleton h-4 ${col.align === 'right' ? 'ml-auto w-16' : 'w-24'}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-14 text-center">
                    <p className="text-sm text-muted">{emptyMessage}</p>
                    {emptyDeva && <p className="deva mt-1 text-xs">{emptyDeva}</p>}
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr
                    key={getKey(row, i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-t align-middle transition-colors ${
                      onRowClick ? 'cursor-pointer hover:bg-canvas/60' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 text-ink first:pl-5 last:pr-5 ${cellClass(col)}`}>
                        {col.render ? col.render(row, i) : (row?.[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {footer && <div className="border-t px-4 py-3 sm:px-5">{footer}</div>}
    </div>
  )
}
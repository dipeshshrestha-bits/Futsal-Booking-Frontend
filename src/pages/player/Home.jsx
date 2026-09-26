import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import FutsalCard from '../../components/FutsalCard.jsx'
import { Icon } from '../../components/SidebarNav.jsx'
import { getErrorMessage, publicApi, toDateInputValue, toList } from '../../services/api.js'

const CITIES = ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara']

const SORT_OPTIONS = [
  { value: '', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

const API_FILTERS = ['city', 'search', 'minPrice', 'maxPrice', 'sort']

function getUpcomingDays(count) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    return {
      value: toDateInputValue(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleDateString('en-GB', { month: 'short' }),
    }
  })
}

function chipClass(active) {
  return (
    'inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ' +
    (active ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-surface text-ink hover:border-ink/40')
  )
}

function FutsalCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-surface">
      <div className="skeleton aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2 p-3.5">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-5 w-40" />
        <div className="skeleton h-3.5 w-28" />
      </div>
    </div>
  )
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const days = useMemo(() => getUpcomingDays(7), [])

  const city = searchParams.get('city') ?? ''
  const sort = searchParams.get('sort') ?? ''
  const minPrice = searchParams.get('minPrice') ?? ''
  const maxPrice = searchParams.get('maxPrice') ?? ''
  const rawDate = searchParams.get('date')
  const selectedDate = rawDate && rawDate >= days[0].value ? rawDate : days[0].value

  const [searchText, setSearchText] = useState(() => searchParams.get('search') ?? '')
  const [showPrice, setShowPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState({ min: minPrice, max: maxPrice })
  const [priceError, setPriceError] = useState('')
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, items: [], error: null })

  const apiParams = useMemo(() => {
    const params = {}
    API_FILTERS.forEach((key) => {
      const value = searchParams.get(key)
      if (value) params[key] = value
    })
    return params
  }, [searchParams])

  const requestKey = JSON.stringify(apiParams) + '#' + reload
  const loading = result.key !== requestKey

  useEffect(() => {
    let active = true
    publicApi
      .futsals(apiParams)
      .then((data) => {
        if (active) setResult({ key: requestKey, items: toList(data), error: null })
      })
      .catch((err) => {
        if (active) {
          setResult({ key: requestKey, items: [], error: getErrorMessage(err, 'Could not load venues.') })
        }
      })
    return () => {
      active = false
    }
  }, [apiParams, requestKey])

  const updateParams = useCallback(
    (changes) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          Object.entries(changes).forEach(([key, value]) => {
            if (value === '' || value === null || value === undefined) next.delete(key)
            else next.set(key, String(value))
          })
          return next.toString() === prev.toString() ? prev : next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => updateParams({ search: searchText.trim() }), 350)
    return () => clearTimeout(timer)
  }, [searchText, updateParams])

  const togglePrice = () => {
    setPriceDraft({ min: minPrice, max: maxPrice })
    setPriceError('')
    setShowPrice((open) => !open)
  }

  const applyPrice = () => {
    const min = priceDraft.min === '' ? null : Number(priceDraft.min)
    const max = priceDraft.max === '' ? null : Number(priceDraft.max)

    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) {
      setPriceError('Enter valid positive amounts.')
      return
    }
    if (min !== null && max !== null && min > max) {
      setPriceError('Minimum price cannot be more than maximum.')
      return
    }
    updateParams({ minPrice: min ?? '', maxPrice: max ?? '' })
    setShowPrice(false)
  }

  const clearPrice = () => {
    setPriceDraft({ min: '', max: '' })
    setPriceError('')
    updateParams({ minPrice: '', maxPrice: '' })
    setShowPrice(false)
  }

  const clearAll = () => {
    setSearchText('')
    setPriceDraft({ min: '', max: '' })
    setShowPrice(false)
    setSearchParams({}, { replace: true })
  }

  const hasFilters = Boolean(city || sort || minPrice || maxPrice || searchParams.get('search'))
  const priceActive = Boolean(minPrice || maxPrice)

  return (
    <div className="player-container pb-6">
      {/* Hero */}
      <section className="pt-7 pb-5 lg:pt-10 lg:pb-6">
        <p className="eyebrow">Book a court in minutes</p>
        <h1 className="mt-2 text-[32px] leading-[1.1] font-semibold sm:text-[38px] lg:text-[44px]">
          Find a court. <br className="sm:hidden" />
          Pick a slot. Play.
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">
          No account needed. Pay cash at the venue or online with eSewa.
        </p>
      </section>

      {/* Filter panel: search, then city + date */}
      <section className="rounded-2xl border bg-surface p-4 sm:p-5">
        <label className="relative block">
          <span className="sr-only">Search venues</span>
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by venue name or area"
            className="input h-12 bg-canvas/60 pl-10"
          />
        </label>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          {/* City */}
          <div className="min-w-0">
            <p className="eyebrow mb-2">City</p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-wrap lg:px-0">
              <button type="button" className={chipClass(!city)} onClick={() => updateParams({ city: '' })}>
                All cities
              </button>
              {CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={chipClass(city === c)}
                  onClick={() => updateParams({ city: c })}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="min-w-0 lg:shrink-0">
            <p className="eyebrow mb-2">When do you want to play?</p>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0">
              {days.map((d) => {
                const active = d.value === selectedDate
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => updateParams({ date: d.value })}
                    aria-pressed={active}
                    className={
                      'flex w-[58px] shrink-0 flex-col items-center rounded-xl border py-1.5 transition-colors ' +
                      (active ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-surface hover:border-ink/40')
                    }
                  >
                    <span className={'text-[11px] leading-4 ' + (active ? 'text-white/70' : 'text-muted')}>
                      {d.label}
                    </span>
                    <span className="num text-base leading-6 font-medium">{d.day}</span>
                    <span
                      className={
                        'font-mono text-[9px] leading-3 uppercase ' + (active ? 'text-white/60' : 'text-faint')
                      }
                    >
                      {d.month}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="mt-6 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {loading ? (
            'Loading venues…'
          ) : (
            <>
              <span className="num text-ink">{result.items.length}</span>{' '}
              {result.items.length === 1 ? 'venue' : 'venues'}
            </>
          )}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePrice}
            aria-expanded={showPrice}
            className={
              'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors ' +
              (priceActive ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-surface hover:border-ink/40')
            }
          >
            Price
            {priceActive && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
          </button>

          <label className="sr-only" htmlFor="sort">
            Sort
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="input h-9 w-auto py-0 pr-8 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Price panel */}
      {showPrice && (
        <div className="mt-3 animate-slide-up rounded-2xl border bg-surface p-4 sm:ml-auto sm:max-w-md">
          <p className="eyebrow">Price per hour (Rs)</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="minPrice" className="label">Min</label>
              <input
                id="minPrice"
                type="number"
                inputMode="numeric"
                min="0"
                value={priceDraft.min}
                onChange={(e) => setPriceDraft((p) => ({ ...p, min: e.target.value }))}
                placeholder="0"
                className="input num"
              />
            </div>
            <div>
              <label htmlFor="maxPrice" className="label">Max</label>
              <input
                id="maxPrice"
                type="number"
                inputMode="numeric"
                min="0"
                value={priceDraft.max}
                onChange={(e) => setPriceDraft((p) => ({ ...p, max: e.target.value }))}
                placeholder="5000"
                className="input num"
              />
            </div>
          </div>
          {priceError && <p className="field-error">{priceError}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="soft" size="sm" onClick={clearPrice} className="flex-1">
              Clear
            </Button>
            <Button variant="secondary" size="sm" onClick={applyPrice} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <FutsalCardSkeleton key={i} />)
        ) : result.error ? (
          <div className="col-span-full rounded-2xl border bg-surface px-5 py-12 text-center">
            <p className="text-[15px] font-medium">Couldn't load venues</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{result.error}</p>
            <Button variant="soft" size="sm" className="mt-4" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : result.items.length === 0 ? (
          <div className="col-span-full rounded-2xl border bg-surface px-5 py-12 text-center">
            <div aria-hidden="true" className="stripes mx-auto h-16 w-16 rounded-full border" />
            <p className="mt-4 text-[15px] font-medium">No venues found</p>
            <p className="mt-1 text-sm text-muted">Try another city or clear your filters.</p>
            {hasFilters && (
              <Button variant="soft" size="sm" className="mt-4" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          result.items.map((futsal) => (
            <FutsalCard key={futsal.id} futsal={futsal} to={'/futsals/' + futsal.id + '?date=' + selectedDate} />
          ))
        )}
      </section>

      {/* Lookup prompt */}
      <Link
        to="/my-booking"
        className="mt-8 flex items-center gap-3 rounded-2xl border bg-surface p-4 transition-shadow hover:shadow-hover sm:p-5"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-ink">
          <Icon name="receipt" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Already booked?</span>
          <span className="block text-sm text-muted">Check or cancel with your reference code.</span>
        </span>
        <Icon name="chevronRight" className="h-5 w-5 text-faint" />
      </Link>
    </div>
  )
}
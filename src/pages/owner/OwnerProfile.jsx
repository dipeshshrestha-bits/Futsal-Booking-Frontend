import { useEffect, useState } from 'react'
import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import { Icon, PageHeader } from '../../components/SidebarNav.jsx'
import StatusPill from '../../components/StatusPill.jsx'
import { useToast } from '../../components/Toast.jsx'
import {
  formatTime,
  getErrorMessage,
  isValidNepalPhone,
  normalizePhone,
  ownerApi,
  resolveImageUrl,
} from '../../services/api.js'

const CITIES = ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Pokhara', 'Chitwan', 'Biratnagar', 'Butwal', 'Dharan']

const AMENITY_OPTIONS = [
  'Parking',
  'Changing room',
  'Showers',
  'Drinking water',
  'Floodlights',
  'Cafeteria',
  'Wi-Fi',
  'First aid',
  'Seating area',
  'Lockers',
]

const MAX_IMAGES = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_PATTERN = /^(https?:\/\/|\/)\S+$/i

const timeValue = (value) => (value ? formatTime(value) : '')

function toMinutes(time) {
  const [h, m] = String(time ?? '').split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
}

function toForm(p) {
  const images = (Array.isArray(p?.images) ? p.images : [])
    .map((img) => (typeof img === 'string' ? img : (img?.url ?? img?.imageUrl)))
    .filter(Boolean)
  const cover = p?.coverImageUrl ?? p?.coverImage ?? ''
  if (cover && !images.includes(cover)) images.unshift(cover)

  const rawAmenities = p?.amenities
  const amenities = (Array.isArray(rawAmenities) ? rawAmenities : typeof rawAmenities === 'string' ? rawAmenities.split(',') : [])
    .map((a) => (typeof a === 'string' ? a.trim() : (a?.name ?? '')))
    .filter(Boolean)

  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    address: p?.address ?? '',
    city: p?.city ?? '',
    contactNumber: p?.contactNumber ?? p?.phone ?? '',
    email: p?.email ?? '',
    openingTime: timeValue(p?.openingTime),
    closingTime: timeValue(p?.closingTime),
    amenities,
    images,
    coverImageUrl: cover || images[0] || '',
  }
}

function ImageTile({ src, isCover, index, onMakeCover, onRemove }) {
  const [failed, setFailed] = useState(false)
  const resolved = resolveImageUrl(src)

  return (
    <div className="overflow-hidden rounded-xl border bg-surface">
      <div className="relative aspect-[4/3]">
        {!failed && resolved ? (
          <img
            src={resolved}
            alt={`Venue photo ${index + 1}`}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="stripes flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted">
            Image couldn't load
          </div>
        )}
        {isCover && (
          <span className="absolute top-2 left-2">
            <StatusPill variant="success">Cover</StatusPill>
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        {isCover ? (
          <span className="px-1 text-xs text-muted">Shown first</span>
        ) : (
          <button type="button" onClick={onMakeCover} className="rounded-md px-1.5 py-1 text-xs font-medium text-ink hover:bg-ink/[0.06]">
            Set as cover
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove photo ${index + 1}`}
          className="rounded-md px-1.5 py-1 text-xs font-medium text-danger-text hover:bg-danger-bg"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

export default function OwnerProfile() {
  const toast = useToast()

  const [reload, setReload] = useState(0)
  const [result, setResult] = useState({ key: null, profile: null, error: null })
  const [form, setForm] = useState(null)
  const [initial, setInitial] = useState(null)
  const loading = result.key !== reload

  useEffect(() => {
    let active = true
    ownerApi
      .profile()
      .then((profile) => {
        if (!active) return
        const next = toForm(profile)
        setResult({ key: reload, profile, error: null })
        setForm(next)
        setInitial(next)
      })
      .catch((err) => {
        if (active) setResult({ key: reload, profile: null, error: getErrorMessage(err, 'Could not load your venue profile.') })
      })
    return () => {
      active = false
    }
  }, [reload])

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageError, setImageError] = useState('')
  const [customAmenity, setCustomAmenity] = useState('')

  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial))

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const setField = (key) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const toggleAmenity = (name) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(name) ? f.amenities.filter((a) => a !== name) : [...f.amenities, name],
    }))
  }

  const addCustomAmenity = () => {
    const value = customAmenity.trim()
    if (!value || value.length > 30) return
    if (form.amenities.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setCustomAmenity('')
      return
    }
    setForm((f) => ({ ...f, amenities: [...f.amenities, value] }))
    setCustomAmenity('')
  }

  const addImage = () => {
    const value = imageUrl.trim()
    setImageError('')
    if (!value) return
    if (!URL_PATTERN.test(value)) {
      setImageError('Paste a full image link starting with https://')
      return
    }
    if (form.images.includes(value)) {
      setImageError('That photo is already added.')
      return
    }
    if (form.images.length >= MAX_IMAGES) {
      setImageError(`You can add up to ${MAX_IMAGES} photos.`)
      return
    }
    setForm((f) => ({ ...f, images: [...f.images, value], coverImageUrl: f.coverImageUrl || value }))
    setImageUrl('')
  }

  const removeImage = (url) => {
    setForm((f) => {
      const images = f.images.filter((img) => img !== url)
      return { ...f, images, coverImageUrl: f.coverImageUrl === url ? (images[0] ?? '') : f.coverImageUrl }
    })
  }

  const validate = (values) => {
    const next = {}
    if (values.name.length < 2) next.name = 'Venue name is required.'
    else if (values.name.length > 100) next.name = 'Name must be 100 characters or less.'
    if (values.description.length > 1000) next.description = 'Description must be 1000 characters or less.'
    if (!values.address) next.address = 'Address is required.'
    else if (values.address.length > 200) next.address = 'Address must be 200 characters or less.'
    if (!values.city) next.city = 'City is required.'
    if (!values.contactNumber) next.contactNumber = 'Contact number is required.'
    else if (!isValidNepalPhone(values.contactNumber)) next.contactNumber = 'Enter a valid 10-digit mobile number.'
    if (values.email && !EMAIL_PATTERN.test(values.email)) next.email = 'Enter a valid email address.'
    if (values.openingTime || values.closingTime) {
      if (!values.openingTime) next.openingTime = 'Add an opening time.'
      else if (!values.closingTime) next.closingTime = 'Add a closing time.'
      else if (!(toMinutes(values.closingTime) > toMinutes(values.openingTime))) {
        next.closingTime = 'Closing time must be after opening time.'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!form) return
    const cleaned = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      contactNumber: form.contactNumber.trim(),
      email: form.email.trim(),
    }

    if (!validate(cleaned)) {
      toast.error('Please fix the highlighted fields.')
      return
    }

    setSaving(true)
    try {
      const response = await ownerApi.updateProfile({
        name: cleaned.name,
        description: cleaned.description,
        address: cleaned.address,
        city: cleaned.city,
        contactNumber: normalizePhone(cleaned.contactNumber),
        email: cleaned.email || null,
        openingTime: cleaned.openingTime || null,
        closingTime: cleaned.closingTime || null,
        amenities: cleaned.amenities,
        images: cleaned.images,
        coverImageUrl: cleaned.coverImageUrl || cleaned.images[0] || null,
      })
      const next = response && typeof response === 'object' && response.name ? toForm(response) : cleaned
      setForm(next)
      setInitial(next)
      toast.success('Venue profile saved')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save your profile.'))
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setForm(initial)
    setErrors({})
    setImageError('')
  }

  const header = (
    <PageHeader
      eyebrow="Venue"
      title="Venue profile"
      description="This is what players see on your listing."
      actions={
        form && (
          <Button onClick={handleSave} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        )
      }
    />
  )

  if (loading) {
    return (
      <>
        {header}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="skeleton h-72 rounded-2xl" />
            <div className="skeleton h-56 rounded-2xl" />
          </div>
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </>
    )
  }

  if (result.error || !form) {
    return (
      <>
        {header}
        <div className="rounded-2xl border bg-surface px-5 py-12 text-center">
          <StatusPill variant="danger">Error</StatusPill>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{result.error}</p>
          <Button variant="soft" size="sm" className="mt-4" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
        </div>
      </>
    )
  }

  const listingActive = result.profile?.isActive ?? !String(result.profile?.status ?? '').toLowerCase().includes('inactive')

  return (
    <div className={dirty ? 'pb-24' : ''}>
      {header}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {/* Basic info */}
          <Card eyebrow="01" title="Basic info">
            <div className="space-y-3">
              <div>
                <label htmlFor="name" className="label">Venue name</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={setField('name')}
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  maxLength={100}
                />
                {errors.name && <p className="field-error">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="description" className="label">Description</label>
                <textarea
                  id="description"
                  rows={5}
                  value={form.description}
                  onChange={setField('description')}
                  className={`input resize-y ${errors.description ? 'input-error' : ''}`}
                  placeholder="Tell players about your courts, turf quality, facilities and anything that makes your venue special."
                  maxLength={1000}
                />
                <div className="mt-1 flex justify-between">
                  {errors.description ? <p className="field-error mt-0">{errors.description}</p> : <span />}
                  <span className="num text-[11px] text-faint">{form.description.length}/1000</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="openingTime" className="label">Venue opens</label>
                  <input
                    id="openingTime"
                    type="time"
                    step="1800"
                    value={form.openingTime}
                    onChange={setField('openingTime')}
                    className={`input num ${errors.openingTime ? 'input-error' : ''}`}
                  />
                  {errors.openingTime && <p className="field-error">{errors.openingTime}</p>}
                </div>
                <div>
                  <label htmlFor="closingTime" className="label">Venue closes</label>
                  <input
                    id="closingTime"
                    type="time"
                    step="1800"
                    value={form.closingTime}
                    onChange={setField('closingTime')}
                    className={`input num ${errors.closingTime ? 'input-error' : ''}`}
                  />
                  {errors.closingTime && <p className="field-error">{errors.closingTime}</p>}
                </div>
              </div>
            </div>
          </Card>

          {/* Location & contact */}
          <Card eyebrow="02" title="Location & contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="address" className="label">Address</label>
                <input
                  id="address"
                  value={form.address}
                  onChange={setField('address')}
                  className={`input ${errors.address ? 'input-error' : ''}`}
                  placeholder="e.g. Jhamsikhel Road, near Sanepa Chowk"
                  maxLength={200}
                />
                {errors.address && <p className="field-error">{errors.address}</p>}
              </div>

              <div>
                <label htmlFor="city" className="label">City</label>
                <input
                  id="city"
                  list="city-options"
                  value={form.city}
                  onChange={setField('city')}
                  className={`input ${errors.city ? 'input-error' : ''}`}
                  maxLength={50}
                />
                <datalist id="city-options">
                  {CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {errors.city && <p className="field-error">{errors.city}</p>}
              </div>

              <div>
                <label htmlFor="contactNumber" className="label">Contact number</label>
                <input
                  id="contactNumber"
                  type="tel"
                  inputMode="tel"
                  value={form.contactNumber}
                  onChange={setField('contactNumber')}
                  className={`input num ${errors.contactNumber ? 'input-error' : ''}`}
                  placeholder="98XXXXXXXX"
                  maxLength={16}
                />
                {errors.contactNumber && <p className="field-error">{errors.contactNumber}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="email" className="label">
                  Email <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={setField('email')}
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="bookings@yourvenue.com"
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>
            </div>
          </Card>

          {/* Amenities */}
          <Card eyebrow="03" title="Amenities">
            <div className="flex flex-wrap gap-2">
              {[...new Set([...AMENITY_OPTIONS, ...form.amenities])].map((name) => {
                const active = form.amenities.includes(name)
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleAmenity(name)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      active ? 'border-ink bg-ink text-white' : 'border-hairline-strong hover:border-ink/40'
                    }`}
                  >
                    {active && <Icon name="check" className="h-3.5 w-3.5" />}
                    {name}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomAmenity()
                  }
                }}
                className="input h-10 py-0 text-sm"
                placeholder="Add another amenity"
                maxLength={30}
              />
              <Button variant="soft" size="sm" className="h-10" onClick={addCustomAmenity} disabled={!customAmenity.trim()}>
                Add
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Listing status */}
          <Card eyebrow="Listing" title="Visibility">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Status</p>
              <StatusPill variant={listingActive ? 'success' : 'warning'}>{listingActive ? 'Live' : 'Hidden'}</StatusPill>
            </div>
            <p className="mt-3 text-sm text-muted">
              {listingActive
                ? 'Your venue is visible to players and open for booking.'
                : "Your venue is hidden from players. Contact the platform admin to reactivate it."}
            </p>
          </Card>

          {/* Photos */}
          <Card eyebrow="04" title="Photos">
            <p className="text-sm text-muted">
              Paste direct image links (ending in .jpg, .png or .webp). The cover photo is shown first.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                type="url"
                inputMode="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setImageError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addImage()
                  }
                }}
                className={`input h-10 py-0 text-sm ${imageError ? 'input-error' : ''}`}
                placeholder="https://…"
              />
              <Button variant="soft" size="sm" className="h-10" onClick={addImage} disabled={!imageUrl.trim()}>
                Add
              </Button>
            </div>
            {imageError && <p className="field-error">{imageError}</p>}

            {form.images.length === 0 ? (
              <div className="stripes mt-4 flex aspect-[4/3] items-center justify-center rounded-xl border px-4 text-center text-sm text-muted">
                No photos yet. Venues with photos get more bookings.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {form.images.map((src, i) => (
                  <ImageTile
                    key={src}
                    src={src}
                    index={i}
                    isCover={src === form.coverImageUrl}
                    onMakeCover={() => setForm((f) => ({ ...f, coverImageUrl: src }))}
                    onRemove={() => removeImage(src)}
                  />
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              <span className="num">{form.images.length}</span> of <span className="num">{MAX_IMAGES}</span> photos
            </p>
          </Card>
        </div>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="glass fixed inset-x-0 bottom-0 z-20 border-t shadow-float lg:left-64">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="text-sm font-medium">You have unsaved changes</p>
            <div className="flex gap-2">
              <Button variant="soft" size="sm" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
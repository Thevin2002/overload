import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { parseNum } from '../lib/units'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-ink-300 dark:disabled:bg-ink-700',
  secondary:
    'bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-100 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700 dark:hover:bg-ink-700',
  ghost: 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: IconName; block?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors select-none disabled:cursor-not-allowed',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'lg' && 'h-13 px-5 text-base',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className,
  size = 44,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      style={{ width: size, height: size }}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl text-ink-500 transition-colors hover:bg-ink-100 active:bg-ink-200 disabled:opacity-30 dark:text-ink-400 dark:hover:bg-ink-800 dark:active:bg-ink-700',
        className,
      )}
    >
      <Icon name={icon} size={20} />
    </button>
  )
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'block w-full rounded-2xl bg-white p-4 text-left ring-1 ring-ink-200/70 dark:bg-ink-850 dark:ring-ink-800',
        onClick && 'transition-colors hover:bg-ink-50 active:bg-ink-100 dark:hover:bg-ink-800/70',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function PageHeader({ title, subtitle, right, back }: { title: string; subtitle?: ReactNode; right?: ReactNode; back?: () => void }) {
  return (
    <header className="pt-safe sticky top-0 z-20 -mx-4 mb-3 bg-ink-50/90 px-4 backdrop-blur dark:bg-ink-900/90">
      <div className="flex min-h-14 items-center gap-2 py-2">
        {back && <IconButton icon="chevronLeft" label="Back" onClick={back} className="-ml-2" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="truncate text-sm text-ink-500 dark:text-ink-400">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold tracking-wider text-ink-500 uppercase dark:text-ink-400">{children}</h2>
      {right}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'amber' | 'violet' | 'red' }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-700/25 dark:text-brand-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-600 dark:text-ink-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  )
}

const inputCls =
  'h-11 w-full rounded-xl bg-white px-3 text-[16px] ring-1 ring-ink-200 outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 dark:bg-ink-800 dark:ring-ink-700'

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputCls, className)} />
}

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputCls, 'h-auto min-h-20 py-2', className)} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputCls, 'appearance-none pr-8', className)}>
      {children}
    </select>
  )
}

/** Number field that accepts "62,5" and only commits valid numbers (or null when cleared). */
export function NumberInput({
  value,
  onChange,
  placeholder,
  className,
  decimal = true,
  ariaLabel,
  bare = false,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
  decimal?: boolean
  ariaLabel?: string
  /** no box styling (used inside Stepper) */
  bare?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value == null ? '' : String(value))
    }
  }, [value])
  return (
    <input
      aria-label={ariaLabel}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value
        if (!/^-?\d*[.,]?\d*$/.test(t)) return
        setText(t)
        const n = parseNum(t)
        last.current = n
        onChange(n)
      }}
      className={cx(bare ? 'outline-none placeholder:text-ink-400' : inputCls, 'text-center tabular-nums', className)}
    />
  )
}

/** −  [value]  +  with big tap targets. */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  placeholder,
  decimal = true,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  step: number
  min?: number
  placeholder?: string
  decimal?: boolean
  label: string
}) {
  const base = value ?? (placeholder ? parseNum(placeholder) ?? 0 : 0)
  const bump = (d: number) => onChange(Math.max(min, Math.round((base + d) * 100) / 100))
  return (
    <div className="flex min-w-0 items-center rounded-xl bg-ink-100 focus-within:ring-2 focus-within:ring-brand-500 dark:bg-ink-800">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => bump(-step)}
        className="flex h-11 w-8 shrink-0 items-center justify-center rounded-l-xl text-ink-500 active:bg-ink-200 dark:active:bg-ink-700"
      >
        <Icon name="minus" size={16} />
      </button>
      <NumberInput
        bare
        ariaLabel={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        decimal={decimal}
        className="h-11 w-full min-w-0 flex-1 bg-transparent px-0 text-[16px] font-semibold"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => bump(step)}
        className="flex h-11 w-8 shrink-0 items-center justify-center rounded-r-xl text-ink-500 active:bg-ink-200 dark:active:bg-ink-700"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T | null
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-lg font-medium transition-colors',
            size === 'md' ? 'h-10 text-sm' : 'h-8 text-xs',
            value === o.value
              ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-600 dark:text-white'
              : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center gap-3 py-1 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-700')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-5.5' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-sheet pb-safe relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl dark:bg-ink-850">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1 text-lg font-semibold">{title}</div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-ink-100 px-4 py-3 dark:border-ink-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-200 px-6 py-10 text-center dark:border-ink-700">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400">
        <Icon name={icon} size={24} />
      </div>
      <div className="font-medium">{title}</div>
      {children && <div className="mt-1 max-w-xs text-sm text-ink-500 dark:text-ink-400">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-ink-200/70 dark:bg-ink-850 dark:ring-ink-800">
      <div className="text-xs text-ink-500 dark:text-ink-400">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-ink-500 dark:text-ink-400">{sub}</div>}
    </div>
  )
}

import type { GroupBy } from '../api'

const OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'person', label: 'Person' },
  { value: 'account', label: 'Account' },
  { value: 'holding', label: 'Holding' },
]

interface Props {
  value: GroupBy
  onChange: (g: GroupBy) => void
}

// Segmented picker for how the net worth stack is broken down.
export default function GroupBySelector({ value, onChange }: Props) {
  return (
    <div className="seg" role="group" aria-label="Group by">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

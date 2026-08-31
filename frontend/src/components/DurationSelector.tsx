import { PRESETS, PRESET_LABELS, type Range, type RangePreset } from '../ranges'

interface Props {
  value: Range
  onChange: (r: Range) => void
}

// Segmented preset picker for the plots' visible window. Selecting "Custom"
// reveals two date inputs; the tiles above are driven by a separate call and
// are intentionally unaffected by this control.
export default function DurationSelector({ value, onChange }: Props) {
  function pick(preset: RangePreset) {
    if (preset === 'CUSTOM') {
      onChange({ preset: 'CUSTOM', start: value.start, end: value.end })
    } else {
      onChange({ preset })
    }
  }

  return (
    <div className="duration">
      <div className="seg" role="group" aria-label="Duration">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value.preset === p}
            onClick={() => pick(p)}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {value.preset === 'CUSTOM' && (
        <div className="custom-range">
          <input
            type="date"
            aria-label="Start date"
            className="select"
            value={value.start ?? ''}
            onChange={(e) =>
              onChange({ preset: 'CUSTOM', start: e.target.value, end: value.end })
            }
          />
          <span>to</span>
          <input
            type="date"
            aria-label="End date"
            className="select"
            value={value.end ?? ''}
            onChange={(e) =>
              onChange({ preset: 'CUSTOM', start: value.start, end: e.target.value })
            }
          />
        </div>
      )}
    </div>
  )
}

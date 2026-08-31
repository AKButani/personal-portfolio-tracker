import type { Metrics } from '../api'
import {
  formatChf,
  formatPercent,
  formatSignedChf,
} from '../format'

function signClass(v: number | null): string {
  if (v == null || v === 0) return ''
  return v > 0 ? 'pos' : 'neg'
}

export default function StatTiles({ total }: { total: Metrics }) {
  return (
    <div className="tiles">
      <div className="tile">
        <div className="tile-label">Total value</div>
        <div className="tile-value">{formatChf(total.value_chf)}</div>
        <div className="tile-sub">
          {formatChf(total.invested_chf)} invested
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">Gain / loss</div>
        <div className={`tile-value ${signClass(total.gain_chf)}`}>
          {formatSignedChf(total.gain_chf)}
        </div>
        <div className="tile-sub">since inception</div>
      </div>

      <div className="tile">
        <div className="tile-label">Simple return</div>
        <div className={`tile-value ${signClass(total.simple_return)}`}>
          {formatPercent(total.simple_return)}
        </div>
        <div className="tile-sub">gain ÷ invested</div>
      </div>

      <div className="tile">
        <div className="tile-label">IRR</div>
        <div className={`tile-value ${signClass(total.irr)}`}>
          {formatPercent(total.irr)}
        </div>
        <div className="tile-sub">annualised, money-weighted</div>
      </div>
    </div>
  )
}

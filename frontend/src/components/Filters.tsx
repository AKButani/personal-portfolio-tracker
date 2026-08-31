import type { Person } from '../api'

interface Props {
  people: Person[]
  personId: number | undefined
  onPersonChange: (id: number | undefined) => void
}

export default function Filters({ people, personId, onPersonChange }: Props) {
  return (
    <div className="filters">
      <label htmlFor="person">Person</label>
      <select
        id="person"
        className="select"
        value={personId ?? ''}
        onChange={(e) =>
          onPersonChange(e.target.value ? Number(e.target.value) : undefined)
        }
      >
        <option value="">Everyone</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}

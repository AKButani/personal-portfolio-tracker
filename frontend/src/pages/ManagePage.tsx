import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createAccount,
  createInstrument,
  createPerson,
  createPmsSnapshot,
  createTransaction,
  getAccounts,
  getInstruments,
  getPeople,
  refreshPrices,
  type Account,
  type Instrument,
  type Person,
} from '../api'

// Small helper: track a submit's pending/result state for one form.
function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function run(fn: () => Promise<unknown>, okText: string, onOk?: () => void) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      onOk?.()
      setMsg({ ok: true, text: okText })
    } catch (e) {
      setMsg({ ok: false, text: String(e) })
    } finally {
      setBusy(false)
    }
  }
  return { busy, msg, run }
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return <span className={msg.ok ? 'form-msg pos' : 'form-msg neg'}>{msg.text}</span>
}

function PersonForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const { busy, msg, run } = useSubmit()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(() => createPerson({ name }), `Added ${name}`, () => {
      setName('')
      onCreated()
    })
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Add person</h2>
      <div className="form-grid">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Add person'}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  )
}

function InstrumentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [idType, setIdType] = useState<'ticker' | 'isin' | 'amfi'>('ticker')
  const [idValue, setIdValue] = useState('')
  const [currency, setCurrency] = useState('')
  const { busy, msg, run } = useSubmit()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(
      () => createInstrument({ name, id_type: idType, id_value: idValue, currency }),
      `Added ${name}`,
      () => {
        setName('')
        setIdValue('')
        setCurrency('')
        onCreated()
      },
    )
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Add instrument</h2>
      <div className="form-grid">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>ID type</label>
          <select value={idType} onChange={(e) => setIdType(e.target.value as typeof idType)}>
            <option value="ticker">ticker</option>
            <option value="isin">isin</option>
            <option value="amfi">amfi</option>
          </select>
        </div>
        <div className="field">
          <label>ID value</label>
          <input value={idValue} onChange={(e) => setIdValue(e.target.value)} required />
        </div>
        <div className="field">
          <label>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Add instrument'}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  )
}

function AccountForm({ people, onCreated }: { people: Person[]; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [currency, setCurrency] = useState('')
  const [kind, setKind] = useState<'public' | 'pms'>('public')
  const { busy, msg, run } = useSubmit()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(
      () =>
        createAccount({
          name,
          platform,
          owner_id: Number(ownerId),
          currency,
          kind,
        }),
      `Added ${name}`,
      () => {
        setName('')
        setPlatform('')
        setOwnerId('')
        setCurrency('')
        onCreated()
      },
    )
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Add account</h2>
      <div className="form-grid">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Platform</label>
          <input value={platform} onChange={(e) => setPlatform(e.target.value)} required />
        </div>
        <div className="field">
          <label>Owner</label>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
            <option value="" disabled>
              Select…
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </div>
        <div className="field">
          <label>Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="public">public</option>
            <option value="pms">pms</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Add account'}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  )
}

function TransactionForm({
  accounts,
  instruments,
}: {
  accounts: Account[]
  instruments: Instrument[]
}) {
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<'buy' | 'sell' | 'contribution' | 'withdrawal'>('buy')
  const [instrumentId, setInstrumentId] = useState('')
  const [date, setDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const { busy, msg, run } = useSubmit()

  // Buys/sells track units of an instrument; contributions/withdrawals are cash amounts.
  const isTrade = type === 'buy' || type === 'sell'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(
      () =>
        createTransaction({
          account_id: Number(accountId),
          instrument_id: isTrade && instrumentId ? Number(instrumentId) : null,
          date,
          type,
          quantity: isTrade && quantity ? Number(quantity) : null,
          price: isTrade && price ? Number(price) : null,
          amount: !isTrade && amount ? Number(amount) : null,
          currency,
        }),
      'Transaction added',
      () => {
        setQuantity('')
        setPrice('')
        setAmount('')
      },
    )
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Add transaction</h2>
      <div className="form-grid">
        <div className="field">
          <label>Account</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="" disabled>
              Select…
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="buy">buy</option>
            <option value="sell">sell</option>
            <option value="contribution">contribution</option>
            <option value="withdrawal">withdrawal</option>
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </div>
        {isTrade ? (
          <>
            <div className="field">
              <label>Instrument</label>
              <select
                value={instrumentId}
                onChange={(e) => setInstrumentId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select…
                </option>
                {instruments.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Quantity</label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Price</label>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </>
        ) : (
          <div className="field">
            <label>Amount</label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        )}
      </div>
      <div className="form-actions">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Add transaction'}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  )
}

function PmsForm({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState('')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState('')
  const { busy, msg, run } = useSubmit()
  const pmsAccounts = accounts.filter((a) => a.kind === 'pms')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(
      () =>
        createPmsSnapshot({
          account_id: Number(accountId),
          date,
          value: Number(value),
          currency,
        }),
      'Snapshot added',
      () => {
        setValue('')
      },
    )
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>Add PMS monthly value</h2>
      <div className="form-grid">
        <div className="field">
          <label>Account</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="" disabled>
              Select…
            </option>
            {pmsAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Value</label>
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Add snapshot'}
        </button>
        <Msg msg={msg} />
      </div>
    </form>
  )
}

function RefreshCard() {
  const { busy, msg, run } = useSubmit()
  return (
    <div className="card">
      <h2>Prices &amp; FX</h2>
      <p className="tile-sub">
        New instruments and transactions only affect valuation after prices and FX rates are
        fetched. This runs Yahoo Finance and may take a moment.
      </p>
      <div className="form-actions">
        <button
          className="btn"
          disabled={busy}
          onClick={() => run(() => refreshPrices(), 'Prices refreshed')}
        >
          {busy ? 'Refreshing…' : 'Refresh prices'}
        </button>
        <Msg msg={msg} />
      </div>
    </div>
  )
}

export default function ManagePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [instruments, setInstruments] = useState<Instrument[]>([])

  function reloadPeople() {
    getPeople().then(setPeople)
  }
  function reloadAccounts() {
    getAccounts().then(setAccounts)
  }
  function reloadInstruments() {
    getInstruments().then(setInstruments)
  }

  useEffect(() => {
    reloadPeople()
    reloadAccounts()
    reloadInstruments()
  }, [])

  return (
    <>
      <div className="dash-header">
        <h1>Manage data</h1>
        <Link className="nav-link" to="/">
          ← Dashboard
        </Link>
      </div>

      <RefreshCard />
      <PersonForm onCreated={reloadPeople} />
      <InstrumentForm onCreated={reloadInstruments} />
      <AccountForm people={people} onCreated={reloadAccounts} />
      <TransactionForm accounts={accounts} instruments={instruments} />
      <PmsForm accounts={accounts} />
    </>
  )
}

// Typed client for the Investment Overview backend. Requests go to the
// same-origin /api path, which Vite proxies to the FastAPI server (:8000).

export interface Person {
  id: number
  name: string
}

export interface Metrics {
  value_chf: number
  invested_chf: number
  gain_chf: number
  simple_return: number | null
  irr: number | null
}

export interface PersonMetrics extends Metrics {
  person_id: number
  name: string
}

export interface AccountMetrics extends Metrics {
  account_id: number
  name: string
  owner_id: number
}

export interface Holding {
  account_id: number
  instrument_id: number
  instrument: string
  ticker: string
  units: number
  price: number | null
  currency: string
  value_chf: number | null
}

export interface InstrumentMeta {
  id: number
  name: string
  ticker: string
  currency: string
}

export interface PricePoint {
  date: string
  native: number
  chf: number | null
}

export interface BuyMarker {
  date: string
  quantity: number
  native: number
  chf: number | null
}

export interface InstrumentTransaction {
  date: string
  type: string
  quantity: number | null
  native: number | null
  chf: number | null
}

export interface InstrumentHistory {
  instrument: InstrumentMeta
  prices: PricePoint[]
  buys: BuyMarker[]
  transactions: InstrumentTransaction[]
  avg_cost_native: number | null
  avg_cost_chf: number | null
  units: number
}

export interface Valuation {
  as_of: string
  base_currency: string
  total: Metrics
  by_person: PersonMetrics[]
  by_account: AccountMetrics[]
  holdings: Holding[]
}

export type GroupBy = 'person' | 'account' | 'holding'

export interface HistoryPoint {
  date: string
  total_chf: number
  series: { key: number | string; name: string; value_chf: number }[]
}

export interface Returns {
  twr: number | null
  mwr: number | null
}

export interface PerfPoint {
  date: string
  total: Returns
  by_person: ({ person_id: number; name: string } & Returns)[]
}

// Resolved plot window; both bounds optional (omitted = full history).
export interface Window {
  start?: string
  end?: string
}

// Writable entities (server assigns id). Distinct from the view-model shapes above.
export interface Account {
  id: number
  name: string
  platform: string
  owner_id: number
  currency: string
  kind: 'public' | 'pms'
}

export interface Instrument {
  id: number
  name: string
  id_type: 'ticker' | 'isin' | 'amfi'
  id_value: string
  currency: string
}

export interface PersonInput {
  name: string
}

export interface AccountInput {
  name: string
  platform: string
  owner_id: number
  currency: string
  kind: 'public' | 'pms'
}

export interface InstrumentInput {
  name: string
  id_type: 'ticker' | 'isin' | 'amfi'
  id_value: string
  currency: string
}

export interface TransactionInput {
  account_id: number
  instrument_id?: number | null
  date: string
  type: 'buy' | 'sell' | 'contribution' | 'withdrawal'
  quantity?: number | null
  price?: number | null
  amount?: number | null
  currency: string
}

export interface PmsSnapshotInput {
  account_id: number
  date: string
  value: number
  currency: string
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export function getPeople(): Promise<Person[]> {
  return getJson('/api/people')
}

export function getValuation(personId?: number): Promise<Valuation> {
  const q = personId != null ? `?person_id=${personId}` : ''
  return getJson(`/api/valuation${q}`)
}

function windowParams(window: Window, personId?: number): URLSearchParams {
  const params = new URLSearchParams()
  if (window.start) params.set('start', window.start)
  if (window.end) params.set('end', window.end)
  if (personId != null) params.set('person_id', String(personId))
  return params
}

export function getHistory(
  window: Window,
  personId?: number,
  groupBy: GroupBy = 'person',
): Promise<HistoryPoint[]> {
  const params = windowParams(window, personId)
  params.set('group_by', groupBy)
  return getJson(`/api/networth-history?${params}`)
}

export function getPerformance(window: Window, personId?: number): Promise<PerfPoint[]> {
  return getJson(`/api/performance-history?${windowParams(window, personId)}`)
}

export function getInstrumentHistory(
  ticker: string,
  personId?: number,
): Promise<InstrumentHistory> {
  const q = personId != null ? `?person_id=${personId}` : ''
  return getJson(`/api/instruments/${encodeURIComponent(ticker)}/history${q}`)
}

export function getAccounts(): Promise<Account[]> {
  return getJson('/api/accounts')
}

export function getInstruments(): Promise<Instrument[]> {
  return getJson('/api/instruments')
}

export function createPerson(body: PersonInput): Promise<Person> {
  return postJson('/api/people', body)
}

export function createAccount(body: AccountInput): Promise<Account> {
  return postJson('/api/accounts', body)
}

export function createInstrument(body: InstrumentInput): Promise<Instrument> {
  return postJson('/api/instruments', body)
}

export function createTransaction(body: TransactionInput): Promise<unknown> {
  return postJson('/api/transactions', body)
}

export function createPmsSnapshot(body: PmsSnapshotInput): Promise<unknown> {
  return postJson('/api/pms-snapshots', body)
}

export function refreshPrices(): Promise<{ status: string }> {
  return postJson('/api/refresh-prices', {})
}

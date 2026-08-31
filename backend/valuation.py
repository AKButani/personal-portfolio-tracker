"""Portfolio valuation in the base currency (CHF).

Pure functions over a DB Session — no FastAPI imports. Prices and FX rates are
preloaded into sorted lists so `_latest_on_or_before` can binary-search them,
keeping the net-worth-history loop cheap.

Gain/loss unifies public and PMS accounts:
  value  - public: units x price x fx ;  pms: latest snapshot x fx
  invested = cash-in (buy/contribution) - cash-out (sell/withdrawal), each
             converted at the FX rate on the transaction's own date
  gain     = value - invested
  simple_return = gain / invested
  irr      = XIRR over dated CHF cashflows + terminal value at `as_of`
"""

from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from sqlmodel import Session, select

from models import Account, FxRate, Instrument, Person, PmsSnapshot, Price, Transaction

BASE_CURRENCY = "CHF"

CASH_IN = {"buy", "contribution"}
CASH_OUT = {"sell", "withdrawal"}


def _amount(tx: Transaction) -> float:
    """Transaction value in its own currency."""
    if tx.amount is not None:
        return tx.amount
    if tx.quantity is not None and tx.price is not None:
        return tx.quantity * tx.price
    return 0.0


def _latest_on_or_before(dates: list[date], values: list[float], d: date) -> float | None:
    """Value whose date is the latest <= d, or None if d predates all data."""
    i = bisect_right(dates, d)
    return values[i - 1] if i > 0 else None


class MarketData:
    """Preloaded, sorted price and FX series for fast as-of lookups."""

    def __init__(self, session: Session) -> None:
        self._prices: dict[int, tuple[list[date], list[float]]] = {}
        by_instrument: dict[int, list[Price]] = defaultdict(list)
        for p in session.exec(select(Price)).all():
            by_instrument[p.instrument_id].append(p)
        for iid, rows in by_instrument.items():
            rows.sort(key=lambda r: r.date)
            self._prices[iid] = ([r.date for r in rows], [r.price for r in rows])

        self._fx: dict[str, tuple[list[date], list[float]]] = {}
        by_currency: dict[str, list[FxRate]] = defaultdict(list)
        for r in session.exec(select(FxRate)).all():
            by_currency[r.base].append(r)
        for cur, rows in by_currency.items():
            rows.sort(key=lambda r: r.date)
            self._fx[cur] = ([r.date for r in rows], [r.rate for r in rows])

    def price_series(self, instrument_id: int) -> tuple[list[date], list[float]] | None:
        """Sorted (dates, prices) for an instrument, or None if unpriced."""
        return self._prices.get(instrument_id)

    def last_price_date(self) -> date | None:
        """Most recent date across all instruments' price series, or None."""
        return max((dates[-1] for dates, _ in self._prices.values()), default=None)

    def price_on(self, instrument_id: int, d: date) -> float | None:
        series = self._prices.get(instrument_id)
        return _latest_on_or_before(*series, d) if series else None

    def fx_on(self, currency: str, d: date) -> float | None:
        """Rate to convert `currency` into CHF as of d (1.0 for CHF itself)."""
        if currency == BASE_CURRENCY:
            return 1.0
        series = self._fx.get(currency)
        return _latest_on_or_before(*series, d) if series else None


@dataclass
class _Portfolio:
    """Everything the valuation functions need, loaded and grouped once.

    Accounts are filtered to the requested person; transactions and snapshots are
    grouped by account (and snapshots pre-sorted by date) for that same set.
    """

    accounts: list[Account]
    people: dict[int, Person]
    instruments: dict[int, Instrument]
    txns_by_account: dict[int, list[Transaction]]
    snaps_by_account: dict[int, list[PmsSnapshot]]
    market: "MarketData"


def _load(session: Session, person_id: int | None = None) -> _Portfolio:
    market = MarketData(session)
    accounts_query = select(Account)
    if person_id is not None:
        accounts_query = accounts_query.where(Account.owner_id == person_id)
    accounts = list(session.exec(accounts_query).all())
    account_ids = {a.id for a in accounts}

    people = {p.id: p for p in session.exec(select(Person)).all()}
    instruments = {i.id: i for i in session.exec(select(Instrument)).all()}

    txns_by_account: dict[int, list[Transaction]] = defaultdict(list)
    for tx in session.exec(select(Transaction)).all():
        if tx.account_id in account_ids:
            txns_by_account[tx.account_id].append(tx)

    snaps_by_account: dict[int, list[PmsSnapshot]] = defaultdict(list)
    for s in session.exec(select(PmsSnapshot)).all():
        if s.account_id in account_ids:
            snaps_by_account[s.account_id].append(s)
    for rows in snaps_by_account.values():
        rows.sort(key=lambda s: s.date)

    return _Portfolio(accounts, people, instruments, txns_by_account, snaps_by_account, market)


def _sample_dates(
    port: _Portfolio, start: date | None = None, end: date | None = None
) -> list[date]:
    """Dates to sample the history series at, within [start, end].

    Defaults span the full history (earliest transaction to last price date). The
    requested window is clamped to that available range, and the step is chosen by
    span so short windows sample densely: daily <=~3mo, weekly <=~2y, else monthly.
    The exact `end` is always the final sample so the plot's right edge is current.
    """
    data_start = min(tx.date for txns in port.txns_by_account.values() for tx in txns)
    data_end = port.market.last_price_date() or date.today()
    start = max(start, data_start) if start else data_start
    end = min(end, data_end) if end else data_end
    if end < start:
        return []

    span = (end - start).days
    step = timedelta(days=1 if span <= 92 else 7 if span <= 731 else 30)

    dates = []
    d = start
    while d <= end:
        dates.append(d)
        d += step
    if dates[-1] != end:
        dates.append(end)
    return dates


def holdings_as_of(txns: list[Transaction], d: date) -> dict[tuple[int, int], float]:
    """Net units per (account_id, instrument_id) from transactions up to d."""
    units: dict[tuple[int, int], float] = defaultdict(float)
    for tx in txns:
        if tx.date > d or tx.instrument_id is None or tx.quantity is None:
            continue
        sign = 1 if tx.type == "buy" else -1 if tx.type == "sell" else 0
        units[(tx.account_id, tx.instrument_id)] += sign * tx.quantity
    return {k: v for k, v in units.items() if v != 0}


def _account_value_chf(
    account: Account,
    txns: list[Transaction],
    snapshots: list[PmsSnapshot],
    instruments: dict[int, Instrument],
    market: MarketData,
    d: date,
) -> float:
    if account.kind == "pms":
        rows = [s for s in snapshots if s.date <= d]  # snapshots arrive pre-sorted
        if not rows:
            return 0.0
        fx = market.fx_on(account.currency, d) or 0.0
        return rows[-1].value * fx

    total = 0.0
    for (_, instrument_id), qty in holdings_as_of(txns, d).items():
        inst = instruments[instrument_id]
        price = market.price_on(instrument_id, d)
        fx = market.fx_on(inst.currency, d)
        if price is None or fx is None:
            continue
        total += qty * price * fx
    return total


def _account_cashflows(txns: list[Transaction], market: MarketData, d: date) -> list[tuple[date, float]]:
    """Signed CHF cashflows up to d: negative = money in, positive = money out."""
    flows: list[tuple[date, float]] = []
    for tx in txns:
        if tx.date > d:
            continue
        fx = market.fx_on(tx.currency, tx.date)
        if fx is None:
            continue
        amount_chf = _amount(tx) * fx
        if tx.type in CASH_IN:
            flows.append((tx.date, -amount_chf))
        elif tx.type in CASH_OUT:
            flows.append((tx.date, amount_chf))
    return flows


def xirr(cashflows: list[tuple[date, float]]) -> float | None:
    """Money-weighted return: rate where NPV(cashflows) == 0. None if undefined."""
    if len(cashflows) < 2:
        return None
    signs = {c > 0 for _, c in cashflows if c != 0}
    if len(signs) < 2:  # needs at least one inflow and one outflow
        return None

    t0 = min(d for d, _ in cashflows)

    def npv(rate: float) -> float:
        return sum(cf / (1 + rate) ** ((d - t0).days / 365) for d, cf in cashflows)

    lo, hi = -0.9999, 10.0
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:  # no sign change in bracket -> can't solve
        return None
    for _ in range(100):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < 1e-6:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def _metrics(value: float, cashflows: list[tuple[date, float]], as_of: date) -> dict:
    invested = -sum(cf for _, cf in cashflows)  # cash-in minus cash-out
    gain = value - invested
    return {
        "value_chf": round(value, 2),
        "invested_chf": round(invested, 2),
        "gain_chf": round(gain, 2),
        "simple_return": round(gain / invested, 4) if invested else None,
        "irr": (lambda r: round(r, 4) if r is not None else None)(
            xirr([*cashflows, (as_of, value)])
        ),
    }


def portfolio_valuation(
    session: Session, as_of: date | None = None, person_id: int | None = None
) -> dict:
    port = _load(session, person_id)
    market, instruments, people = port.market, port.instruments, port.people
    txns_by_account, snaps_by_account = port.txns_by_account, port.snaps_by_account

    if as_of is None:
        as_of = market.last_price_date() or date.today()

    by_account = []
    by_person_flows: dict[int, list[tuple[date, float]]] = defaultdict(list)
    by_person_value: dict[int, float] = defaultdict(float)
    total_value = 0.0
    total_flows: list[tuple[date, float]] = []
    holdings_out = []

    for acc in port.accounts:
        txns = txns_by_account[acc.id]
        snaps = snaps_by_account[acc.id]
        value = _account_value_chf(acc, txns, snaps, instruments, market, as_of)
        flows = _account_cashflows(txns, market, as_of)

        by_account.append(
            {"account_id": acc.id, "name": acc.name, "owner_id": acc.owner_id, **_metrics(value, flows, as_of)}
        )
        total_value += value
        total_flows.extend(flows)
        by_person_value[acc.owner_id] += value
        by_person_flows[acc.owner_id].extend(flows)

        if acc.kind != "pms":
            for (_, instrument_id), qty in holdings_as_of(txns, as_of).items():
                inst = instruments[instrument_id]
                price = market.price_on(instrument_id, as_of)
                fx = market.fx_on(inst.currency, as_of)
                holdings_out.append(
                    {
                        "account_id": acc.id,
                        "instrument_id": instrument_id,
                        "instrument": inst.name,
                        "ticker": inst.id_value,
                        "units": qty,
                        "price": price,
                        "currency": inst.currency,
                        "value_chf": round(qty * price * fx, 2) if price and fx else None,
                    }
                )

    by_person = [
        {"person_id": pid, "name": people[pid].name, **_metrics(by_person_value[pid], by_person_flows[pid], as_of)}
        for pid in sorted(by_person_value)
    ]

    return {
        "as_of": as_of.isoformat(),
        "base_currency": BASE_CURRENCY,
        "total": _metrics(total_value, total_flows, as_of),
        "by_person": by_person,
        "by_account": by_account,
        "holdings": holdings_out,
    }


def _account_contributions(
    acc: Account, port: _Portfolio, d: date, group_by: str
) -> list[tuple[object, str, float]]:
    """(key, name, value_chf) bands one account contributes to the breakdown.

    person/account: one band (the whole account value). holding: one band per
    held instrument for public accounts; PMS accounts (no instruments) become a
    single band keyed by account so the stack still sums to true net worth.
    """
    txns = port.txns_by_account[acc.id]
    snaps = port.snaps_by_account[acc.id]

    if group_by == "holding" and acc.kind != "pms":
        out: list[tuple[object, str, float]] = []
        for (_, instrument_id), qty in holdings_as_of(txns, d).items():
            inst = port.instruments[instrument_id]
            price = port.market.price_on(instrument_id, d)
            fx = port.market.fx_on(inst.currency, d)
            if price is None or fx is None:
                continue
            out.append((instrument_id, inst.name, qty * price * fx))
        return out

    value = _account_value_chf(acc, txns, snaps, port.instruments, port.market, d)
    if group_by == "account":
        return [(acc.id, acc.name, value)]
    if group_by == "holding":  # PMS account: one band named after the account
        return [(f"pms:{acc.id}", acc.name, value)]
    return [(acc.owner_id, port.people[acc.owner_id].name, value)]  # person


def networth_history(
    session: Session,
    start: date | None = None,
    end: date | None = None,
    person_id: int | None = None,
    group_by: str = "person",
) -> list[dict]:
    """Net worth over time, broken down by `group_by` (person|account|holding).

    Each point's `series` bands sum to `total_chf`. The breakdown is capped to
    the top-N bands (by value at the last sample); the remainder is folded into a
    single "Other" band so the stack stays legible and the color count is bounded.
    """
    port = _load(session, person_id)
    if not port.txns_by_account:
        return []

    dates = _sample_dates(port, start, end)
    if not dates:
        return []

    names: dict[object, str] = {}
    per_date: list[tuple[str, dict[object, float]]] = []
    for d in dates:
        values: dict[object, float] = defaultdict(float)
        for acc in port.accounts:
            for key, name, value in _account_contributions(acc, port, d, group_by):
                values[key] += value
                names[key] = name
        per_date.append((d.isoformat(), values))

    TOP_N = 8
    last = per_date[-1][1]
    ranked = sorted(names, key=lambda k: last.get(k, 0.0), reverse=True)
    kept = ranked[:TOP_N]
    kept_set = set(kept)
    has_other = len(ranked) > TOP_N

    series = []
    for iso_date, values in per_date:
        bands = [
            {"key": k, "name": names[k], "value_chf": round(values.get(k, 0.0), 2)}
            for k in kept
        ]
        if has_other:
            other = sum(v for k, v in values.items() if k not in kept_set)
            bands.append({"key": "other", "name": "Other", "value_chf": round(other, 2)})
        series.append(
            {
                "date": iso_date,
                "total_chf": round(sum(values.values()), 2),
                "series": bands,
            }
        )

    return series


def performance_history(
    session: Session,
    start: date | None = None,
    end: date | None = None,
    person_id: int | None = None,
) -> list[dict]:
    """Return % over time — both time-weighted (TWR) and money-weighted (MWR),
    per person and portfolio-wide, rebased to the window start so the first
    sample reads 0%. TWR chains sub-period returns so deposit timing is
    neutralized (like IBKR); its chain simply restarts at the window's first
    sample. MWR is cumulative gain / invested: for an explicit sub-window it is
    measured against the window-start value (so it starts at 0 too), while the
    full-history view keeps the since-inception baseline."""
    port = _load(session, person_id)
    if not port.txns_by_account:
        return []

    accounts_by_owner: dict[int, list[Account]] = defaultdict(list)
    for acc in port.accounts:
        accounts_by_owner[acc.owner_id].append(acc)

    rebase = start is not None  # sub-window: measure MWR from the window start

    # Running chain state per owner (and None = portfolio total).
    factor: dict[int | None, float] = defaultdict(lambda: 1.0)
    prev_value: dict[int | None, float] = defaultdict(float)
    prev_invested: dict[int | None, float] = defaultdict(float)
    base_value: dict[int | None, float] = {}  # value at the window's first sample
    base_invested: dict[int | None, float] = {}  # invested at that first sample

    def returns(value: float, invested: float, key: int | None) -> dict:
        flow = invested - prev_invested[key]  # net new money in this period
        if prev_value[key] > 0:  # skip leading zero-value periods (div-by-zero)
            factor[key] *= (value - flow) / prev_value[key]
        prev_value[key] = value
        prev_invested[key] = invested
        if key not in base_value:  # first sample fixes the window baseline
            base_value[key] = value
            base_invested[key] = invested
        if rebase:
            inv_win = base_value[key] + (invested - base_invested[key])
            mwr = (value - inv_win) / inv_win if inv_win else None
        else:
            mwr = (value - invested) / invested if invested else None
        return {
            "twr": round(factor[key] - 1, 4),
            "mwr": round(mwr, 4) if mwr is not None else None,
        }

    series = []
    for d in _sample_dates(port, start, end):
        by_person = []
        total_value = 0.0
        total_invested = 0.0
        for owner_id, accs in sorted(accounts_by_owner.items()):
            value = 0.0
            flows: list[tuple[date, float]] = []
            for acc in accs:
                value += _account_value_chf(
                    acc, port.txns_by_account[acc.id], port.snaps_by_account[acc.id],
                    port.instruments, port.market, d,
                )
                flows.extend(_account_cashflows(port.txns_by_account[acc.id], port.market, d))
            invested = -sum(cf for _, cf in flows)
            total_value += value
            total_invested += invested
            by_person.append(
                {"person_id": owner_id, "name": port.people[owner_id].name, **returns(value, invested, owner_id)}
            )
        series.append(
            {
                "date": d.isoformat(),
                "total": returns(total_value, total_invested, None),
                "by_person": by_person,
            }
        )

    return series


def instrument_history(session: Session, ticker: str, person_id: int | None = None) -> dict | None:
    """Price history (native + CHF) for one instrument, with the buy markers and
    average cost (optionally scoped to a person's accounts). None if unknown."""
    instrument = next(
        (i for i in session.exec(select(Instrument)).all() if i.id_value.lower() == ticker.lower()),
        None,
    )
    if instrument is None:
        return None

    market = MarketData(session)

    prices = []
    series = market.price_series(instrument.id)
    if series:
        dates, pxs = series
        for d, px in zip(dates, pxs):
            fx = market.fx_on(instrument.currency, d)
            prices.append(
                {"date": d.isoformat(), "native": round(px, 4), "chf": round(px * fx, 4) if fx else None}
            )

    account_ids: set[int] | None = None
    if person_id is not None:
        account_ids = {a.id for a in session.exec(select(Account).where(Account.owner_id == person_id)).all()}

    txns = session.exec(select(Transaction).where(Transaction.instrument_id == instrument.id)).all()
    buys = []
    cost_native = 0.0
    cost_chf = 0.0
    buy_units = 0.0
    for tx in sorted(txns, key=lambda t: t.date):
        if account_ids is not None and tx.account_id not in account_ids:
            continue
        if tx.type != "buy" or tx.quantity is None or tx.price is None:
            continue
        fx = market.fx_on(tx.currency, tx.date)
        chf = tx.price * fx if fx else None
        buys.append(
            {
                "date": tx.date.isoformat(),
                "quantity": tx.quantity,
                "native": round(tx.price, 4),
                "chf": round(chf, 4) if chf is not None else None,
            }
        )
        cost_native += tx.quantity * tx.price
        if chf is not None:
            cost_chf += tx.quantity * chf
        buy_units += tx.quantity

    # Net units currently held (sells net against buys), within scope.
    held = holdings_as_of(txns, date.today())
    units = sum(
        q
        for (aid, iid), q in held.items()
        if iid == instrument.id and (account_ids is None or aid in account_ids)
    )

    return {
        "instrument": {
            "id": instrument.id,
            "name": instrument.name,
            "ticker": instrument.id_value,
            "currency": instrument.currency,
        },
        "prices": prices,
        "buys": buys,  # sells ignored for avg cost / markers in v1 (none in seed)
        "avg_cost_native": round(cost_native / buy_units, 4) if buy_units else None,
        "avg_cost_chf": round(cost_chf / buy_units, 4) if buy_units else None,
        "units": units,
    }

"""Golden-snapshot regression test for the valuation read paths.

`compute(session)` gathers the output of every read function across the person
filters and frequencies. The expected values live in snapshot.json, generated
from the pre-refactor code, so this test fails if any returned JSON changes.
"""

import json
from datetime import date
from pathlib import Path

import valuation

SNAPSHOT = Path(__file__).parent / "snapshot.json"


# (start, end) windows: full history plus an explicit sub-window.
WINDOWS = {"all": (None, None), "window": (date(2024, 3, 1), date(2024, 6, 1))}


def compute(session) -> dict:
    people = [None, 1, 2]
    return {
        "valuation": {
            str(pid): valuation.portfolio_valuation(session, person_id=pid) for pid in people
        },
        "networth": {
            f"{pid}:{w}": valuation.networth_history(session, s, e, person_id=pid)
            for pid in people
            for w, (s, e) in WINDOWS.items()
        },
        "performance": {
            f"{pid}:{w}": valuation.performance_history(session, s, e, person_id=pid)
            for pid in people
            for w, (s, e) in WINDOWS.items()
        },
        "instrument": {
            f"VT:{pid}": valuation.instrument_history(session, "VT", person_id=pid)
            for pid in people
        },
        "holdings": [
            {"account_id": a, "instrument_id": i, "units": q}
            for (a, i), q in valuation.holdings_as_of(
                list(session.exec(_all_txns()).all()), date(2024, 6, 1)
            ).items()
        ],
    }


def _all_txns():
    from sqlmodel import select

    from models import Transaction

    return select(Transaction)


def test_matches_snapshot(session):
    expected = json.loads(SNAPSHOT.read_text())
    actual = json.loads(json.dumps(compute(session)))  # normalize tuples->lists etc.
    assert actual == expected


def test_networth_window_respects_bounds(session):
    start, end = date(2024, 3, 1), date(2024, 6, 1)
    series = valuation.networth_history(session, start, end)
    dates = [date.fromisoformat(p["date"]) for p in series]
    assert dates, "expected points in the window"
    assert all(start <= d <= end for d in dates)
    assert dates[-1] == end  # right edge is the requested end
    # Span is 92 days -> daily sampling.
    assert (dates[1] - dates[0]).days == 1


def test_instrument_history_includes_sells(session):
    from models import Transaction

    vt = next(i for i in session.exec(_all_instruments()).all() if i.id_value == "VT")
    ibkr_id = session.exec(_all_txns()).first().account_id
    session.add(
        Transaction(account_id=ibkr_id, instrument_id=vt.id, date=date(2024, 4, 1),
                    type="sell", quantity=3, price=115, currency="USD")
    )
    session.commit()

    hist = valuation.instrument_history(session, "VT")
    types = [t["type"] for t in hist["transactions"]]
    assert types == ["buy", "buy", "sell"]  # ascending by date
    sell = hist["transactions"][-1]
    assert sell["quantity"] == 3
    assert sell["native"] == 115
    assert sell["chf"] is not None  # FX-converted per-unit price
    # Sells still excluded from avg cost / buy markers.
    assert len(hist["buys"]) == 2


def _all_instruments():
    from sqlmodel import select

    from models import Instrument

    return select(Instrument)


def test_performance_rebased_starts_at_zero(session):
    series = valuation.performance_history(session, date(2024, 3, 1), date(2024, 6, 1))
    first = series[0]
    assert first["total"]["twr"] == 0
    assert first["total"]["mwr"] == 0
    for p in first["by_person"]:
        assert p["twr"] == 0
        # mwr may be None for a person with no value at the window start.
        assert p["mwr"] in (0, None)

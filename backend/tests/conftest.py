"""Deterministic in-memory fixture used by the valuation/write tests.

Builds a throwaway SQLite DB (never touches investment.db) seeded with a small
dataset that exercises: two owners, a public multi-currency account with buys, a
PMS account with dated snapshots, and Price/FxRate series.
"""

from datetime import date

import pytest
from sqlmodel import Session, SQLModel, create_engine

from models import (
    Account,
    FxRate,
    Instrument,
    PmsSnapshot,
    Person,
    Price,
    Transaction,
)


@pytest.fixture
def session():
    engine = create_engine("sqlite://")  # in-memory
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        _seed(s)
        yield s


def _seed(s: Session) -> None:
    alice = Person(name="Alice")
    bob = Person(name="Bob")
    s.add_all([alice, bob])

    vt = Instrument(name="Vanguard Total World", id_type="ticker", id_value="VT", currency="USD")
    fund = Instrument(name="Some Fund", id_type="amfi", id_value="123456", currency="INR")
    s.add_all([vt, fund])
    s.commit()

    ibkr = Account(name="IBKR", platform="IBKR", owner_id=alice.id, currency="USD", kind="public")
    pms = Account(name="PMS", platform="ACME PMS", owner_id=bob.id, currency="INR", kind="pms")
    s.add_all([ibkr, pms])
    s.commit()

    s.add_all(
        [
            Transaction(account_id=ibkr.id, instrument_id=vt.id, date=date(2024, 1, 15),
                        type="buy", quantity=10, price=100, currency="USD"),
            Transaction(account_id=ibkr.id, instrument_id=vt.id, date=date(2024, 3, 15),
                        type="buy", quantity=5, price=110, currency="USD"),
            Transaction(account_id=pms.id, date=date(2024, 1, 10),
                        type="contribution", amount=100000, currency="INR"),
        ]
    )
    s.add_all(
        [
            PmsSnapshot(account_id=pms.id, date=date(2024, 2, 1), value=105000, currency="INR"),
            PmsSnapshot(account_id=pms.id, date=date(2024, 6, 1), value=120000, currency="INR"),
        ]
    )
    s.add_all(
        [
            Price(instrument_id=vt.id, date=date(2024, 1, 15), price=100),
            Price(instrument_id=vt.id, date=date(2024, 3, 15), price=110),
            Price(instrument_id=vt.id, date=date(2024, 6, 1), price=120),
        ]
    )
    s.add_all(
        [
            FxRate(date=date(2024, 1, 1), base="USD", quote="CHF", rate=0.90),
            FxRate(date=date(2024, 3, 1), base="USD", quote="CHF", rate=0.88),
            FxRate(date=date(2024, 6, 1), base="USD", quote="CHF", rate=0.91),
            FxRate(date=date(2024, 1, 1), base="INR", quote="CHF", rate=0.011),
            FxRate(date=date(2024, 6, 1), base="INR", quote="CHF", rate=0.010),
        ]
    )
    s.commit()

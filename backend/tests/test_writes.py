"""Write endpoints tested by calling the handler functions directly with the
fixture session (no TestClient/httpx needed)."""

from datetime import date

from routers import entities
from models import Account, Instrument, PmsSnapshot, Person, Transaction
from schemas import (
    AccountCreate,
    InstrumentCreate,
    PersonCreate,
    PmsSnapshotCreate,
    TransactionCreate,
)


def test_create_person(session):
    p = entities.create_person(PersonCreate(name="Carol"), session)
    assert p.id is not None
    assert p.name == "Carol"
    assert session.get(Person, p.id).name == "Carol"


def test_create_account(session):
    body = AccountCreate(name="Swiss", platform="UBS", owner_id=1, currency="CHF", kind="public")
    a = entities.create_account(body, session)
    assert a.id is not None
    assert (a.name, a.platform, a.owner_id, a.currency, a.kind) == (
        "Swiss", "UBS", 1, "CHF", "public",
    )
    assert session.get(Account, a.id).platform == "UBS"


def test_create_instrument(session):
    body = InstrumentCreate(name="Apple", id_type="ticker", id_value="AAPL", currency="USD")
    i = entities.create_instrument(body, session)
    assert i.id is not None
    assert (i.name, i.id_type, i.id_value, i.currency) == ("Apple", "ticker", "AAPL", "USD")
    assert session.get(Instrument, i.id).id_value == "AAPL"


def test_create_transaction(session):
    body = TransactionCreate(
        account_id=1, instrument_id=1, date=date(2024, 7, 1),
        type="buy", quantity=2, price=130, currency="USD",
    )
    t = entities.create_transaction(body, session)
    assert t.id is not None
    assert (t.account_id, t.instrument_id, t.type, t.quantity, t.price, t.currency) == (
        1, 1, "buy", 2, 130, "USD",
    )
    assert session.get(Transaction, t.id).type == "buy"


def test_create_pms_snapshot(session):
    body = PmsSnapshotCreate(account_id=2, date=date(2024, 7, 1), value=125000, currency="INR")
    snap = entities.create_pms_snapshot(body, session)
    assert snap.id is not None
    assert (snap.account_id, snap.value, snap.currency) == (2, 125000, "INR")
    assert session.get(PmsSnapshot, snap.id).value == 125000

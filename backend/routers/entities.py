"""CRUD and list endpoints for the core entities (people, accounts,
instruments, transactions, PMS snapshots)."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from db import get_session
from models import Account, Instrument, PmsSnapshot, Person, Transaction
from schemas import (
    AccountCreate,
    InstrumentCreate,
    PersonCreate,
    PmsSnapshotCreate,
    TransactionCreate,
)

router = APIRouter(prefix="/api", tags=["entities"])


def _create(session: Session, obj):
    """Persist a new row and return it with its server-assigned id."""
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.get("/people")
def get_people(session: Session = Depends(get_session)) -> list[Person]:
    return list(session.exec(select(Person)).all())


@router.get("/accounts")
def get_accounts(session: Session = Depends(get_session)) -> list[Account]:
    return list(session.exec(select(Account)).all())


@router.get("/instruments")
def get_instruments(session: Session = Depends(get_session)) -> list[Instrument]:
    return list(session.exec(select(Instrument)).all())


@router.post("/people")
def create_person(
    body: PersonCreate, session: Session = Depends(get_session)
) -> Person:
    return _create(session, Person(**body.model_dump()))


@router.post("/accounts")
def create_account(
    body: AccountCreate, session: Session = Depends(get_session)
) -> Account:
    return _create(session, Account(**body.model_dump()))


@router.post("/instruments")
def create_instrument(
    body: InstrumentCreate, session: Session = Depends(get_session)
) -> Instrument:
    return _create(session, Instrument(**body.model_dump()))


@router.post("/transactions")
def create_transaction(
    body: TransactionCreate, session: Session = Depends(get_session)
) -> Transaction:
    return _create(session, Transaction(**body.model_dump()))


@router.post("/pms-snapshots")
def create_pms_snapshot(
    body: PmsSnapshotCreate, session: Session = Depends(get_session)
) -> PmsSnapshot:
    return _create(session, PmsSnapshot(**body.model_dump()))

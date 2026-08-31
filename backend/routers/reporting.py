"""Derived, read-only reporting endpoints (valuation, history, holdings) plus
the price/FX refresh trigger."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

import ingest
import valuation
from db import get_session
from models import Transaction

router = APIRouter(prefix="/api", tags=["reporting"])


@router.get("/holdings")
def get_holdings(session: Session = Depends(get_session)) -> list[dict]:
    """Current holdings per (account, instrument), derived from transactions."""
    txns = list(session.exec(select(Transaction)).all())
    units = valuation.holdings_as_of(txns, date.today())
    return [
        {"account_id": account_id, "instrument_id": instrument_id, "units": qty}
        for (account_id, instrument_id), qty in units.items()
    ]


@router.get("/valuation")
def get_valuation(
    person_id: int | None = None, session: Session = Depends(get_session)
) -> dict:
    return valuation.portfolio_valuation(session, person_id=person_id)


@router.get("/networth-history")
def get_networth_history(
    start: date | None = None,
    end: date | None = None,
    person_id: int | None = None,
    group_by: str = "person",
    session: Session = Depends(get_session),
) -> list[dict]:
    return valuation.networth_history(
        session, start, end, person_id=person_id, group_by=group_by
    )


@router.get("/performance-history")
def get_performance_history(
    start: date | None = None,
    end: date | None = None,
    person_id: int | None = None,
    session: Session = Depends(get_session),
) -> list[dict]:
    return valuation.performance_history(session, start, end, person_id=person_id)


@router.get("/instruments/{ticker}/history")
def get_instrument_history(
    ticker: str,
    person_id: int | None = None,
    session: Session = Depends(get_session),
) -> dict:
    result = valuation.instrument_history(session, ticker, person_id=person_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Unknown instrument: {ticker}")
    return result


@router.post("/refresh-prices")
def refresh_prices() -> dict:
    """Fetch EOD prices and FX into the DB (blocking; runs in the threadpool)."""
    ingest.ingest()
    return {"status": "ok"}

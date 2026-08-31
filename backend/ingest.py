"""Fetch EOD prices and FX rates into the DB.

Prices for every instrument, and FX from each non-base currency to the base
currency (CHF), covering the range from the earliest transaction to today.
Free source: Yahoo Finance via yfinance (no API key). Idempotent — rerun any
time; existing price/fx rows are replaced.

    uv run python ingest.py
"""

import pandas as pd
import yfinance as yf
from sqlmodel import Session, delete, select

from db import engine
from models import Account, FxRate, Instrument, Price, Transaction

BASE_CURRENCY = "CHF"


def _close_series(symbol: str, start: str) -> pd.Series:
    data = yf.download(symbol, start=start, progress=False, auto_adjust=True)
    close = data["Close"]
    if hasattr(close, "columns"):  # single-ticker download returns a 1-col frame
        close = close.iloc[:, 0]
    return close.dropna()


def ingest() -> None:
    with Session(engine) as session:
        start_date = session.exec(select(Transaction.date).order_by(Transaction.date)).first()
        if start_date is None:
            print("No transactions found — seed the DB first.")
            return
        start = start_date.isoformat()

        instruments = session.exec(select(Instrument)).all()

        # Prices
        session.exec(delete(Price))
        for inst in instruments:
            series = _close_series(inst.id_value, start)
            for ts, value in series.items():
                session.add(Price(instrument_id=inst.id, date=ts.date(), price=float(value)))
            print(f"{inst.id_value}: {len(series)} prices")

        # FX: each non-base instrument or account currency -> CHF
        account_currencies = {a.currency for a in session.exec(select(Account)).all()}
        currencies = ({inst.currency for inst in instruments} | account_currencies) - {BASE_CURRENCY}
        session.exec(delete(FxRate))
        for cur in currencies:
            series = _close_series(f"{cur}{BASE_CURRENCY}=X", start)
            for ts, value in series.items():
                session.add(
                    FxRate(date=ts.date(), base=cur, quote=BASE_CURRENCY, rate=float(value))
                )
            print(f"{cur}->{BASE_CURRENCY}: {len(series)} rates")

        session.commit()

    print("Ingestion complete.")


if __name__ == "__main__":
    ingest()

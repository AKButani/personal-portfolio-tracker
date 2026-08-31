from datetime import date

from sqlmodel import Field, SQLModel


class Person(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str


class Account(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    platform: str  # e.g. HDFC, IBKR, Swiss bank name, or PMS provider
    owner_id: int = Field(foreign_key="person.id")
    currency: str  # ISO code, e.g. CHF, INR, USD
    kind: str  # "public" | "pms"


class Instrument(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    id_type: str  # "ticker" | "isin" | "amfi"
    id_value: str
    currency: str


class Transaction(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id")
    instrument_id: int | None = Field(default=None, foreign_key="instrument.id")
    date: date
    type: str  # "buy" | "sell" | "contribution" | "withdrawal"
    quantity: float | None = None  # units, for public holdings
    price: float | None = None  # per-unit price at transaction, in currency
    amount: float | None = None  # cash amount, e.g. for PMS contributions
    currency: str


class PmsSnapshot(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id")
    date: date
    value: float
    currency: str


# Populated later by the price/FX ingestion slice; empty for now.
class Price(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    instrument_id: int = Field(foreign_key="instrument.id")
    date: date
    price: float


class FxRate(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    date: date
    base: str
    quote: str
    rate: float

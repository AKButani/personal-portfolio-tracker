"""Input models for the write endpoints.

Non-table SQLModel classes used as POST bodies so the server (not the client)
assigns `id`. Fields mirror the table models in models.py, minus `id`.
"""

from datetime import date

from sqlmodel import SQLModel


class PersonCreate(SQLModel):
    name: str


class AccountCreate(SQLModel):
    name: str
    platform: str
    owner_id: int
    currency: str
    kind: str  # "public" | "pms"


class InstrumentCreate(SQLModel):
    name: str
    id_type: str  # "ticker" | "isin" | "amfi"
    id_value: str
    currency: str


class TransactionCreate(SQLModel):
    account_id: int
    instrument_id: int | None = None
    date: date
    type: str  # "buy" | "sell" | "contribution" | "withdrawal"
    quantity: float | None = None
    price: float | None = None
    amount: float | None = None
    currency: str


class PmsSnapshotCreate(SQLModel):
    account_id: int
    date: date
    value: float
    currency: str

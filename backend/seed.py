"""Load seed.yaml into a fresh investment.db.

Drops and recreates all tables, then inserts the seed data. Idempotent for
local development: run `uv run python seed.py` any time to reset the DB.
"""

from pathlib import Path

import yaml
from sqlmodel import Session, SQLModel

from db import engine
from models import Account, Instrument, PmsSnapshot, Person, Transaction

SEED_FILE = Path(__file__).parent / "seed.yaml"


def load() -> None:
    data = yaml.safe_load(SEED_FILE.read_text())

    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        people = {}
        for p in data.get("people", []):
            person = Person(name=p["name"])
            session.add(person)
            people[p["key"]] = person

        instruments = {}
        for i in data.get("instruments", []):
            instrument = Instrument(
                name=i["name"],
                id_type=i["id_type"],
                id_value=i["id_value"],
                currency=i["currency"],
            )
            session.add(instrument)
            instruments[i["key"]] = instrument

        session.commit()  # assign ids before referencing them

        for a in data.get("accounts", []):
            account = Account(
                name=a["name"],
                platform=a["platform"],
                owner_id=people[a["owner"]].id,
                currency=a["currency"],
                kind=a["kind"],
            )
            session.add(account)
            session.commit()

            for t in a.get("transactions", []):
                session.add(
                    Transaction(
                        account_id=account.id,
                        instrument_id=instruments[t["instrument"]].id
                        if t.get("instrument")
                        else None,
                        date=t["date"],
                        type=t["type"],
                        quantity=t.get("quantity"),
                        price=t.get("price"),
                        amount=t.get("amount"),
                        currency=t["currency"],
                    )
                )

            for s in a.get("pms_snapshots", []):
                session.add(
                    PmsSnapshot(
                        account_id=account.id,
                        date=s["date"],
                        value=s["value"],
                        currency=s["currency"],
                    )
                )

        session.commit()

    print(f"Seeded {SEED_FILE.name} into investment.db")


if __name__ == "__main__":
    load()

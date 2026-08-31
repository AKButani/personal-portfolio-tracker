from collections.abc import Iterator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

# Anchor the DB to this file's directory so it's the same file regardless of
# the working directory scripts are run from.
DB_PATH = Path(__file__).parent / "investment.db"
engine = create_engine(f"sqlite:///{DB_PATH}")


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session

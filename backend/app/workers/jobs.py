"""Registry of background jobs.

Each job is a callable taking a DB session. New jobs are appended here as
features land (embeddings backfill, notifications, analytics refresh).
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from app.db.session import SessionLocal

logger = logging.getLogger("app.worker.jobs")

JobFn = Callable[..., None]


@dataclass
class Job:
    name: str
    fn: JobFn
    interval: timedelta
    _last_run: datetime | None = field(default=None, repr=False)

    def is_due(self, now: datetime) -> bool:
        return self._last_run is None or now - self._last_run >= self.interval


_REGISTRY: list[Job] = []


def register(name: str, interval: timedelta) -> Callable[[JobFn], JobFn]:
    def deco(fn: JobFn) -> JobFn:
        _REGISTRY.append(Job(name=name, fn=fn, interval=interval))
        return fn

    return deco


def due_jobs() -> list[Job]:
    now = datetime.now(UTC)
    return [j for j in _REGISTRY if j.is_due(now)]


def run_job(job: Job) -> None:
    logger.info("Running job %s", job.name)
    with SessionLocal() as db:
        job.fn(db)
        db.commit()
    job._last_run = datetime.now(UTC)


# Jobs are imported for their registration side effects once they exist.
def _load_jobs() -> None:  # pragma: no cover
    try:
        from app.workers import tasks  # noqa: F401
    except ImportError:
        logger.debug("No app.workers.tasks module yet")


_load_jobs()

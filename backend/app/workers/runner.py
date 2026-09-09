"""Background worker loop.

Runs periodic jobs that must not block API requests:
  * generating embeddings for new/updated books
  * sending due-date and overdue notifications
  * refreshing analytics snapshots

Jobs are registered in ``app.workers.jobs`` as they are built, phase by phase.
This is a deliberately simple in-process scheduler (no Celery/Redis) to keep a
single-maintainer local deployment easy to operate.
"""

from __future__ import annotations

import logging
import signal
import time
from types import FrameType

from app.core.logging import configure_logging

logger = logging.getLogger("app.worker")

POLL_SECONDS = 30
_running = True


def _stop(signum: int, frame: FrameType | None) -> None:
    global _running
    logger.info("Received signal %s, shutting down worker", signum)
    _running = False


def main() -> None:
    configure_logging()
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    from app.workers.jobs import due_jobs, run_job

    logger.info("Worker started; polling every %ss", POLL_SECONDS)
    while _running:
        for job in due_jobs():
            try:
                run_job(job)
            except Exception:
                logger.exception("Job %s failed", job)
        time.sleep(POLL_SECONDS)
    logger.info("Worker stopped")


if __name__ == "__main__":
    main()

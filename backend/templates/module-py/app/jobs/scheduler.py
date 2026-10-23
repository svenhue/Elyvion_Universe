"""Example scheduled job via APScheduler — replace with real business
logic. Any module can run its own cron jobs independently; they don't
need to go through the Gateway or Registry."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from elyvion_shared import get_logger

logger = get_logger(__name__)

scheduler = AsyncIOScheduler()


def example_job() -> None:
    logger.info("example_cron_tick")


def start_scheduler() -> None:
    scheduler.add_job(example_job, "interval", minutes=1, id="example-job")
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)

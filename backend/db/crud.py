from datetime import datetime
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import Job


async def create_job(db: AsyncSession, job_id: str, disease_query: str) -> Job:
    now = datetime.utcnow()
    job = Job(
        id=job_id,
        disease_query=disease_query,
        stage="queued",
        progress=0.0,
        message="Queued",
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def get_job(db: AsyncSession, job_id: str) -> Optional[Job]:
    result = await db.execute(select(Job).where(Job.id == job_id))
    return result.scalar_one_or_none()


async def list_jobs(db: AsyncSession) -> list[Job]:
    result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    return list(result.scalars().all())


async def update_progress(
    db: AsyncSession,
    job_id: str,
    message: str,
    progress: float,
    stage: Optional[str] = None,
    started_at: Optional[datetime] = None,
) -> None:
    values: dict = {
        "message": message,
        "progress": float(progress),
        "updated_at": datetime.utcnow(),
    }
    if stage is not None:
        values["stage"] = stage
    if started_at is not None:
        values["started_at"] = started_at
    await db.execute(update(Job).where(Job.id == job_id).values(**values))
    await db.commit()


async def complete_job(db: AsyncSession, job_id: str, result_json: dict) -> None:
    await db.execute(
        update(Job).where(Job.id == job_id).values(
            stage="completed",
            progress=100.0,
            message="Pipeline complete!",
            result=result_json,
            updated_at=datetime.utcnow(),
        )
    )
    await db.commit()


async def fail_job(db: AsyncSession, job_id: str, error: str) -> None:
    await db.execute(
        update(Job).where(Job.id == job_id).values(
            stage="failed",
            error=error,
            message=f"Pipeline failed: {error}",
            updated_at=datetime.utcnow(),
        )
    )
    await db.commit()

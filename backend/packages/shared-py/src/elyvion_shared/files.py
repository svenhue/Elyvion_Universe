"""GridFS-backed binary storage shared by Python application services."""

from collections.abc import AsyncIterator
from dataclasses import dataclass

from bson import ObjectId
from gridfs.asynchronous import AsyncGridFSBucket
from gridfs.errors import NoFile
from pymongo.asynchronous.database import AsyncDatabase


class StoredFileNotFound(Exception):
    """Raised when a requested GridFS file does not exist."""


@dataclass(frozen=True)
class StoredFileMeta:
    id: str
    filename: str
    mime_type: str
    size: int


@dataclass(frozen=True)
class StoredFile(StoredFileMeta):
    stream: AsyncIterator[bytes]


class GridFSFileStore:
    """Reads and writes files in the platform's shared GridFS bucket."""

    def __init__(self, database: AsyncDatabase, bucket_name: str = "uploads") -> None:
        self._bucket = AsyncGridFSBucket(database, bucket_name=bucket_name)

    async def upload(
        self, content: bytes, filename: str, mime_type: str
    ) -> StoredFileMeta:
        file_id = await self._bucket.upload_from_stream(
            filename,
            content,
            metadata={"contentType": mime_type},
        )
        return StoredFileMeta(
            id=str(file_id),
            filename=filename,
            mime_type=mime_type,
            size=len(content),
        )

    async def download(self, file_id: str) -> StoredFile:
        object_id = self._to_object_id(file_id)
        documents = await self._bucket.find({"_id": object_id}).to_list(length=1)
        if not documents:
            raise StoredFileNotFound(file_id)

        document = documents[0]
        metadata = document.get("metadata") or {}
        mime_type = (
            document.get("contentType")
            or metadata.get("contentType")
            or "application/octet-stream"
        )
        try:
            grid_out = await self._bucket.open_download_stream(object_id)
        except NoFile as exc:
            raise StoredFileNotFound(file_id) from exc

        async def stream() -> AsyncIterator[bytes]:
            try:
                async for chunk in grid_out:
                    yield chunk
            finally:
                await grid_out.close()

        return StoredFile(
            id=file_id,
            filename=document["filename"],
            mime_type=mime_type,
            size=document["length"],
            stream=stream(),
        )

    async def remove(self, file_id: str) -> None:
        object_id = self._to_object_id(file_id)
        try:
            await self._bucket.delete(object_id)
        except NoFile as exc:
            raise StoredFileNotFound(file_id) from exc

    @staticmethod
    def _to_object_id(file_id: str) -> ObjectId:
        if not ObjectId.is_valid(file_id):
            raise StoredFileNotFound(file_id)
        return ObjectId(file_id)

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

export interface StoredFileMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface StoredFileStream extends StoredFileMeta {
  stream: Readable;
}

/**
 * Generic binary storage — "ein Confluence/Jira-artiges Feature braucht
 * Anhänge/Bilder; es gab in der gesamten Plattform keinen einzigen
 * Datei-Speicher." Uses MongoDB's own GridFS (via the native driver, not
 * a Mongoose schema — GridFS manages its own `fs.files`/`fs.chunks`
 * collections) rather than standing up S3 or a disk volume: every other
 * module here already depends on Mongo, so this needs no new
 * infrastructure to run `dev-up.sh` locally or in production.
 *
 * Deliberately generic — this module knows nothing about "attachments on
 * a Confluence page" or "Jira issue avatars". It just stores bytes and
 * hands back an id; `data-engine`'s `file` field type stores that id the
 * same way its `reference` field type stores another record's id — no
 * join on read, the owning app resolves it.
 */
@Injectable()
export class FilesService {
  private readonly bucket: GridFSBucket;

  constructor(@InjectConnection() connection: Connection) {
    if (!connection.db) throw new Error('Mongo connection not ready — FilesService constructed too early.');
    this.bucket = new GridFSBucket(connection.db, { bucketName: 'uploads' });
  }

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<StoredFileMeta> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.bucket.openUploadStream(filename, { contentType: mimeType });
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => {
        resolve({ id: String(uploadStream.id), filename, mimeType, size: uploadStream.length });
      });
      uploadStream.end(buffer);
    });
  }

  async download(id: string): Promise<StoredFileStream> {
    const objectId = this.toObjectId(id);
    const [file] = await this.bucket.find({ _id: objectId }).toArray();
    if (!file) throw new NotFoundException(`Datei "${id}" wurde nicht gefunden.`);
    return {
      id,
      filename: file.filename,
      mimeType: (file.contentType as string | undefined) ?? 'application/octet-stream',
      size: file.length,
      stream: this.bucket.openDownloadStream(objectId),
    };
  }

  async remove(id: string): Promise<void> {
    try {
      await this.bucket.delete(this.toObjectId(id));
    } catch {
      throw new NotFoundException(`Datei "${id}" wurde nicht gefunden.`);
    }
  }

  private toObjectId(id: string): ObjectId {
    try {
      return new ObjectId(id);
    } catch {
      throw new NotFoundException(`Datei "${id}" wurde nicht gefunden.`);
    }
  }
}

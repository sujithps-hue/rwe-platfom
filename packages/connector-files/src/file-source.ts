/**
 * Abstraction over "where batch files land" — S3, SFTP, Azure Blob, or (for local dev/tests) a
 * local directory. The connector only depends on this interface, so swapping the transport is a
 * one-class change and doesn't touch parsing/mapping logic.
 */
export interface FileSource {
  /** Lists file keys/paths added or modified since `cursor` (an opaque, source-defined bookmark), oldest first. */
  listNewFiles(cursor: string | null): Promise<{ key: string; modifiedCursor: string }[]>;
  readFile(key: string): Promise<string>;
}

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

/** Local-filesystem implementation for local dev and CI — reads every file in a directory whose mtime is after the cursor. */
export class LocalDirectoryFileSource implements FileSource {
  constructor(private readonly directory: string) {}

  async listNewFiles(cursor: string | null): Promise<{ key: string; modifiedCursor: string }[]> {
    const sinceMs = cursor ? new Date(cursor).getTime() : 0;
    const entries = await readdir(this.directory);
    const results: { key: string; modifiedCursor: string }[] = [];
    for (const entry of entries) {
      const fullPath = join(this.directory, entry);
      const stats = await stat(fullPath);
      if (stats.isFile() && stats.mtimeMs > sinceMs) {
        results.push({ key: entry, modifiedCursor: new Date(stats.mtimeMs).toISOString() });
      }
    }
    return results.sort((a, b) => a.modifiedCursor.localeCompare(b.modifiedCursor));
  }

  async readFile(key: string): Promise<string> {
    return readFile(join(this.directory, key), 'utf-8');
  }
}

import type { RequestHandler } from '@sveltejs/kit';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';

const BOOKS_DIR = path.resolve('Books');

function decodeSafe(p: string): string {
  return p
    .split('/')
    .filter((seg) => seg.length > 0)
    .map((seg) => decodeURIComponent(seg))
    .join('/');
}

function resolveInsideBooks(relPath: string): string | null {
  const cleaned = path.normalize(relPath).replace(/^\/+/, '');
  const abs = path.join(BOOKS_DIR, cleaned);
  if (!abs.startsWith(BOOKS_DIR)) return null;
  return abs;
}

export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const raw = params.path ?? '';
    const rel = decodeSafe(raw);
    const abs = resolveInsideBooks(rel);
    if (!abs) {
      return new Response('Invalid path', { status: 400 });
    }

    const stat = await fs.stat(abs);
    if (!stat.isFile()) {
      return new Response('Not a file', { status: 404 });
    }

    const fileName = path.basename(abs);
    const mime = 'application/epub+zip';

    const range = request.headers.get('range');
    if (range) {
      // Simple bytes range support: bytes=start-end
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const total = stat.size;
        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : total - 1;
        if (isNaN(start) || isNaN(end) || start > end || end >= total) {
          return new Response('Invalid Range', { status: 416 });
        }
        const stream = createReadStream(abs, { start, end });
        return new Response(stream as any, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
          }
        });
      }
    }

    const stream = createReadStream(abs);
    return new Response(stream as any, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
      }
    });
  } catch (err) {
    console.error('Failed to serve EPUB', err);
    return new Response('Not found', { status: 404 });
  }
};


import { TelegramAPI } from '../utils/telegramAPI.js';

export async function onRequestGet({ env, params, request }) {
  const fileId = params.fileId;

  if (!fileId) {
    return new Response('File ID is required', { status: 400 });
  }

  const botToken = env.TG_BOT_TOKEN;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken) {
    return new Response('Telegram storage not configured', { status: 500 });
  }

  try {
    const telegramAPI = new TelegramAPI(botToken, proxyUrl);

    const response = await telegramAPI.getFileContent(fileId);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const fileBlob = await response.blob();

    const headers = new Headers();
    const contentType = response.headers.get('Content-Type');
    headers.set('Content-Type', contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      headers.set('Content-Disposition', contentDisposition);
    }

    const etag = `"${fileId}-${fileBlob.size}"`;
    headers.set('ETag', etag);

    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    const range = request.headers.get('Range');
    if (range && fileBlob.size > 0) {
      const matches = range.match(/bytes=(\d+)-(\d*)/);
      if (matches) {
        const start = parseInt(matches[1]);
        const end = matches[2] ? parseInt(matches[2]) : fileBlob.size - 1;

        if (start >= fileBlob.size || end >= fileBlob.size || start > end) {
          return new Response('Range Not Satisfiable', { status: 416 });
        }

        const chunk = fileBlob.slice(start, end + 1);
        headers.set('Content-Range', `bytes ${start}-${end}/${fileBlob.size}`);
        headers.set('Content-Length', chunk.size.toString());
        headers.set('Accept-Ranges', 'bytes');

        return new Response(chunk, {
          status: 206,
          headers
        });
      }
    }

    return new Response(fileBlob, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('File fetch error:', error);
    return new Response(`Error fetching file: ${error.message}`, { status: 500 });
  }
}

export async function onRequestHead({ env, params }) {
  const fileId = params.fileId;

  if (!fileId) {
    return new Response('File ID is required', { status: 400 });
  }

  const botToken = env.TG_BOT_TOKEN;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken) {
    return new Response('Telegram storage not configured', { status: 500 });
  }

  try {
    const telegramAPI = new TelegramAPI(botToken, proxyUrl);
    const filePath = await telegramAPI.getFilePath(fileId);

    if (!filePath) {
      return new Response('File not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(null, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('File head error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

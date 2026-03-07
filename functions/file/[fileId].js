import { TelegramAPI } from '../utils/telegramAPI.js';

const MIME_TYPES = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'ico': 'image/x-icon',
  'svg': 'image/svg+xml',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'aac': 'audio/aac',
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'xml': 'application/xml',
  'zip': 'application/zip',
  'rar': 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
};

function getMimeType(filePath, fallback = 'application/octet-stream') {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext] || fallback;
}

function isImageType(mimeType) {
  return mimeType.startsWith('image/');
}

export async function onRequestGet({ env, params, request }) {
  let fileId = params.fileId;

  if (!fileId) {
    return new Response(JSON.stringify({ error: 'File ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (fileId.includes('.')) {
    fileId = fileId.split('.')[0];
  }

  const botToken = env.TG_BOT_TOKEN;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken) {
    return new Response(JSON.stringify({
      error: 'Telegram storage not configured',
      message: 'TG_BOT_TOKEN environment variable is not set'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const telegramAPI = new TelegramAPI(botToken, proxyUrl);

    const filePath = await telegramAPI.getFilePath(fileId);

    if (!filePath) {
      return new Response(JSON.stringify({
        error: 'File not found',
        message: 'Could not get file path from Telegram API. The file_id may be invalid or the bot may not have access to this file.',
        file_id: fileId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileUrl = telegramAPI.getFileUrl(filePath);

    const response = await fetch(fileUrl, {
      headers: telegramAPI.defaultHeaders
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        error: 'Failed to fetch file from Telegram',
        status: response.status,
        statusText: response.statusText,
        details: errorText,
        file_path: filePath
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileBlob = await response.blob();

    const mimeType = getMimeType(filePath);
    const fileName = filePath.split('/').pop() || fileId;

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    if (isImageType(mimeType)) {
      headers.set('Content-Disposition', `inline; filename="${fileName}"`);
    } else {
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
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
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestHead({ env, params }) {
  let fileId = params.fileId;

  if (!fileId) {
    return new Response('File ID is required', { status: 400 });
  }

  if (fileId.includes('.')) {
    fileId = fileId.split('.')[0];
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

    const mimeType = getMimeType(filePath);
    const fileName = filePath.split('/').pop() || fileId;

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    if (isImageType(mimeType)) {
      headers.set('Content-Disposition', `inline; filename="${fileName}"`);
    } else {
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    return new Response(null, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('File head error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

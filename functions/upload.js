import { TelegramAPI } from './utils/telegramAPI.js';

export async function onRequest({ request, env }) {
  const { method } = request;
  const url = new URL(request.url);

  const storageType = url.searchParams.get('storage') || env.DEFAULT_STORAGE || 'imgur';

  if (method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await request.formData();
    const imgFile = formData.get('file');

    if (!imgFile) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    switch (storageType.toLowerCase()) {
      case 'telegram':
        return await uploadToTelegram(imgFile, env);
      case 'imgur':
      default:
        return await uploadToImgur(imgFile);
    }
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function uploadToImgur(imgFile) {
  const body = new FormData();
  body.append('image', imgFile);

  const response = await fetch(`https://api.imgur.com/3/upload?client_id=546c25a59c58ad7`, {
    method: 'POST',
    headers: {
      Authorization: 'Client-ID 546c25a59c58ad7',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imgur upload failed: ${errorText}`);
  }

  const data = await response.json();

  return new Response(
    JSON.stringify([
      {
        src: data.data.link,
        delete_url: data.data.deletehash,
        id: data.data.id,
      },
    ]),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function uploadToTelegram(imgFile, env) {
  const botToken = env.TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken || !chatId) {
    return new Response(
      JSON.stringify({
        error: 'Telegram storage not configured. Please set TG_BOT_TOKEN and TG_CHAT_ID environment variables.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const telegramAPI = new TelegramAPI(botToken, proxyUrl);

  const fileName = imgFile.name;
  const fileType = imgFile.type;
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
  const fileSize = imgFile.size;

  const CHUNK_SIZE = 16 * 1024 * 1024;
  if (fileSize > CHUNK_SIZE) {
    return new Response(
      JSON.stringify({
        error: 'File too large',
        message: `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds the 16MB limit for Telegram Bot API`,
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  let sendFunction = { url: 'sendDocument', type: 'document' };

  const isImage = fileType.startsWith('image/');
  const isVideo = fileType.startsWith('video/');
  const isAudio = fileType.startsWith('audio/');

  if (isImage) {
    if (fileType === 'image/gif' || fileExt === 'gif') {
      sendFunction = { url: 'sendAnimation', type: 'animation' };
    } else if (fileType === 'image/webp' || fileExt === 'webp') {
      sendFunction = { url: 'sendAnimation', type: 'animation' };
    } else {
      sendFunction = { url: 'sendPhoto', type: 'photo' };
    }
  } else if (isVideo) {
    sendFunction = { url: 'sendVideo', type: 'video' };
  } else if (isAudio) {
    sendFunction = { url: 'sendAudio', type: 'audio' };
  }

  try {
    const responseData = await telegramAPI.sendFile(imgFile, chatId, sendFunction.url, sendFunction.type, '', fileName);

    console.log('Telegram response:', JSON.stringify(responseData, null, 2));

    if (!responseData.ok) {
      return new Response(
        JSON.stringify({
          error: 'Telegram API error',
          description: responseData.description,
          error_code: responseData.error_code,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const fileInfo = telegramAPI.getFileInfo(responseData);

    if (!fileInfo) {
      return new Response(
        JSON.stringify({
          error: 'Failed to get file info from Telegram response',
          raw_response: responseData,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const fileId = fileInfo.file_id;

    const filePath = await telegramAPI.getFilePath(fileId);
    if (!filePath) {
      return new Response(
        JSON.stringify({
          error: 'Failed to get file path',
          message: 'The file was uploaded but the file path could not be retrieved. This usually means the bot does not have permission to access this file.',
          file_id: fileId,
          possible_cause: 'The bot may not be an admin in the channel, or the channel is private',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const fileUrl = telegramAPI.getFileUrl(filePath);

    return new Response(
      JSON.stringify([
        {
          src: `/file/${fileId}`,
          file_id: fileId,
          file_path: filePath,
          file_url: fileUrl,
          file_name: fileInfo.file_name,
          file_size: fileInfo.file_size,
          storage: 'telegram',
          debug: {
            send_function: sendFunction,
            file_type: fileType,
            chat_id: chatId,
          },
        },
      ]),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Telegram upload error:', error);
    return new Response(
      JSON.stringify({
        error: 'Telegram upload failed',
        message: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

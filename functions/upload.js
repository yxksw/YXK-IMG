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
        headers: { 'Content-Type': 'application/json' }
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
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function uploadToImgur(imgFile) {
  const body = new FormData();
  body.append('image', imgFile);

  const response = await fetch(`https://api.imgur.com/3/upload?client_id=546c25a59c58ad7`, {
    method: 'POST',
    headers: {
      'Authorization': 'Client-ID 546c25a59c58ad7'
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imgur upload failed: ${errorText}`);
  }

  const data = await response.json();

  return new Response(JSON.stringify([{
    src: data.data.link,
    delete_url: data.data.deletehash,
    id: data.data.id
  }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function uploadToTelegram(imgFile, env) {
  const botToken = env.TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken || !chatId) {
    return new Response(JSON.stringify({
      error: 'Telegram storage not configured. Please set TG_BOT_TOKEN and TG_CHAT_ID environment variables.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const telegramAPI = new TelegramAPI(botToken, proxyUrl);

  const fileName = imgFile.name;
  const fileType = imgFile.type;
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

  const fileTypeMap = {
    'image/jpeg': { url: 'sendPhoto', type: 'photo' },
    'image/png': { url: 'sendPhoto', type: 'photo' },
    'image/bmp': { url: 'sendPhoto', type: 'photo' },
    'video/mp4': { url: 'sendVideo', type: 'video' },
    'video/quicktime': { url: 'sendVideo', type: 'video' },
    'video/webm': { url: 'sendVideo', type: 'video' },
    'audio/mpeg': { url: 'sendAudio', type: 'audio' },
    'audio/mp3': { url: 'sendAudio', type: 'audio' },
    'audio/wav': { url: 'sendAudio', type: 'audio' },
    'audio/ogg': { url: 'sendAudio', type: 'audio' },
    'audio/flac': { url: 'sendAudio', type: 'audio' },
    'audio/aac': { url: 'sendAudio', type: 'audio' },
    'application/pdf': { url: 'sendDocument', type: 'document' },
  };

  let sendFunction = fileTypeMap[fileType] || { url: 'sendDocument', type: 'document' };

  if (fileType === 'image/gif' || fileExt === 'gif') {
    sendFunction = { url: 'sendAnimation', type: 'animation' };
  }

  if (fileType === 'image/webp' || fileExt === 'webp') {
    sendFunction = { url: 'sendAnimation', type: 'animation' };
  }

  if (fileExt === 'ico') {
    sendFunction = { url: 'sendDocument', type: 'document' };
  }

  if (fileType.startsWith('video/')) {
    sendFunction = { url: 'sendVideo', type: 'video' };
  }

  if (fileType.startsWith('audio/')) {
    sendFunction = { url: 'sendAudio', type: 'audio' };
  }

  try {
    const responseData = await telegramAPI.sendFile(
      imgFile,
      chatId,
      sendFunction.url,
      sendFunction.type,
      '',
      fileName
    );

    const fileInfo = telegramAPI.getFileInfo(responseData);

    if (!fileInfo) {
      throw new Error('Failed to get file info from Telegram response');
    }

    const fileId = fileInfo.file_id;

    return new Response(JSON.stringify([{
      src: `/file/${fileId}`,
      file_id: fileId,
      file_name: fileInfo.file_name,
      file_size: fileInfo.file_size,
      storage: 'telegram'
    }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Telegram upload error:', error);
    throw new Error(`Telegram upload failed: ${error.message}`);
  }
}

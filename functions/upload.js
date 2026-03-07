import { TelegramAPI } from './utils/telegramAPI.js';

export async function onRequest({ request, env }) {
  const { method } = request;
  const url = new URL(request.url);

  // 获取存储类型参数，默认使用 imgur
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

    // 根据存储类型选择上传方式
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

// 上传到 Imgur
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

  // 返回统一的响应格式
  return new Response(JSON.stringify([{
    src: data.data.link,
    delete_url: data.data.deletehash,
    id: data.data.id
  }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// 上传到 Telegram
async function uploadToTelegram(imgFile, env) {
  // 从环境变量获取 Telegram 配置
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

  // 获取文件信息
  const fileName = imgFile.name;
  const fileType = imgFile.type;
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

  // 选择对应的发送接口
  const fileTypeMap = {
    'image/': { url: 'sendPhoto', type: 'photo' },
    'video/': { url: 'sendVideo', type: 'video' },
    'audio/': { url: 'sendAudio', type: 'audio' },
    'application/pdf': { url: 'sendDocument', type: 'document' },
  };

  const defaultType = { url: 'sendDocument', type: 'document' };

  let sendFunction = Object.keys(fileTypeMap).find(key => fileType.startsWith(key))
    ? fileTypeMap[Object.keys(fileTypeMap).find(key => fileType.startsWith(key))]
    : defaultType;

  // GIF、WebP 等特殊处理
  if (fileType === 'image/gif' || fileType === 'image/webp' || fileExt === 'gif' || fileExt === 'webp') {
    sendFunction = { url: 'sendAnimation', type: 'animation' };
  }

  // ICO 文件使用 sendDocument
  if (fileExt === 'ico') {
    sendFunction = defaultType;
  }

  try {
    // 发送文件到 Telegram
    const responseData = await telegramAPI.sendFile(
      imgFile,
      chatId,
      sendFunction.url,
      sendFunction.type,
      '',
      fileName
    );

    // 获取文件信息
    const fileInfo = telegramAPI.getFileInfo(responseData);

    if (!fileInfo) {
      throw new Error('Failed to get file info from Telegram response');
    }

    // 构建文件访问链接
    const fileId = fileInfo.file_id;

    // 返回统一的响应格式
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

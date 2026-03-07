import { TelegramAPI } from '../utils/telegramAPI.js';

export async function onRequestGet({ env, params }) {
  const fileId = params.fileId;

  if (!fileId) {
    return new Response('File ID is required', { status: 400 });
  }

  // 从环境变量获取 Telegram 配置
  const botToken = env.TG_BOT_TOKEN;
  const proxyUrl = env.TG_PROXY_URL || '';

  if (!botToken) {
    return new Response('Telegram storage not configured', { status: 500 });
  }

  try {
    const telegramAPI = new TelegramAPI(botToken, proxyUrl);

    // 获取文件内容
    const response = await telegramAPI.getFileContent(fileId);

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    // 获取文件内容并返回
    const fileBlob = await response.blob();

    // 设置响应头
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000'); // 缓存一年

    // 如果原始响应有 Content-Disposition，保留它
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      headers.set('Content-Disposition', contentDisposition);
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

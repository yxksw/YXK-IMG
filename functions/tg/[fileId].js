/**
 * Telegram 文件代理
 * 参考 CloudFlare-ImgBed 实现
 */

/**
 * 获取文件路径
 */
async function getFilePath(fileId, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.description);
  }
  
  return data.result.file_path;
}

/**
 * 获取文件内容
 */
async function getFileContent(filePath, botToken) {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  
  return response;
}

/**
 * 根据文件路径获取 Content-Type
 */
function getContentType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'json': 'application/json'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function onRequestGet({ request, env, params }) {
  const fileId = params.fileId;
  
  if (!fileId) {
    return new Response('File ID is required', { status: 400 });
  }

  try {
    // 从环境变量获取 Bot Token
    const botToken = env.TG_BOT_TOKEN;
    
    if (!botToken) {
      return new Response('Telegram configuration missing', { status: 500 });
    }

    // 获取文件路径
    const filePath = await getFilePath(fileId, botToken);
    
    // 获取文件内容
    const fileResponse = await getFileContent(filePath, botToken);
    
    // 获取文件数据
    const fileData = await fileResponse.arrayBuffer();
    
    // 确定 Content-Type
    const contentType = getContentType(filePath);
    
    // 判断是否为图片或视频（可以直接展示的类型）
    const isInline = contentType.startsWith('image/') || 
                     contentType.startsWith('video/') ||
                     contentType === 'application/pdf';

    // 返回文件内容
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileData.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        ...(isInline && { 'Content-Disposition': 'inline' })
      }
    });

  } catch (error) {
    console.error('Error serving file:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

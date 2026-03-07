/**
 * Telegram 上传处理
 * 参考 CloudFlare-ImgBed 实现
 */

/**
 * 发送文件到 Telegram
 */
async function sendFileToTelegram(file, chatId, botToken) {
  // 判断文件类型
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  
  // 根据类型选择 API
  let functionName, functionType;
  if (isImage) {
    functionName = 'sendPhoto';
    functionType = 'photo';
  } else if (isVideo) {
    functionName = 'sendVideo';
    functionType = 'video';
  } else {
    functionName = 'sendDocument';
    functionType = 'document';
  }
  
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append(functionType, file, file.name);
  
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${functionName}`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * 从 Telegram 响应中提取文件信息
 */
function extractFileInfo(responseData) {
  if (!responseData.ok) {
    throw new Error(responseData.description);
  }
  
  const result = responseData.result;
  
  // 优先获取 photo（图片数组，取最大的）
  if (result.photo && result.photo.length > 0) {
    // 取最大的图片
    const largestPhoto = result.photo.reduce((prev, current) => 
      (prev.file_size > current.file_size) ? prev : current
    );
    return {
      fileId: largestPhoto.file_id,
      fileName: result.caption || `${largestPhoto.file_unique_id}.jpg`,
      fileSize: largestPhoto.file_size,
      width: largestPhoto.width,
      height: largestPhoto.height
    };
  }
  
  // video
  if (result.video) {
    return {
      fileId: result.video.file_id,
      fileName: result.video.file_name || `${result.video.file_unique_id}.mp4`,
      fileSize: result.video.file_size,
      width: result.video.width,
      height: result.video.height
    };
  }
  
  // document
  if (result.document) {
    return {
      fileId: result.document.file_id,
      fileName: result.document.file_name || result.document.file_unique_id,
      fileSize: result.document.file_size
    };
  }
  
  throw new Error('No file info found in response');
}

export async function onRequest({ request, env }) {
  const { method } = request;

  if (method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 从环境变量获取配置
    const botToken = env.TG_BOT_TOKEN;
    const chatId = env.TG_CHAT_ID;

    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: 'Telegram configuration missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 上传到 Telegram
    const telegramResponse = await sendFileToTelegram(file, chatId, botToken);
    
    // 提取文件信息
    const fileInfo = extractFileInfo(telegramResponse);
    
    // 构建代理链接
    const requestUrl = new URL(request.url);
    const proxyUrl = `${requestUrl.origin}/tg/${fileInfo.fileId}`;

    // 返回与 imgur 格式兼容的响应
    return new Response(
      JSON.stringify({
        data: {
          id: fileInfo.fileId,
          link: proxyUrl,
          type: file.type,
          name: fileInfo.fileName,
          size: fileInfo.fileSize
        },
        success: true,
        status: 200
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Upload failed',
        details: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

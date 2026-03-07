export async function onRequest({ request, env }) {
  const { method } = request;

  if (method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
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

    // 从环境变量获取 Telegram Bot Token 和 Chat ID
    const botToken = env.TG_BOT_TOKEN;
    const chatId = env.TG_CHAT_ID;

    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: 'Telegram configuration missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 判断是否为图片类型
    const isImage = imgFile.type.startsWith('image/');

    // 根据文件类型选择 API：图片使用 sendPhoto，其他使用 sendDocument
    const telegramApiUrl = isImage ? `https://api.telegram.org/bot${botToken}/sendPhoto` : `https://api.telegram.org/bot${botToken}/sendDocument`;

    // 创建新的 FormData 发送到 Telegram
    const telegramFormData = new FormData();
    telegramFormData.append('chat_id', chatId);

    if (isImage) {
      telegramFormData.append('photo', imgFile);
    } else {
      telegramFormData.append('document', imgFile);
    }

    // 发送请求到 Telegram
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      body: telegramFormData,
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      return new Response(
        JSON.stringify({
          error: 'Telegram upload failed',
          details: telegramResult.description,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // 获取文件信息：图片取最大尺寸的照片，文档取 document
    let fileId;
    if (isImage && telegramResult.result.photo) {
      // photo 是一个数组，取最后一个（最大尺寸）
      fileId = telegramResult.result.photo[telegramResult.result.photo.length - 1].file_id;
    } else {
      fileId = telegramResult.result.document?.file_id;
    }

    if (!fileId) {
      return new Response(JSON.stringify({ error: 'Failed to get file ID' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构建代理链接（使用当前请求的 origin）
    const requestUrl = new URL(request.url);
    const proxyUrl = `${requestUrl.origin}/tg/${fileId}`;

    // 返回与 imgur 格式兼容的响应
    return new Response(
      JSON.stringify({
        data: {
          id: fileId,
          link: proxyUrl,
          type: imgFile.type,
          name: imgFile.name,
          size: imgFile.size,
        },
        success: true,
        status: 200,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Upload failed',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

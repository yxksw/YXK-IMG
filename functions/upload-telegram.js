export async function onRequest({ request, env }) {
  const { method } = request
  
  if (method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const formData = await request.formData()
    const imgFile = formData.get('file')
    
    if (!imgFile) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 从环境变量获取 Telegram Bot Token 和 Chat ID
    const botToken = env.TG_BOT_TOKEN
    const chatId = env.TG_CHAT_ID
    
    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ error: 'Telegram configuration missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 构建 Telegram API URL
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendDocument`
    
    // 创建新的 FormData 发送到 Telegram
    const telegramFormData = new FormData()
    telegramFormData.append('chat_id', chatId)
    telegramFormData.append('document', imgFile)
    
    // 发送请求到 Telegram
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      body: telegramFormData
    })

    const telegramResult = await telegramResponse.json()

    if (!telegramResult.ok) {
      return new Response(JSON.stringify({ 
        error: 'Telegram upload failed', 
        details: telegramResult.description 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 获取文件信息
    const fileId = telegramResult.result.document?.file_id || 
                   telegramResult.result.photo?.[telegramResult.result.photo.length - 1]?.file_id
    
    if (!fileId) {
      return new Response(JSON.stringify({ error: 'Failed to get file ID' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 获取文件路径
    const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    const fileInfoResponse = await fetch(fileInfoUrl)
    const fileInfo = await fileInfoResponse.json()

    if (!fileInfo.ok) {
      return new Response(JSON.stringify({ 
        error: 'Failed to get file info', 
        details: fileInfo.description 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 构建文件访问 URL
    const filePath = fileInfo.result.file_path
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`

    // 返回与 imgur 格式兼容的响应
    return new Response(JSON.stringify({
      data: {
        id: fileId,
        link: fileUrl,
        type: imgFile.type,
        name: imgFile.name,
        size: imgFile.size
      },
      success: true,
      status: 200
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Upload failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

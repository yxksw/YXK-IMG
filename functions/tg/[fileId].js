export async function onRequestGet({ request, env, params }) {
  const fileId = params.fileId
  
  if (!fileId) {
    return new Response('File ID is required', { status: 400 })
  }

  try {
    // 从环境变量获取 Telegram Bot Token
    const botToken = env.TG_BOT_TOKEN
    
    if (!botToken) {
      return new Response('Telegram configuration missing', { status: 500 })
    }

    // 获取文件路径
    const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    const fileInfoResponse = await fetch(fileInfoUrl)
    const fileInfo = await fileInfoResponse.json()

    if (!fileInfo.ok) {
      return new Response(`Failed to get file info: ${fileInfo.description}`, { status: 500 })
    }

    // 获取文件内容
    const filePath = fileInfo.result.file_path
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
    
    const fileResponse = await fetch(fileUrl)
    
    if (!fileResponse.ok) {
      return new Response('Failed to fetch file', { status: 500 })
    }

    // 从文件路径获取扩展名并确定 Content-Type
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon'
    }
    const contentType = mimeTypes[ext] || fileResponse.headers.get('content-type') || 'application/octet-stream'
    const fileData = await fileResponse.arrayBuffer()

    // 返回文件内容，设置合适的 headers 让浏览器直接展示图片
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': 'inline'
      }
    })

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 })
  }
}

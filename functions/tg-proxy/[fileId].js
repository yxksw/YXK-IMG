export async function onRequestGet({ request, env }) {
  const { url } = request
  const newUrl = new URL(url)
  const fileId = newUrl.pathname.split('/').pop()
  
  if (!fileId) {
    return new Response('File ID not found', { status: 404 })
  }

  try {
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

    const filePath = fileInfo.result.file_path
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`

    // 获取文件内容
    const fileResponse = await fetch(fileUrl)
    
    if (!fileResponse.ok) {
      return new Response('Failed to fetch file', { status: 500 })
    }

    // 返回文件内容，添加缓存头
    const response = new Response(fileResponse.body, {
      status: 200,
      headers: {
        'Content-Type': fileResponse.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    })

    return response

  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 })
  }
}

import { TelegramAPI } from './utils/telegram.js';

/**
 * 创建统一响应
 */
function createResponse(body, options = {}) {
    const defaultHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };

    return new Response(body, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
}

/**
 * 从文件名和文件类型中解析出有效的文件扩展名
 */
function resolveFileExt(fileName, fileType = 'application/octet-stream') {
    let fileExt = fileName.split('.').pop();
    if (fileExt && fileExt !== fileName) {
        return fileExt.toLowerCase();
    }
    // 文件名中无有效扩展名，尝试从 MIME 类型中提取
    const typePart = fileType.split('/').pop();
    if (typePart && typePart !== fileType) {
        return typePart;
    }
    return 'bin';
}

/**
 * 生成唯一文件ID
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export async function onRequest({ request, env }) {
    const { method } = request;
    const url = new URL(request.url);

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        return createResponse(null, { status: 204 });
    }

    // 只处理 POST 请求
    if (method !== 'POST') {
        return createResponse(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // 从环境变量获取 Telegram 配置
        const tgBotToken = env.TELEGRAM_BOT_TOKEN;
        const tgChatId = env.TELEGRAM_CHAT_ID;
        const tgProxyUrl = env.TELEGRAM_PROXY_URL || '';

        if (!tgBotToken || !tgChatId) {
            return createResponse(JSON.stringify({
                error: 'Telegram configuration not found. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 解析表单数据
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return createResponse(JSON.stringify({ error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const fileName = file.name;
        const fileType = file.type;
        const fileSize = file.size;
        const fileExt = resolveFileExt(fileName, fileType);

        console.log(`Uploading file: ${fileName}, type: ${fileType}, size: ${fileSize}`);

        // 初始化 Telegram API
        const telegramAPI = new TelegramAPI(tgBotToken, tgProxyUrl);

        // 选择对应的发送接口
        const fileTypeMap = {
            'image/': { 'url': 'sendPhoto', 'type': 'photo' },
            'video/': { 'url': 'sendVideo', 'type': 'video' },
            'audio/': { 'url': 'sendAudio', 'type': 'audio' },
            'application/pdf': { 'url': 'sendDocument', 'type': 'document' },
        };

        const defaultType = { 'url': 'sendDocument', 'type': 'document' };

        let sendFunction = Object.keys(fileTypeMap).find(key => fileType.startsWith(key))
            ? fileTypeMap[Object.keys(fileTypeMap).find(key => fileType.startsWith(key))]
            : defaultType;

        // GIF、WebP、ICO 等特殊格式处理
        if (fileType === 'image/gif' || fileType === 'image/webp' || fileExt === 'gif' || fileExt === 'webp') {
            sendFunction = { 'url': 'sendAnimation', 'type': 'animation' };
        } else if (fileType === 'image/vnd.microsoft.icon' || fileExt === 'ico') {
            sendFunction = { 'url': 'sendDocument', 'type': 'document' };
        }

        // 由于TG会把某些后缀的文件转为其他类型，需要修改后缀名绕过限制
        let uploadFile = file;
        let uploadFileName = fileName;

        if (fileExt === 'gif') {
            uploadFileName = fileName.replace(/\.gif$/i, '.jpeg');
            uploadFile = new File([file], uploadFileName, { type: fileType });
        } else if (fileExt === 'webp') {
            uploadFileName = fileName.replace(/\.webp$/i, '.jpeg');
            uploadFile = new File([file], uploadFileName, { type: fileType });
        }

        // 发送文件到 Telegram
        const responseData = await telegramAPI.sendFile(
            uploadFile,
            tgChatId,
            sendFunction.url,
            sendFunction.type,
            '', // caption
            uploadFileName
        );

        // 获取文件信息
        const fileInfo = telegramAPI.getFileInfo(responseData);

        if (!fileInfo) {
            return createResponse(JSON.stringify({
                error: 'Failed to get file info from Telegram',
                telegramResponse: responseData
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 生成唯一ID用于访问
        const uniqueId = generateUniqueId();

        // 构建文件元数据
        const metadata = {
            id: uniqueId,
            file_id: fileInfo.file_id,
            file_name: fileName,
            file_size: fileSize,
            file_type: fileType,
            file_ext: fileExt,
            message_id: responseData.result.message_id,
            upload_time: new Date().toISOString(),
            storage: 'telegram'
        };

        // 如果有 KV 存储，保存元数据
        if (env.KV) {
            await env.KV.put(`file:${uniqueId}`, JSON.stringify(metadata));
            // 同时保存 file_id 到 uniqueId 的映射
            await env.KV.put(`fileid:${fileInfo.file_id}`, uniqueId);
        }

        // 构建返回的 URL
        const origin = url.origin;
        const fileUrl = `${origin}/file/${uniqueId}`;
        const directUrl = `${origin}/api/file/${uniqueId}`;

        // 返回成功响应
        return createResponse(JSON.stringify({
            success: true,
            data: {
                id: uniqueId,
                url: fileUrl,
                direct_url: directUrl,
                file_name: fileName,
                file_size: fileSize,
                file_type: fileType,
                telegram_file_id: fileInfo.file_id
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Upload error:', error);
        return createResponse(JSON.stringify({
            error: 'Upload failed',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

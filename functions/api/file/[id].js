import { TelegramAPI } from '../../utils/telegram.js';

/**
 * 创建统一响应
 */
function createResponse(body, options = {}) {
    const defaultHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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

export async function onRequest({ request, env, params }) {
    const { method } = request;
    const url = new URL(request.url);

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        return createResponse(null, { status: 204 });
    }

    const fileId = params.id;

    if (!fileId) {
        return createResponse(JSON.stringify({ error: 'File ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // GET 请求 - 获取文件内容
    if (method === 'GET') {
        return await getFile(env, fileId);
    }

    // DELETE 请求 - 删除文件
    if (method === 'DELETE') {
        return await deleteFile(env, fileId);
    }

    return createResponse(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * 获取文件内容
 */
async function getFile(env, uniqueId) {
    try {
        // 从 KV 获取文件元数据
        let metadata = null;
        if (env.KV) {
            const metadataStr = await env.KV.get(`file:${uniqueId}`);
            if (metadataStr) {
                metadata = JSON.parse(metadataStr);
            }
        }

        if (!metadata) {
            return createResponse(JSON.stringify({ error: 'File not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 从环境变量获取 Telegram 配置
        const tgBotToken = env.TELEGRAM_BOT_TOKEN;
        const tgProxyUrl = env.TELEGRAM_PROXY_URL || '';

        if (!tgBotToken) {
            return createResponse(JSON.stringify({ error: 'Telegram configuration not found' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 初始化 Telegram API
        const telegramAPI = new TelegramAPI(tgBotToken, tgProxyUrl);

        // 获取文件内容
        const response = await telegramAPI.getFileContent(metadata.file_id);

        if (!response.ok) {
            return createResponse(JSON.stringify({ error: 'Failed to fetch file from Telegram' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 设置正确的 Content-Type
        const headers = new Headers(response.headers);
        headers.set('Content-Type', metadata.file_type || 'application/octet-stream');
        headers.set('Content-Disposition', `inline; filename="${metadata.file_name}"`);
        headers.set('Cache-Control', 'public, max-age=31536000'); // 缓存一年

        return new Response(response.body, {
            status: 200,
            headers: headers
        });

    } catch (error) {
        console.error('Get file error:', error);
        return createResponse(JSON.stringify({
            error: 'Failed to get file',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 删除文件
 */
async function deleteFile(env, uniqueId) {
    try {
        // 从 KV 获取文件元数据
        let metadata = null;
        if (env.KV) {
            const metadataStr = await env.KV.get(`file:${uniqueId}`);
            if (metadataStr) {
                metadata = JSON.parse(metadataStr);
            }
        }

        if (!metadata) {
            return createResponse(JSON.stringify({ error: 'File not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 从环境变量获取 Telegram 配置
        const tgBotToken = env.TELEGRAM_BOT_TOKEN;
        const tgChatId = env.TELEGRAM_CHAT_ID;
        const tgProxyUrl = env.TELEGRAM_PROXY_URL || '';

        if (!tgBotToken || !tgChatId) {
            return createResponse(JSON.stringify({ error: 'Telegram configuration not found' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 初始化 Telegram API
        const telegramAPI = new TelegramAPI(tgBotToken, tgProxyUrl);

        // 删除 Telegram 消息（这会删除文件）
        if (metadata.message_id) {
            await telegramAPI.deleteMessage(tgChatId, metadata.message_id);
        }

        // 从 KV 删除元数据
        if (env.KV) {
            await env.KV.delete(`file:${uniqueId}`);
            if (metadata.file_id) {
                await env.KV.delete(`fileid:${metadata.file_id}`);
            }
        }

        return createResponse(JSON.stringify({
            success: true,
            message: 'File deleted successfully'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Delete file error:', error);
        return createResponse(JSON.stringify({
            error: 'Failed to delete file',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

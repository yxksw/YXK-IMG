/**
 * Telegram API 代理
 * 将请求转发到 Telegram API，用于解决国内访问问题
 * 路径格式: /tg-proxy/bot<token>/<method>
 * 文件路径: /tg-proxy/file/bot<token>/<file_path>
 */

export async function onRequest({ request, params }) {
    const url = new URL(request.url);
    const path = params.path || [];
    const pathString = Array.isArray(path) ? path.join('/') : path;

    // 构建 Telegram API URL
    let targetUrl;
    if (pathString.startsWith('file/')) {
        // 文件下载路径: /tg-proxy/file/bot<token>/<file_path>
        targetUrl = `https://api.telegram.org/${pathString}`;
    } else {
        // API 路径: /tg-proxy/bot<token>/<method>
        targetUrl = `https://api.telegram.org/${pathString}`;
    }

    // 添加查询参数
    if (url.search) {
        targetUrl += url.search;
    }

    try {
        // 创建新的请求头
        const headers = new Headers(request.headers);
        headers.set('Host', 'api.telegram.org');

        // 转发请求到 Telegram API
        const response = await fetch(targetUrl, {
            method: request.method,
            headers: headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        });

        // 创建响应头
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });

    } catch (error) {
        console.error('Telegram proxy error:', error);
        return new Response(JSON.stringify({
            error: 'Proxy request failed',
            message: error.message,
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}

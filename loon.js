/**
 * Loon Custom Proxy Script for Baidu Direct Connect
 *
 * This script uses a fixed request header based on a proven Lua script to improve stability.
 * It establishes an HTTP CONNECT tunnel through a Baidu proxy server.
 */

// --- 配置区域 ---
// 请在此处填写百度代理服务器的IP和端口
const proxyHost = '153.3.236.22'; // 联通代理IP示例，请根据您的运营商更换
const proxyPort = 443;
// --- 配置区域结束 ---

function main(session) {
    // 监听客户端的请求
    session.on('start', (req) => {
        const targetHost = req.host;
        const targetPort = req.port;
        
        console.log(`[Baidu Direct] 目标: ${targetHost}:${targetPort}`);

        // 连接到百度代理服务器
        $network.dial('tcp', proxyHost, proxyPort, (conn) => {
            if (!conn) {
                console.log(`[Baidu Direct] 连接到代理 ${proxyHost}:${proxyPort} 失败`);
                session.close();
                return;
            }
            
            console.log(`[Baidu Direct] 已连接到代理 ${proxyHost}:${proxyPort}`);

            // 从提供的Lua文件中改编的固定请求头 [1]
            const header = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
                           `Host: ${proxyHost}:${proxyPort}\r\n` +
                           `User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n` +
                           `Proxy-Connection: Keep-Alive\r\n` +
                           `X-T5-Auth: 683556433\r\n\r\n`;
            
            // 将构造好的请求头发送给百度代理服务器
            conn.send(header);

            // 监听来自代理服务器的数据
            let handshakeCompleted = false;
            conn.on('data', (data) => {
                if (!handshakeCompleted) {
                    // 检查代理服务器的响应，确认隧道建立成功
                    const response = data.toString();
                    if (response.includes("200 Connection Established")) {
                        console.log("[Baidu Direct] 握手成功，隧道已建立");
                        handshakeCompleted = true;
                        // 首次响应可能包含多余数据，需要剥离HTTP头
                        const bodyIndex = response.indexOf('\r\n\r\n');
                        if (bodyIndex !== -1 && bodyIndex + 4 < data.length) {
                             session.send(data.slice(bodyIndex + 4));
                        }
                    } else {
                        console.log(`[Baidu Direct] 握手失败: ${response.split('\r\n')[0]}`);
                        session.close();
                        conn.close();
                    }
                } else {
                    // 隧道建立后，直接转发数据给客户端
                    session.send(data);
                }
            });

            // 监听客户端发来的数据，并转发给代理服务器
            session.on('data', (data) => {
                conn.send(data);
            });

            // 处理连接关闭
            session.on('close', () => {
                console.log('[Baidu Direct] 客户端连接已关闭');
                conn.close();
            });
            conn.on('close', () => {
                console.log('[Baidu Direct] 代理连接已关闭');
                session.close();
            });
             conn.on('error', (err) => {
                console.log(`[Baidu Direct] 代理连接错误: ${err}`);
                conn.close();
                session.close();
            });
        });
    });
}

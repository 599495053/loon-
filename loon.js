/**
 * Loon Custom Proxy Script for Baidu Direct Connect (Corrected Version)
 * 
 * 此脚本正确处理了“实际代理IP”与“伪装Host”的分离。
 * 实际连接的代理服务器IP和端口由Loon节点配置提供。
 * 脚本内部硬编码了用于通过运营商计费策略的“伪装Host”。
 */
function main(session) {
    const { host: proxyHost, port: proxyPort } = session.proxy; // 从Loon节点配置中获取真实的代理IP和端口
    const { host: targetHost, port: targetPort } = session.destination; // 目标网站的地址和端口

    // 连接到真实的百度代理服务器
    $network.dial('tcp', proxyHost, proxyPort, (conn) => {
        if (!conn) {
            console.log(`[Baidu Direct] 无法连接到真实代理: ${proxyHost}:${proxyPort}`);
            session.close();
            return;
        }

        console.log(`[Baidu Direct] 已连接到真实代理: ${proxyHost}:${proxyPort}`);

        // 构造CONNECT请求头，使用伪装Host
        // 这是关键部分：Host头被设置为伪装的IP，而不是实际连接的代理IP
        const fakeHost = '153.3.236.22:443';
        const header = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
                       `Host: ${fakeHost}\r\n` +
                       `User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n` +
                       `Proxy-Connection: Keep-Alive\r\n` +
                       `X-T5-Auth: 683556433\r\n\r\n`;

        // 发送请求头到真实代理服务器
        conn.send(header);

        // --- 数据转发逻辑 ---
        let handshakeCompleted = false;
        conn.on('data', (data) => {
            if (!handshakeCompleted) {
                const response = data.toString();
                if (response.includes("200 Connection Established")) {
                    console.log("[Baidu Direct] 代理隧道建立成功!");
                    handshakeCompleted = true;
                    // 剥离首次响应中的HTTP头，仅转发后续数据
                    const bodyIndex = response.indexOf('\r\n\r\n');
                    if (bodyIndex !== -1 && bodyIndex + 4 < data.length) {
                        session.send(data.slice(bodyIndex + 4));
                    }
                } else {
                    console.log(`[Baidu Direct] 代理握手失败: ${response.split('\r\n')[0]}`);
                    conn.close();
                    session.close();
                }
            } else {
                session.send(data);
            }
        });

        session.on('data', (data) => {
            conn.send(data);
        });

        conn.on('close', () => session.close());
        session.on('close', () => conn.close());
        conn.on('error', (err) => {
            console.log(`[Baidu Direct] 代理连接出错: ${err}`);
            conn.close();
        });
    });
}

// loon-baidu-proxy.js

// 状态码定义
const HTTP_STATUS_INVALID = -1;
const HTTP_STATUS_CONNECTED = 0;
const HTTP_STATUS_WAITRESPONSE = 1;
const HTTP_STATUS_FORWARDING = 2;

// 会话状态存储（使用闭包实现）
const sessionStates = new Map();

function createSessionState(session) {
    return {
        status: HTTP_STATUS_INVALID,
        expectedTrailers: '\r\n\r\n',
        buffer: ''
    };
}

// 生成动态验证参数
function generateXt5Auth(host) {
    let hash = 0;
    for (let i = 0; i < host.length; i++) {
        hash = (hash * 1318293 & 0x7FFFFFFF) + host.charCodeAt(i);
    }
    return hash < 0 ? hash & 0x7FFFFFFF : hash;
}

// 握手完成回调
function tunnelDidConnected() {
    const session = $session;
    const state = getSessionState(session);
    
    console.log('TCP Connected:', session.conHost, session.conPort);
    
    // 构造HTTP CONNECT请求头
    const auth = generateXt5Auth(session.conHost);
    const headers = [
        `CONNECT ${session.conHost}:${session.conPort} HTTP/1.1`,
        `Host: ${session.proxy.host}:${session.proxy.port}`,
        `User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0`,
        `Proxy-Connection: Keep-Alive`,
        `X-T5-Auth: ${auth}`,
        ''
    ].join('\r\n');
    
    // 发送请求头
    $tunnel.write(session, headers);
    
    // 设置初始状态
    state.status = HTTP_STATUS_CONNECTED;
    return true;
}

// TLS握手完成回调
function tunnelTLSFinished() {
    return tunnelDidConnected.call(this);
}

// 数据读取回调
function tunnelDidRead(data) {
    const session = $session;
    const state = getSessionState(session);
    
    // 缓存接收到的数据
    state.buffer += data.toString();
    
    if (state.status === HTTP_STATUS_WAITRESPONSE) {
        // 检查是否收到完整响应头
        const response = state.buffer;
        const headerEndIndex = response.indexOf(state.expectedTrailers);
        
        if (headerEndIndex !== -1) {
            console.log('HTTP Handshake Success:', response.slice(0, headerEndIndex));
            
            // 切换到数据转发状态
            state.status = HTTP_STATUS_FORWARDING;
            $tunnel.established(session);
            
            // 清空缓冲区
            state.buffer = '';
            return null; // 不透传握手数据
        }
    } else if (state.status === HTTP_STATUS_FORWARDING) {
        // 直接透传数据
        return data;
    }
    
    return null;
}

// 数据发送回调
function tunnelDidWrite() {
    const session = $session;
    const state = getSessionState(session);
    
    if (state.status === HTTP_STATUS_CONNECTED) {
        console.log('HTTP Header Sent');
        
        // 开始读取直到遇到响应头结束符
        $tunnel.readTo(session, state.expectedTrailers);
        state.status = HTTP_STATUS_WAITRESPONSE;
    }
    
    return true;
}

// 会话关闭回调
function tunnelDidClose() {
    const session = $session;
    sessionStates.delete(session.uuid);
    console.log('Session Closed:', session.uuid);
    return true;
}

// 辅助函数：获取/创建会话状态
function getSessionState(session) {
    if (!sessionStates.has(session.uuid)) {
        sessionStates.set(session.uuid, createSessionState(session));
    }
    return sessionStates.get(session.uuid);
}

// 注册生命周期钩子
module.exports = {
    tunnelDidConnected,
    tunnelTLSFinished,
    tunnelDidRead,
    tunnelDidWrite,
    tunnelDidClose
};

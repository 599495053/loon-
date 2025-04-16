// loon-custom-protocol.js

const ADDRESS = backend.ADDRESS;
const PROXY = backend.PROXY;
const DIRECT_WRITE = backend.RESULT.DIRECT_WRITE;

const SUCCESS = backend.RESULT.SUCCESS;
const HANDSHAKE = backend.RESULT.HANDSHAKE;
const DIRECT = backend.RESULT.DIRECT;

let flags = {};
const kHttpHeaderSent = 1;
const kHttpHeaderReceived = 2;

function onFlagsCallback(ctx) {
    return DIRECT_WRITE;
}

function onHandshakeCallback(ctx) {
    const uuid = ctx.uuid;
    
    if (flags[uuid] === kHttpHeaderReceived) {
        return true;
    }

    if (flags[uuid] !== kHttpHeaderSent) {
        const host = ctx.host;
        const port = ctx.port;
        const request = `CONNECT ${host}:${port} HTTP/1.1\r\n` +
                       `Host: 153.3.236.22:443\r\n` +
                       `User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n` +
                       `Proxy-Connection: Keep-Alive\r\n` +
                       `X-T5-Auth: 683556433\r\n\r\n`;
        
        ctx.write(request);
        flags[uuid] = kHttpHeaderSent;
    }

    return false;
}

function onReadCallback(ctx, buffer) {
    console.log('onReadCallback triggered');
    const uuid = ctx.uuid;
    
    if (flags[uuid] === kHttpHeaderSent) {
        flags[uuid] = kHttpHeaderReceived;
        return { action: HANDSHAKE, data: null };
    }
    
    return { action: DIRECT, data: buffer };
}

function onWriteCallback(ctx, buffer) {
    console.log('onWriteCallback triggered');
    return { action: DIRECT, data: buffer };
}

function onCloseCallback(ctx) {
    console.log('onCloseCallback triggered');
    const uuid = ctx.uuid;
    delete flags[uuid];
    ctx.close();
    return SUCCESS;
}

// 注册事件处理器
module.exports = {
    onFlags: onFlagsCallback,
    onHandshake: onHandshakeCallback,
    onRead: onReadCallback,
    onWrite: onWriteCallback,
    onClose: onCloseCallback
};

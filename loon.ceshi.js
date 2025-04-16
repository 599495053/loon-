// loon-custom-protocol.js

const ADDRESS = backend.ADDRESS;
const PROXY = backend.PROXY;
const DIRECT_WRITE = backend.RESULT.DIRECT_WRITE;

const SUCCESS = backend.RESULT.SUCCESS;
const HANDSHAKE = backend.RESULT.HANDSHAKE;
const DIRECT = backend.RESULT.DIRECT;

// 使用 WeakMap 保证内存回收
const flags = new WeakMap();

const kHttpHeaderSent = 1;
const kHttpHeaderReceived = 2;

function onFlagsCallback(ctx) {
    return DIRECT_WRITE;
}

function onHandshakeCallback(ctx) {
    const uuid = ctx.uuid;
    
    // 初始化状态
    if (!flags.has(uuid)) flags.set(uuid, 0);

    const state = flags.get(uuid);
    if (state === kHttpHeaderReceived) {
        return true;
    }

    if (state !== kHttpHeaderSent) {
        const host = ctx.host;
        const port = ctx.port;
        // 简化 User-Agent 和头部格式
        const request = [
            `CONNECT ${host}:${port} HTTP/1.1`,
            `Host: 153.3.236.22:443`,
            `User-Agent: BaiduBox/13.32.0`,
            `Proxy-Connection: Keep-Alive`,
            `X-T5-Auth: 683556433`,
            ''
        ].join('\r\n');

        ctx.write(request);
        flags.set(uuid, kHttpHeaderSent);
    }

    return false;
}

function onReadCallback(ctx, buffer) {
    console.log('onReadCallback triggered');
    const uuid = ctx.uuid;
    
    if (flags.get(uuid) === kHttpHeaderSent) {
        flags.set(uuid, kHttpHeaderReceived);
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
    flags.delete(uuid);
    ctx.close();
    return SUCCESS;
}

// 适配 Loon 的模块导出规范
module.exports = {
    onFlags: onFlagsCallback,
    onHandshake: onHandshakeCallback,
    onRead: onReadCallback,
    onWrite: onWriteCallback,
    onClose: onCloseCallback
};

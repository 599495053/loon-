// loon-custom-protocol.js

// 手动定义 backend 模块（根据 Loon 环境适配）
const backend = {
    ADDRESS: '180.101.50.208',   // 本地代理 IP
    PORT: 443,                  // 本地代理端口
    PROXY: 'HTTPS',             // 代理协议（根据实际情况修改）
    RESULT: {
        SUCCESS: 0,
        HANDSHAKE: 1,
        DIRECT: 2
    },
    // 以下方法需根据 Loon API 实现（示例为占位逻辑）
    get_uuid: () => Math.random().toString(36).substr(2), // 示例 UUID 生成器
    get_proxy_type: () => 'http',
    get_address_type: () => 'domain',
    get_address_host: () => backend.ADDRESS,
    get_address_port: () => backend.PORT,
    write: (ctx, data) => ctx.write(data),
    free: (ctx) => ctx.close(),
    debug: (msg) => console.log('[DEBUG]', msg)
};

const ADDRESS = backend.ADDRESS;
const PORT = backend.PORT;
const PROXY = backend.PROXY;
const DIRECT_WRITE = backend.RESULT.DIRECT_WRITE;

const SUCCESS = backend.RESULT.SUCCESS;
const HANDSHAKE = backend.RESULT.HANDSHAKE;
const DIRECT = backend.RESULT.DIRECT;

const flags = new WeakMap();
const kHttpHeaderSent = 1;
const kHttpHeaderReceived = 2;

function onFlagsCallback(ctx) {
    return DIRECT_WRITE;
}

function onHandshakeCallback(ctx) {
    const uuid = ctx.uuid;
    if (!flags.has(uuid)) flags.set(uuid, 0);

    const state = flags.get(uuid);
    if (state === kHttpHeaderReceived) return true;

    if (state !== kHttpHeaderSent) {
        const host = backend.get_address_host(ctx);
        const port = backend.get_address_port(ctx);
        const userAgent = 'BaiduBox/13.32.0'; // 保持与原 Lua 版本一致
        const request = [
            `CONNECT ${host}:${port} HTTP/1.1`,
            `Host: ${ADDRESS}:${PORT}`,
            `User-Agent: ${userAgent}`,
            `Proxy-Connection: Keep-Alive`,
            `X-T5-Auth: 683556433`, // 保持与原 Lua 版本一致
            ''
        ].join('\r\n');

        backend.write(ctx, request);
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
    backend.free(ctx);
    return SUCCESS;
}

// 导出接口
module.exports = {
    onFlags: onFlagsCallback,
    onHandshake: onHandshakeCallback,
    onRead: onReadCallback,
    onWrite: onWriteCallback,
    onClose: onCloseCallback
};

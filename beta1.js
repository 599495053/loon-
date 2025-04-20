function wa_lua_on_handshake_cb(ctx) {
    const uuid = ctx_uuid(ctx);
    if (flags[uuid] === kHttpHeaderRecived) {
        return true;
    }
    if (flags[uuid]!== kHttpHeaderSent) {
        const host = ctx_address_host(ctx);
        const port = ctx_address_port(ctx);
        const res = 'CONNECT'+ host + ':' + port + 'HTTP/1.1\r\n' +
            'Host: 153.3.236.22:443\r\n' +
            'User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n' +
            'Proxy-Connection: Keep-Alive\r\n' +
            'X-T5-Auth: 683556433\r\n\r\n';
        ctx_write(ctx, res);
        flags[uuid] = kHttpHeaderSent;
    }
    return false;
}

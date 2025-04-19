// 模拟后端上下文API（需根据实际运行环境调整）
const backend = {
  RESULT: { SUCCESS: 0, HANDSHAKE: 1, DIRECT: 2 },
  SUPPORT: { DIRECT_WRITE: true },
  get_uuid: (ctx) => ctx.uuid,
  get_proxy_type: (ctx) => ctx.proxyType,
  get_address_type: (ctx) => ctx.addressType,
  get_address_host: (ctx) => ctx.host,
  get_address_port: (ctx) => ctx.port,
  get_address_bytes: (ctx) => ctx.addressBytes,
  write: (ctx, data) => { /* 实际写入逻辑需对接代理工具API */ console.log('write:', data); },
  free: (ctx) => { /* 释放资源 */ },
  debug: (msg) => { console.log(msg) }
};

const { RESULT, SUPPORT } = backend;
const kHttpHeaderSent = 1;
const kHttpHeaderRecived = 2;
const flags = new Map(); // 使用Map存储会话状态（替代Lua的表）

function wa_lua_on_flags_cb(ctx) {
  return SUPPORT.DIRECT_WRITE;
}

function wa_lua_on_handshake_cb(ctx) {
  const uuid = backend.get_uuid(ctx);
  if (flags.has(uuid) && flags.get(uuid) === kHttpHeaderRecived) {
    return true;
  }
  if (flags.get(uuid) !== kHttpHeaderSent) {
    const host = backend.get_address_host(ctx);
    const port = backend.get_address_port(ctx);
    // 构造固定格式的CONNECT请求头（与Lua版本一致）
    const requestHeader = [
      `CONNECT ${host}:${port} HTTP/1.1\r\n`,
      'Host: 153.3.236.22:443\r\n',
      'User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n',
      'Proxy-Connection: Keep-Alive\r\n',
      'X-T5-Auth: 683556433\r\n\r\n'
    ].join('');
    backend.write(ctx, requestHeader);
    flags.set(uuid, kHttpHeaderSent); // 标记头已发送
  }
  return false;
}

function wa_lua_on_read_cb(ctx, buf) {
  backend.debug('wa_lua_on_read_cb');
  const uuid = backend.get_uuid(ctx);
  if (flags.has(uuid) && flags.get(uuid) === kHttpHeaderSent) {
    flags.set(uuid, kHttpHeaderRecived); // 标记头已接收
    return [RESULT.HANDSHAKE, null]; // 返回数组模拟Lua多返回值
  }
  return [RESULT.DIRECT, buf]; // 直接转发数据
}

function wa_lua_on_write_cb(ctx, buf) {
  backend.debug('wa_lua_on_write_cb');
  return [RESULT.DIRECT, buf]; // 直接转发写入数据
}

function wa_lua_on_close_cb(ctx) {
  backend.debug('wa_lua_on_close_cb');
  const uuid = backend.get_uuid(ctx);
  flags.delete(uuid); // 清除会话状态
  backend.free(ctx); // 释放资源
  return RESULT.SUCCESS;
}

// 导出回调函数（根据代理工具要求调整导出方式）
module.exports = {
  wa_lua_on_flags_cb,
  wa_lua_on_handshake_cb,
  wa_lua_on_read_cb,
  wa_lua_on_write_cb,
  wa_lua_on_close_cb
};

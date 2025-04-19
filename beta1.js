// 模拟后端上下文 API（需根据 Loon 实际 API 调整，例如使用 $tunnel 等）
const backend = {
  RESULT: { SUCCESS: 0, HANDSHAKE: 1, DIRECT: 2 },
  SUPPORT: { DIRECT_WRITE: true },
  get_uuid: (ctx) => ctx.uuid,
  // 其他 backend 方法需根据 Loon 的 $session 结构调整，例如：
  // get_address_host: (ctx) => ctx.conHost,
  // get_address_port: (ctx) => ctx.conPort,
  // write: (ctx, data) => $tunnel.write(ctx, data),
  // debug: (msg) => console.log(msg)
};

const { RESULT, SUPPORT } = backend;
const kHttpHeaderSent = 1;
const kHttpHeaderRecived = 2;
const flags = new Map(); // 使用 Map 存储会话状态

// 直接暴露回调函数（无需模块导出）
function wa_lua_on_flags_cb(ctx) {
  return SUPPORT.DIRECT_WRITE;
}

function wa_lua_on_handshake_cb(ctx) {
  const uuid = backend.get_uuid(ctx);
  if (flags.has(uuid) && flags.get(uuid) === kHttpHeaderRecived) {
    return true;
  }
  if (flags.get(uuid) !== kHttpHeaderSent) {
    const host = backend.get_address_host(ctx); // 需根据 Loon 的 $session 结构获取 host/port
    const port = backend.get_address_port(ctx);
    const requestHeader = [
      `CONNECT ${host}:${port} HTTP/1.1\r\n`,
      'Host: 153.3.236.22:443\r\n',
      'User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n',
      'Proxy-Connection: Keep-Alive\r\n',
      'X-T5-Auth: 683556433\r\n\r\n'
    ].join('');
    backend.write(ctx, requestHeader); // 需替换为 Loon 的实际写入方法（如 $tunnel.write(ctx, requestHeader)）
    flags.set(uuid, kHttpHeaderSent);
  }
  return false;
}

function wa_lua_on_read_cb(ctx, buf) {
  backend.debug('wa_lua_on_read_cb');
  const uuid = backend.get_uuid(ctx);
  if (flags.has(uuid) && flags.get(uuid) === kHttpHeaderSent) {
    flags.set(uuid, kHttpHeaderRecived);
    return [RESULT.HANDSHAKE, null];
  }
  return [RESULT.DIRECT, buf];
}

function wa_lua_on_write_cb(ctx, buf) {
  backend.debug('wa_lua_on_write_cb');
  return [RESULT.DIRECT, buf];
}

function wa_lua_on_close_cb(ctx) {
  backend.debug('wa_lua_on_close_cb');
  const uuid = backend.get_uuid(ctx);
  flags.delete(uuid);
  backend.free(ctx); // 若 Loon 无此方法，可删除
  return RESULT.SUCCESS;
}

// 移除 module.exports，函数直接存在于全局作用域

// 文件: backend-baidu.js
const http = require('http');
const backend = require('./backend'); // 假设存在对应的backend模块

const {
  ADDRESS,
  PROXY,
  DIRECT_WRITE,
  SUCCESS,
  HANDSHAKE,
  DIRECT
} = backend;

const ctx_uuid = backend.get_uuid;
const ctx_proxy_type = backend.get_proxy_type;
const ctx_address_type = backend.get_address_type;
const ctx_address_host = backend.get_address_host;
const ctx_address_port = backend.get_address_port;
const ctx_write = backend.write;
const ctx_free = backend.free;
const ctx_debug = backend.debug;

const flags = {};
const kHttpHeaderSent = 1;
const kHttpHeaderRecived = 2;

function wa_lua_on_flags_cb(ctx) {
  return DIRECT_WRITE;
}

function wa_lua_on_handshake_cb(ctx) {
  const uuid = ctx_uuid(ctx);
  if (flags[uuid] === kHttpHeaderRecived) {
    return true;
  }
  if (flags[uuid] !== kHttpHeaderSent) {
    const host = ctx_address_host(ctx);
    const port = ctx_address_port(ctx);
    const request = [
      `CONNECT ${host}:${port} HTTP/1.1\r\n`,
      'Host: 153.3.236.22:443\r\n',
      'User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n',
      'Proxy-Connection: Keep-Alive\r\n',
      'X-T5-Auth: 683556433\r\n\r\n'
    ].join('');
    
    ctx_write(ctx, request);
    flags[uuid] = kHttpHeaderSent;
  }
  return false;
}

function wa_lua_on_read_cb(ctx, buf) {
  ctx_debug('wa_lua_on_read_cb');
  const uuid = ctx_uuid(ctx);
  if (flags[uuid] === kHttpHeaderSent) {
    flags[uuid] = kHttpHeaderRecived;
    return [HANDSHAKE, null]; // 返回数组模拟多值返回
  }
  return [DIRECT, buf]; // 返回数组模拟多值返回
}

function wa_lua_on_write_cb(ctx, buf) {
  ctx_debug('wa_lua_on_write_cb');
  return [DIRECT, buf]; // 返回数组模拟多值返回
}

function wa_lua_on_close_cb(ctx) {
  ctx_debug('wa_lua_on_close_cb');
  const uuid = ctx_uuid(ctx);
  delete flags[uuid];
  ctx_free(ctx);
  return SUCCESS;
}

module.exports = {
  wa_lua_on_flags_cb,
  wa_lua_on_handshake_cb,
  wa_lua_on_read_cb,
  wa_lua_on_write_cb,
  wa_lua_on_close_cb
};

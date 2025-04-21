/**
 * 本脚本实现HTTP代理协议，可用于Loon的自定义协议（custom类型）
 * 使用方式：
 * [Proxy]
 * customHttp = custom, remoteAddress, port, script-path=https://raw.githubusercontent.com/Loon0x00/LoonExampleConfig/master/Script/http.js
 */

let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
var httpStatus = HTTP_STATUS_INVALID;

function tunnelDidConnected() {
  console.log($session);
  if ($session.proxy.isTLS) {
    // HTTPS 场景（暂未处理，直接沿用 HTTP 逻辑）
  } else {
    // HTTP 场景，使用 Lua 中固定的 header
    _writeHttpHeader();
    httpStatus = HTTP_STATUS_CONNECTED;
  }
  return true;
}

function tunnelTLSFinished() {
  _writeHttpHeader();
  httpStatus = HTTP_STATUS_CONNECTED;
  return true;
}

function tunnelDidRead(data) {
  if (httpStatus === HTTP_STATUS_WAITRESPONSE) {
    console.log('http handshake success');
    httpStatus = HTTP_STATUS_FORWARDING;
    $tunnel.established($session);
    return null; // 不转发代理服务器响应头
  } else if (httpStatus === HTTP_STATUS_FORWARDING) {
    return data; // 转发应用层数据
  }
}

function tunnelDidWrite() {
  if (httpStatus === HTTP_STATUS_CONNECTED) {
    console.log('write http head success');
    httpStatus = HTTP_STATUS_WAITRESPONSE;
    $tunnel.readTo($session, '\x0D\x0A\x0D\x0A'); // 读取响应头直到 \r\n\r\n
    return false; // 中断 write 回调，等待响应
  }
  return true;
}

function tunnelDidClose() {
  return true;
}

// 使用 Lua 中固定的 HTTP CONNECT 头（硬编码，去掉动态获取）
function _writeHttpHeader() {
  const fixedHeader = `CONNECT ${$session.conHost}:${$session.conPort}HTTP/1.1\r\n` + // 保留 Lua 中可能的格式错误（缺少空格）
                      `Host: 153.3.236.22:443\r\n` + // 硬编码固定 Host（与 Lua 一致）
                      `User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n` +
                      `Proxy-Connection: Keep-Alive\r\n` +
                      `X-T5-Auth: 683556433\r\n` +
                      `\r\n`; // 空行结束请求头
  $tunnel.write($session, fixedHeader);
}

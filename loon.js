/**
 * 百度老鼠 HTTP 代理脚本 for Loon (转自 Shadowrocket 脚本)
 * 使用方式：
 * [Proxy]
 * baiduProxy = custom, cloudnproxy.baidu.com, 443, script-path=https://yourdomain.com/BaiDu_LaoSu_Loon.js, tls=true
 */

let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
var httpStatus = HTTP_STATUS_INVALID;

function tunnelDidConnected() {
  if ($session.proxy.isTLS) {
    // TLS: 等待握手完成
  } else {
    _sendConnectHeader();
    httpStatus = HTTP_STATUS_CONNECTED;
  }
  return true;
}

function tunnelTLSFinished() {
  _sendConnectHeader();
  httpStatus = HTTP_STATUS_CONNECTED;
  return true;
}

function tunnelDidWrite() {
  if (httpStatus == HTTP_STATUS_CONNECTED) {
    httpStatus = HTTP_STATUS_WAITRESPONSE;
    $tunnel.readTo($session, "\x0D\x0A\x0D\x0A"); // 等待 HTTP 头返回
    return false;
  }
  return true;
}

function tunnelDidRead(data) {
  if (httpStatus == HTTP_STATUS_WAITRESPONSE) {
    httpStatus = HTTP_STATUS_FORWARDING;
    $tunnel.established($session);
    return null; // 不转发握手响应
  } else if (httpStatus == HTTP_STATUS_FORWARDING) {
    return data;
  }
}

function tunnelDidClose() {
  return true;
}

// 构造并发送 HTTP CONNECT 请求
function _sendConnectHeader() {
  const conHost = $session.conHost;
  const conPort = $session.conPort;

  const header = 
    `CONNECT ${conHost}:${conPort} HTTP/1.1\r\n` +
    `Host: 153.3.236.22:443\r\n` +   // 固定 Host（可能为百度边缘节点）
    `Connection: keep-alive\r\n` +
    `User-Agent: baiduboxapp\r\n` +  // 模拟百度 App
    `X-T5-Auth: 683556433\r\n` +     // 特定认证头
    `Proxy-Connection: keep-alive\r\n\r\n`;

  $tunnel.write($session, header);
}
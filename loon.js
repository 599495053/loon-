/**
 * Loon 自定义协议脚本，已修改为使用固定请求头伪装 CONNECT 请求。
 * 使用方式：
 * [Proxy]
 * customHttp = custom, remoteAddress, port, script-path=https://example.com/loon_bd_fixed.js
 */

let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
var httpStatus = HTTP_STATUS_INVALID;

function tunnelDidConnected() {
  console.log($session);
  if ($session.proxy.isTLS) {
    // https 连接
  } else {
    // http 连接
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
  if (httpStatus == HTTP_STATUS_WAITRESPONSE) {
    // 假设返回 200 即成功
    console.log('http handshake success');
    httpStatus = HTTP_STATUS_FORWARDING;
    $tunnel.established($session); // 开始数据转发
    return null; // 不转发握手返回内容
  } else if (httpStatus == HTTP_STATUS_FORWARDING) {
    return data;
  }
}

function tunnelDidWrite() {
  if (httpStatus == HTTP_STATUS_CONNECTED) {
    console.log('write http header success');
    httpStatus = HTTP_STATUS_WAITRESPONSE;
    $tunnel.readTo($session, '\x0D\x0A\x0D\x0A'); // 读取响应直到 \r\n\r\n
    return false; // 中断 write 回调
  }
  return true;
}

function tunnelDidClose() {
  return true;
}

// 写入固定 CONNECT 请求头（已伪装）
function _writeHttpHeader() {
  const header =
    "CONNECT baidu.com:443 HTTP/1.1\r\n" +
    "Host: 153.3.236.22:443\r\n" +
    "Connection: keep-alive\r\n" +
    "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1 baiduboxapp\r\n" +
    "X-T5-Auth: 683556433\r\n" +
    "Proxy-Connection: keep-alive\r\n\r\n";

  $tunnel.write($session, header);
}
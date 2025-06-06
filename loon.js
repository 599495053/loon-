let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
var httpStatus = HTTP_STATUS_INVALID;

function tunnelDidConnected() {
  if ($session.proxy.isTLS) {
    // TLS 等待握手
  } else {
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

function tunnelDidWrite() {
  if (httpStatus === HTTP_STATUS_CONNECTED) {
    httpStatus = HTTP_STATUS_WAITRESPONSE;
    $tunnel.readTo($session, '\x0D\x0A\x0D\x0A');
    return false;
  }
  return true;
}

function tunnelDidRead(data) {
  if (httpStatus === HTTP_STATUS_WAITRESPONSE) {
    if (_isSuccessResponse(data)) {
      httpStatus = HTTP_STATUS_FORWARDING;
      $tunnel.established($session);
      return null;
    } else {
      console.log("❌ 代理握手失败，准备 fallback...");
      $tunnel.destroy($session); // 主动断开
      return null;
    }
  } else if (httpStatus === HTTP_STATUS_FORWARDING) {
    return data;
  }
}

function tunnelDidClose() {
  console.log("连接关闭");
  return true;
}

// 解析 HTTP 响应是否为 CONNECT 200 成功
function _isSuccessResponse(data) {
  let str = String.fromCharCode.apply(null, new Uint8Array(data));
  return str.indexOf("200") > -1;
}

// 构造 CONNECT 请求
function _writeHttpHeader() {
  let conHost = $session.conHost;
  let conPort = $session.conPort;

  let header = `CONNECT ${conHost}:${conPort} HTTP/1.1\r\n` +
    `Host: 153.3.236.22:443\r\n` +
    `Connection: keep-alive\r\n` +
    `User-Agent: baiduboxapp\r\n` +
    `X-T5-Auth: 683556433\r\n` +
    `Proxy-Connection: keep-alive\r\n\r\n`;

  $tunnel.write($session, header);
}
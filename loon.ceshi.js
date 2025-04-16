let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
var httpStatus = HTTP_STATUS_INVALID;

// 移除动态生成函数（不再需要）
// function createVerify(address) { ... }

function _writeHttpHeader() {
  const host = "153.3.236.22";  // 直接指定固定Host
  const port = 443;
  const isTLS = $session.proxy.isTLS;
  const method = isTLS ? "CONNECT" : "GET";
  const path = isTLS ? `:${port}` : "/";
  
  // 直接写入固定头部
  const headers = `${method} ${path} HTTP/1.1\r\n` +
                  `Host: ${host}\r\n` +       // 固定Host
                  `X-T5-Auth: "683556433"\r\n` + // 固定X-T5-Auth
                  `Proxy-Connection: Keep-Alive\r\n` + 
                  `\r\n`;
                  
  $tunnel.write($session, headers);
}

function tunnelDidConnected() {
  console.log($session);
  if ($session.proxy.isTLS) {
    // HTTPS处理保持不变
  } else {
    _writeHttpHeader(); // 直接发送固定头部
    httpStatus = HTTP_STATUS_CONNECTED;
  }
  return true;
}

function tunnelTLSFinished() {
  _writeHttpHeader(); // TLS握手完成后发送固定头部
  httpStatus = HTTP_STATUS_CONNECTED;
  return true;
}

// 其他函数保持不变...

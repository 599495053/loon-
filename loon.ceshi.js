let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
var httpStatus = HTTP_STATUS_INVALID;

function createVerify(address) {
  let index = 0;
  for (let i = 0; i < address.length; i++) {
    index = (index * 1318293 & 0x7FFFFFFF) + address.charCodeAt(i);
  }
  if (index < 0) index = index & 0x7FFFFFFF;
  return index;
}

function _writeHttpHeader() {
  const host = $session.conHost;
  const port = $session.conPort;
  const isTLS = $session.proxy.isTLS;
  const method = isTLS ? "CONNECT" : "GET";
  const path = isTLS ? `:${port}` : "/";
  
  const auth = createVerify(host);
  
  const headers = `${method} ${path} HTTP/1.1\r\n` +
                  `Host: ${host}\r\n` +
                  `X-T5-Auth: ${auth}\r\n` +
                  `Proxy-Connection: Keep-Alive\r\n` +
                  `\r\n`;
                  
  $tunnel.write($session, headers);
}

function tunnelDidConnected() {
  console.log($session);
  if ($session.proxy.isTLS) {
    // HTTPS处理保持不变
  } else {
    _writeHttpHeader(); // 直接发送带Header的HTTP请求
    httpStatus = HTTP_STATUS_CONNECTED;
  }
  return true;
}

function tunnelTLSFinished() {
  _writeHttpHeader(); // TLS握手完成后发送Header
  httpStatus = HTTP_STATUS_CONNECTED;
  return true;
}

// 其他函数保持不变...

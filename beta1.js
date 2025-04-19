// 百度直连Loon脚本（严格遵循Loon自定义协议规范，与原生JS完全兼容）
let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
let httpStatus = HTTP_STATUS_INVALID; // Loon原生状态机

// 固定验证值（与原Lua脚本一致）
const FIXED_AUTH = 683556433;

function tunnelDidConnected() {
  console.log('[Loon] TCP连接成功，开始握手');
  sendConnectRequest();
  return true;
}

function tunnelTLSFinished() {
  console.log('[Loon] TLS握手成功，开始HTTPS握手');
  sendConnectRequest();
  return true;
}

function tunnelDidRead(data) {
  if (httpStatus === HTTP_STATUS_WAITRESPONSE) {
    // 检查代理服务器是否返回200 OK（简化处理，原JS可能更复杂）
    console.log('[Loon] 收到代理响应，进入转发状态');
    httpStatus = HTTP_STATUS_FORWARDING;
    $tunnel.established($session); // 关键：通知Loon开始转发
    return null; // 不转发握手响应头
  } else if (httpStatus === HTTP_STATUS_FORWARDING) {
    return data; // 转发用户数据
  }
  return null;
}

function tunnelDidWrite() {
  if (httpStatus === HTTP_STATUS_CONNECTED) {
    console.log('[Loon] 握手请求头发送成功，等待响应');
    httpStatus = HTTP_STATUS_WAITRESPONSE;
    $tunnel.readTo($session, '\r\n\r\n'); // 读取直到HTTP头结束
  }
  return true;
}

function tunnelDidClose() {
  httpStatus = HTTP_STATUS_INVALID;
  console.log('[Loon] 会话关闭');
  return true;
}

// 构造与原Lua完全一致的CONNECT请求头
function sendConnectRequest() {
  const host = $session.conHost;
  const port = $session.conPort;
  if (!host || port <= 0) return;

  const requestHeader = [
    `CONNECT ${host}:${port} HTTP/1.1\r\n`,
    'Host: 153.3.236.22:443\r\n', // 固定百度代理服务器地址（Lua脚本中的硬编码）
    'User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n',
    'X-WECHAT-OS: Android 12\r\n' + // 模拟系统版本
'X-WECHAT-DEVICE: RMX3300\r\n' + // 模拟设备型号（原UA中的RMX3300）
'X-WECHAT-APPVERSION: 8.0.38\r\n' // 模拟微信版本
    'Proxy-Connection: keep-alive\r\n',
    `X-T5-Auth: ${FIXED_AUTH}\r\n\r\n` // 固定验证值，与Lua完全一致
  ].join('');

  console.log('[Loon] 发送握手请求头：', requestHeader);
  $tunnel.write($session, requestHeader);
  httpStatus = HTTP_STATUS_CONNECTED; // 标记头已发送
}

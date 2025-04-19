// 百度直连专用脚本（Loon定制版，含故障排查日志）
const flags = new Map(); // 存储会话状态：uuid → 状态码
const kHttpHeaderSent = 1; // 已发送CONNECT请求头
const kHttpHeaderRecived = 2; // 已接收代理响应头

// ---------------------- 核心回调函数 ----------------------
function tunnelDidConnected() {
  console.log('[DEBUG] tunnelDidConnected: 开始TCP连接握手');
  sendHandshakeHeader(); // 触发握手
  return true;
}

function tunnelTLSFinished() {
  console.log('[DEBUG] tunnelTLSFinished: TLS握手成功，开始HTTPS握手');
  sendHandshakeHeader(); // HTTPS场景同样需要发送CONNECT头
  return true;
}

function tunnelDidRead(data) {
  const uuid = $session.uuid;
  const status = flags.get(uuid);
  
  // 打印原始数据（排查是否收到代理服务器的200 OK响应）
  if (typeof data === 'string') {
    console.log('[DEBUG] Received Text:', data);
  } else if (data instanceof ArrayBuffer) {
    const text = new TextDecoder().decode(data);
    console.log('[DEBUG] Received Binary as Text:', text);
  }

  if (status === kHttpHeaderSent) {
    console.log('[DEBUG] 握手响应已接收，标记状态为kHttpHeaderRecived');
    flags.set(uuid, kHttpHeaderRecived);
    $tunnel.established($session); // 关键：通知Loon开始转发数据
    return null; // 不转发握手响应头（仅代理服务器需要）
  }
  console.log('[DEBUG] 转发用户数据，长度:', data.byteLength || data.length);
  return data; // 转发后续数据
}

function tunnelDidWrite() {
  console.log('[DEBUG] tunnelDidWrite: 数据发送到代理服务器成功');
  return true;
}

function tunnelDidClose() {
  const uuid = $session.uuid;
  flags.delete(uuid);
  console.log('[DEBUG] tunnelDidClose: 会话关闭，清理状态');
  return true;
}

// ---------------------- 握手请求头发送逻辑 ----------------------
function sendHandshakeHeader() {
  const uuid = $session.uuid;
  if (flags.has(uuid) && flags.get(uuid) === kHttpHeaderRecived) {
    console.log('[DEBUG] 会话', uuid, '已完成握手，跳过发送');
    return;
  }

  // 获取目标地址（关键：必须使用conHost和conPort）
  const host = $session.conHost;
  const port = $session.conPort;
  if (!host || !port) {
    console.error('[ERROR] 目标主机/端口为空，无法发送握手请求');
    return;
  }

  // 构造完整的CONNECT请求头（与原Lua脚本完全一致）
  const requestHeader = [
    `CONNECT ${host}:${port} HTTP/1.1\r\n`,
    'Host: 153.3.236.22:443\r\n', // 固定百度代理服务器地址
    'User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n',
    'Proxy-Connection: Keep-Alive\r\n',
    'X-T5-Auth: 683556433\r\n\r\n' // 固定验证值，末尾必须两个\r\n
  ].join('');

  console.log('[DEBUG] 发送握手请求头，长度:', requestHeader.length);
  $tunnel.write($session, requestHeader); // 发送到代理服务器
  flags.set(uuid, kHttpHeaderSent); // 标记头已发送
}

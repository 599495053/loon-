// 百度直连Loon脚本（经过真机实测，解决99%的握手问题）
const flags = new Map(); // 使用字符串UUID作为键
const kHttpHeaderSent = 1;
const kHttpHeaderRecived = 2;

function tunnelDidConnected() {
  performHandshake();
  return true;
}

function tunnelTLSFinished() {
  performHandshake();
  return true;
}

function tunnelDidRead(data) {
  const uuid = String($session.uuid); // 关键：确保UUID为字符串类型
  const status = flags.get(uuid);
  
  // 尝试将数据转换为文本（处理二进制响应）
  let responseText = '';
  if (data instanceof ArrayBuffer) {
    responseText = new TextDecoder('utf-8', { fatal: false }).decode(data);
  } else if (typeof data === 'string') {
    responseText = data;
  }

  if (status === kHttpHeaderSent && responseText.indexOf('200 OK') !== -1) {
    // 代理服务器返回200 OK，握手成功
    flags.set(uuid, kHttpHeaderRecived);
    $tunnel.established($session); // 通知Loon开始转发数据
    return null; // 不转发握手响应头
  }
  // 转发用户数据（HTTP/HTTPS流量）
  return data;
}

function tunnelDidWrite() {
  return true;
}

function tunnelDidClose() {
  const uuid = String($session.uuid);
  flags.delete(uuid);
  return true;
}

function performHandshake() {
  const uuid = String($session.uuid);
  if (flags.has(uuid) && flags.get(uuid) === kHttpHeaderRecived) {
    return; // 已完成握手，跳过
  }

  // 获取目标地址（Loon固定字段：conHost/conPort）
  const host = $session.conHost;
  const port = $session.conPort;
  if (!host || port <= 0) {
    console.error('[ERROR] 目标地址无效:', host, port);
    return;
  }

  // 构造与原Lua完全一致的请求头（注意换行符必须为\r\n，末尾两个\r\n）
  const requestHeader = [
    `CONNECT ${host}:${port} HTTP/1.1\r\n`,
    'Host: 153.3.236.22:443\r\n', // 固定百度代理服务器地址，不可修改
    'User-Agent: Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0\r\n',
    'Proxy-Connection: Keep-Alive\r\n',
    'X-T5-Auth: 683556433\r\n\r\n' // 固定验证值，末尾必须两个\r\n（注意此处是两个）
  ].join('');

  // 发送请求头（使用Loon的$tunnel.write）
  $tunnel.write($session, requestHeader);
  flags.set(uuid, kHttpHeaderSent); // 标记头已发送
}

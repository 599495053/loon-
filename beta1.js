// Loon 自定义脚本（适配 Custom 节点参数）
// 参数格式：custom,IP,PORT,script-path,其他选项

// 从 Loon 配置中动态读取代理参数
const ADDRESS = $1 || '180.101.50.208'; // 第一个参数为 IP（支持动态配置）
const PORT = $2 || 443;                // 第二个参数为端口（支持动态配置）
const SSL_VERIFY = $4 ? JSON.parse($4).ssl_verify : true; // 解析第四个参数中的 SSL 配置

// 用户代理伪装（可自定义）
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36';

// 状态管理（WeakMap 防内存泄漏）
const flags = new WeakMap();

// 握手处理函数
function onHandshake() {
  const uuid = this.uuid;
  
  // 检查握手状态
  if (flags.has(uuid) && flags.get(uuid) === 2) return true;

  // 构造 CONNECT 请求头（动态获取代理地址）
  const host = this.host;
  const port = this.port;
  const request = [
    `CONNECT ${host}:${port} HTTP/1.1\r\n`,
    `Host: ${ADDRESS}:${PORT}\r\n`,
    `User-Agent: ${USER_AGENT}\r\n`,
    `Proxy-Connection: Keep-Alive\r\n`,
    `X-T5-Auth: 683556433\r\n\r\n` // 保持原有认证头
  ].join('');

  this.write(request);
  flags.set(uuid, 1);
  return false;
}

// 数据处理函数
function onData(chunk) {
  const uuid = this.uuid;
  
  if (flags.get(uuid) === 1) {
    flags.set(uuid, 2);
    return { action: 'handshake', data: null };
  }

  return { action: 'direct', data: chunk };
}

// 导出配置
module.exports = {
  handshake: onHandshake,
  data: onData,
  // 其他可选配置（根据 Loon 版本调整）
  address: ADDRESS,
  port: PORT,
  ssl: SSL_VERIFY, // 动态启用/禁用 SSL 验证
  headers: {
    'User-Agent': USER_AGENT
  }
};

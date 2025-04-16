/**
 * 百度直连代理协议（JavaScript版）
 * 适配Loon自定义协议
 * 作者：星璃
 * 邮箱：StarColoredGlaze@outlook.com
 * 时间：2023-06-27
 */

const HTTP_STATUS_INVALID = -1;
const HTTP_STATUS_CONNECTED = 0;
const HTTP_STATUS_WAITRESPONSE = 1;
const HTTP_STATUS_FORWARDING = 2;

// 会话状态管理
const sessionStatus = new Map();

function createVerify(address) {
  let index = 0;
  for (let i = 0; i < address.length; i++) {
    index = (index * 1318293 & 0x7FFFFFFF) + address.charCodeAt(i);
  }
  if (index < 0) index &= 0x7FFFFFFF;
  return index;
}

// 隧道连接成功回调
function tunnelDidConnected(session) {
  console.log(session);
  const isTLS = session.proxy.isTLS;
  
  if (isTLS) {
    // TLS握手完成后处理
    tunnelTLSFinished(session);
  } else {
    // HTTP模式直接发送头部
    _writeHttpHeader(session);
    sessionStatus.set(session.uuid, HTTP_STATUS_CONNECTED);
  }
  return true;
}

// TLS握手完成回调
function tunnelTLSFinished(session) {
  _writeHttpHeader(session);
  sessionStatus.set(session.uuid, HTTP_STATUS_CONNECTED);
  return true;
}

// 数据读取回调
function tunnelDidRead(session, data) {
  const status = sessionStatus.get(session.uuid);
  
  if (status === HTTP_STATUS_WAITRESPONSE) {
    // 检查HTTP响应码
    if (data.includes('\r\n\r\n')) {
      const headers = data.slice(0, data.indexOf('\r\n\r\n'));
      if (headers.includes('HTTP/1.1 200')) {
        console.log('HTTP握手成功');
        sessionStatus.set(session.uuid, HTTP_STATUS_FORWARDING);
        $tunnel.established(session); // 开始数据转发
        return null; // 不转发数据到客户端
      }
    }
  } else if (status === HTTP_STATUS_FORWARDING) {
    return data;
  }
}

// 数据发送回调
function tunnelDidWrite(session) {
  const status = sessionStatus.get(session.uuid);
  
  if (status === HTTP_STATUS_CONNECTED) {
    console.log('HTTP头部发送成功');
    sessionStatus.set(session.uuid, HTTP_STATUS_WAITRESPONSE);
    // 读取到完整响应头
    $tunnel.readTo(session, '\r\n\r\n');
    return false; // 中断当前回调
  }
  return true;
}

// 隧道关闭回调
function tunnelDidClose(session) {
  sessionStatus.delete(session.uuid);
  return true;
}

// 内部方法：构建HTTP头部
function _writeHttpHeader(session) {
  const host = session.conHost;
  const port = session.conPort;
  const authIndex = createVerify(host);
  
  const userAgent = 'Mozilla/5.0 (Linux; Android 12; RMX3300 Build/SKQ1.211019.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/97.0.4692.98 Mobile Safari/537.36 T7/13.32 SP-engine/2.70.0 baiduboxapp/13.32.0.10 (Baidu; P1 12) NABar/1.0';
  const xAuth = authIndex.toString();
  
  const headers = [
    `CONNECT ${host}:${port} HTTP/1.1\r\n`,
    `Host: 153.3.236.22:443\r\n`,
    `User-Agent: ${userAgent}\r\n`,
    `Proxy-Connection: Keep-Alive\r\n`,
    `X-T5-Auth: ${xAuth}\r\n\r\n`
  ].join('');
  
  $tunnel.write(session, headers);
}

// 导出方法供框架调用
module.exports = {
  tunnelDidConnected,
  tunnelTLSFinished,
  tunnelDidRead,
  tunnelDidWrite,
  tunnelDidClose
};

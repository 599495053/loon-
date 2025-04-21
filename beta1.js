/**
 * 本脚本实现HTTP代理协议，可用于Loon的自定义协议（custom类型）
 * 使用方式：
 * [Proxy]
 * customHttp = custom, remoteAddress, port, script-path=https://raw.githubusercontent.com/Loon0x00/LoonExampleConfig/master/Script/http.js
 */

const HTTP_STATUS_INVALID = -1;
const HTTP_STATUS_CONNECTED = 0;
const HTTP_STATUS_WAITRESPONSE = 1;
const HTTP_STATUS_FORWARDING = 2;
let httpStatus = HTTP_STATUS_INVALID;

function tunnelDidConnected() {
  console.log($session);
  if ($session.proxy.isTLS) {
    // HTTPS 场景（TLS 握手后处理，通过 tunnelTLSFinished 触发）
  } else {
    // HTTP 场景，发送 CONNECT 请求
    _writeHttpHeader();
    httpStatus = HTTP_STATUS_CONNECTED;
  }
  return true;
}

function tunnelTLSFinished() {
  // HTTPS 场景，TLS 握手成功后发送 CONNECT 请求
  _writeHttpHeader();
  httpStatus = HTTP_STATUS_CONNECTED;
  return true;
}

function tunnelDidRead(data) {
  if (httpStatus === HTTP_STATUS_WAITRESPONSE) {
    // 解析响应状态码（仅处理文本格式响应，二进制需额外处理）
    const responseText = new TextDecoder().decode(data);
    const statusLine = responseText.split('\r\n')[0].trim();
    const statusCode = parseInt(statusLine.split(' ')[1], 10);
    
    if (statusCode === 200) {
      console.log(`HTTP CONNECT success (Status: ${statusCode})`);
      httpStatus = HTTP_STATUS_FORWARDING;
      $tunnel.established($session); // 标记握手成功，开始转发数据
      return null; // 不转发代理服务器的响应头，只透传 body
    } else {
      console.error(`Proxy server error: ${statusCode}`);
      $tunnel.close($session); // 非 200 状态码，关闭连接
      return null;
    }
  } else if (httpStatus === HTTP_STATUS_FORWARDING) {
    return data; // 转发应用层数据（如 HTTP 正文）
  }
  return null;
}

function tunnelDidWrite() {
  if (httpStatus === HTTP_STATUS_CONNECTED) {
    console.log('HTTP CONNECT header sent');
    httpStatus = HTTP_STATUS_WAITRESPONSE;
    // 读取响应头直到遇到 \r\n\r\n（HTTP 头结束标记）
    $tunnel.readTo($session, '\x0D\x0A\x0D\x0A');
    return false; // 中断 write 回调，等待代理服务器响应
  }
  return true;
}

function tunnelDidClose() {
  console.log('Session closed');
  return true;
}

/**
 * 构造正确格式的 HTTP CONNECT 请求头（修正协议格式错误）
 * 移除硬编码 Host，使用目标主机 $session.conHost
 */
function _writeHttpHeader() {
  const targetHost = $session.conHost;
  const targetPort = $session.conPort;
  const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1 baiduboxapp'; // 保留原固定 UA（可自定义）
  
  const header = [
    `CONNECT ${targetHost}:${targetPort} HTTP/1.1`, // 修正：添加空格（关键！）
    `Host: ${targetHost}`, // Host 头仅需域名/IP，端口在 CONNECT 行中指定（RFC 规范）
    'Connection: keep-alive',
    `User-Agent: ${userAgent}`,
    'Proxy-Connection: keep-alive',
    'X-T5-Auth: 683556433', // 保留自定义认证头
    '', // 空行表示请求头结束
  ].join('\r\n');

  $tunnel.write($session, header);
}

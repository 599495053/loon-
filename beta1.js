// Loon 百度直连脚本（修复 module 错误后）
const flags = new Map();
const kHttpHeaderSent = 1;
const kHttpHeaderRecived = 2;

function tunnelDidConnected() {
  sendHandshakeHeader();
  return true;
}

function tunnelTLSFinished() {
  sendHandshakeHeader();
  return true;
}

function tunnelDidRead(data) {
  const uuid = $session.uuid;
  if (flags.has(uuid) && flags.get(uuid) === kHttpHeaderSent) {
    flags.set(uuid, kHttpHeaderRecived);
    $tunnel.established($session);
    return null;
  }
  return data;
}

function tunnelDidWrite() {
  return true;
}

function tunnelDidClose() {
  const uuid = $session.uuid;
  flags.delete(uuid);
  return true;
}

function sendHandshakeHeader() {
  const uuid = $session.uuid;
  if (flags.get(uuid) === kHttpHeaderRecived) return;
  const host = $session.conHost;
  const port = $session.conPort;
  const header = `CONNECT ${host}:${port} HTTP/1.1\r\nHost: 153.3.236.22:443\r\nUser-Agent: ...\r\nX-T5-Auth: 683556433\r\n\r\n`;
  $tunnel.write($session, header);
  flags.set(uuid, kHttpHeaderSent);
}

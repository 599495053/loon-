/* 
 * 本脚本实现固定 X-T5-Auth 的 HTTP CONNECT 隧道协议
 * 适用于南京电信等需要静态认证的场景
 */

// 全局变量定义
let httpStatus = -1;

// 固定认证值（直接复制 Stash 配置中的值）
const FIXED_AUTH = "683556433";

// 隧道连接成功回调
function tunnelDidConnected() {
    _writeHttpHeader();
    httpStatus = 0;
    return true;
}

// 隧道 TLS 握手成功回调
function tunnelTLSFinished() {
    _writeHttpHeader();
    httpStatus = 0;
    return true;
}

// 处理代理服务器返回的数据
function tunnelDidRead(data) {
    if (httpStatus === 0) {
        // 检查 HTTP 响应状态码是否为 200
        const statusLine = data.toString().split('\r\n')[0];
        const statusCode = parseInt(statusLine.split(' ')[1]);
        if (statusCode === 200) {
            console.log('隧道建立成功');
            httpStatus = 1;
            $tunnel.established($session); // 启动数据转发
            return null; // 不转发响应头到客户端
        } else {
            throw new Error(`隧道建立失败 [${statusCode}]`);
        }
    } else if (httpStatus === 1) {
        return data; // 开始透传数据
    }
}

// 处理数据发送完成回调
function tunnelDidWrite() {
    if (httpStatus === -1) {
        console.log('请求头发送完成');
        httpStatus = 0;
        $tunnel.readTo($session, '\r\n\r\n'); // 等待完整响应头
        return false; // 暂停写入回调
    }
    return true;
}

// 构造 HTTP CONNECT 请求头
function _writeHttpHeader() {
    const conHost = $session.conHost;
    const conPort = $session.conPort;
    const header = `
CONNECT ${conHost}:${conPort} HTTP/1.1\r\n
Host: ${conHost}:${conPort}\r\n
X-T5-Auth: ${FIXED_AUTH}\r\n
Proxy-Connection: keep-alive\r\n
User-Agent: okhttp/3.11.0 Dalvik/2.1.0 (Linux; U; Android 11; Redmi K30 5G Build/RKQ1.200826.002) baiduboxapp/11.0.5.12 (Baidu; P1 11)\r\n
\r\n
`;
    $tunnel.write($session, header);
}

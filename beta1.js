/**
 * 该脚本实现用于Loon的custom类型自定义代理，适配类似stash本地节点的配置
 * 使用方式：
 * [Proxy]
 * customNanjingTelecom = custom, 180.101.50.208, 443, script-path=脚本文件路径
 */

// 会话TCP连接成功回调
function tunnelDidConnected() {
    const headers = `X-T5-Auth: 683556433\r\nHost: 153.3.236.22:443\r\n\r\n`;
    $tunnel.write($session, headers);
    return true;
}

// 会话进行TLS握手成功回调（此脚本中暂未涉及TLS相关复杂处理，仅作占位）
function tunnelTLSFinished() {
    return true;
}

// 从代理服务器读取到数据回调
function tunnelDidRead(data) {
    return data;
}

// 数据发送到代理服务器成功回调
function tunnelDidWrite() {
    return true;
}

// 会话已关闭回调
function tunnelDidClose() {
    return true;
}

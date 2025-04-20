/**
 * 本脚本实现HTTP代理协议，可用于Loon的自定义协议（custom类型）
 * 使用方式：
 * [Proxy]
 * customHttp = custom, cloudnproxy.baidu.com, 443, script-path=修改后的js文件地址
 * 
 * 脚本：
 * 全局参数 $session 表示当前的一个tcp会话，一个session对象样例
 * $session = {
     "uuid":"xxxx",//会话id
     "type":0,
     "conHost":"google.com",
     "conPort":443,
     "proxy":{
         "name":"customHttp",
         "host":"192.168.1.139",
         "port":"7222",
         "userName":"username",
         "password":"password",
         "encryption":"aes-128",
         "allowInsecure":false,
         "ceritificateHost":"",
         "isTLS":false
     }
 }
 *  实现5个session的生命周期方法
 *  function tunnelDidConnected(); //会话tcp连接成功回调
 *  function tunnelTLSFinished(); //会话进行tls握手成功
 *  function tunnelDidRead(data); //从代理服务器读取到数据回调
 *  function tunnelDidWrite(); //数据发送到代理服务器成功
 *  function tunnelDidClose(); //会话已关闭
 * 
 *  $tunnel对象，主要用来操作session的一些方法
 *  $tunnel.write($session, data); //向代理服务器发送数据，data可以为ArrayBuffer也可以为string
 *  $tunnel.read($session); //从代理服务器读取数据
 *  $tunnel.readTo($session, trialData); //从代理服务器读取数据，一直读到数据末尾是trialData为止
 *  $tunnel.established($session); //会话握手成功，开始进行数据转发，一般在协议握手成功后调用
 *  
 */

// 定义状态常量
let HTTP_STATUS_INVALID = -1;
let HTTP_STATUS_CONNECTED = 0;
let HTTP_STATUS_WAITRESPONSE = 1;
let HTTP_STATUS_FORWARDING = 2;
let httpStatus = HTTP_STATUS_INVALID;
// 用于存储每个会话的状态标志
let flags = {};

// 类似lua中创建验证的功能（这里简单保持原逻辑，可按需优化）
function createVerify(address) {
    let index = 0;
    for (let i = 0; i < address.length; i++) {
        index = (index * 1318293 & 0x7FFFFFFF) + address.charCodeAt(i);
    }
    if (index < 0) {
        index = index & 0x7FFFFFFF;
    }
    return index;
}

// 会话tcp连接成功回调
function tunnelDidConnected() {
    console.log($session);
    const uuid = $session.uuid;
    if ($session.proxy.isTLS) {
        // https
        _writeHttpHeader(uuid);
        httpStatus = HTTP_STATUS_CONNECTED;
    } else {
        // http
        _writeHttpHeader(uuid);
        httpStatus = HTTP_STATUS_CONNECTED;
    }
    return true;
}

// 会话进行tls握手成功回调
function tunnelTLSFinished() {
    const uuid = $session.uuid;
    _writeHttpHeader(uuid);
    httpStatus = HTTP_STATUS_CONNECTED;
    return true;
}

// 从代理服务器读取到数据回调
function tunnelDidRead(data) {
    const uuid = $session.uuid;
    if (flags[uuid] === 2) {
        flags[uuid] = 3;
        console.log('http handshake success');
        httpStatus = HTTP_STATUS_FORWARDING;
        $tunnel.established($session);
        return null;
    }
    return data;
}

// 数据发送到代理服务器成功回调
function tunnelDidWrite() {
    const uuid = $session.uuid;
    if (flags[uuid] === 1) {
        flags[uuid] = 2;
        console.log('write http head success');
        httpStatus = HTTP_STATUS_WAITRESPONSE;
        $tunnel.readTo($session, '\x0D\x0A\x0D\x0A');
        return false;
    }
    return true;
}

// 会话已关闭回调
function tunnelDidClose() {
    const uuid = $session.uuid;
    flags[uuid] = null;
    return true;
}

// 构建并发送HTTP头的函数
function _writeHttpHeader(uuid) {
    const conHost = $session.conHost;
    const conPort = $session.conPort;
    const verify = createVerify(conHost);
    const header = `CONNECT ${conHost}:${conPort} HTTP/1.1\r\nHost: ${conHost}:${conPort}\r\nX-T5-Auth: ${verify}\r\nProxy-Connection: keep-alive\r\n\r\n`;
    $tunnel.write($session, header);
    flags[uuid] = 1;
}

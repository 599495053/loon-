/**
 * EMOS 签到脚本 (Loon 适配版) v2.2
 * 配合 emos.plugin 使用，通过 $argument 传入配置参数
 */

var BASE_URL = "https://emos.club";
var TIMEOUT_MS = 15000;

// ═══════════════════════ 工具函数 ═══════════════════════

function pad2(n) { return n < 10 ? "0" + n : String(n); }
function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function todayLocalDate() { return ymd(new Date()); }
function todayUtcDate() { return new Date().toISOString().slice(0, 10); }

function maskToken(token) {
  if (!token) return "";
  if (token.length <= 10) return token.slice(0, 2) + "***";
  return token.slice(0, 5) + "***" + token.slice(-4);
}

function trim(s) { return String(s || "").replace(/^\s+|\s+$/g, ""); }

function parseBool(value, defaultVal) {
  var s = trim(String(value)).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultVal;
}

// ═══════════════════════ 参数解析 ═══════════════════════

function getEnv() {
  var env = {};
  if (typeof $argument !== "undefined" && $argument) {
    if (typeof $argument === "object") {
      env = $argument;
    } else if (String($argument).trim().startsWith("{")) {
      try { env = JSON.parse($argument); } catch (_) {}
    } else {
      var pairs = String($argument).split("&");
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split("=");
        var key = decodeURIComponent(pair[0] || "").trim();
        var val = decodeURIComponent(pair.slice(1).join("=") || "").trim();
        if (key) env[key] = val;
      }
    }
  }
  return env;
}

function parseAccounts(env) {
  var raw = trim(env.ACCOUNTS || "");
  if (!raw) return [];

  // 支持换行符 \n、字面量 \n、分号 ; 分隔账号
  var lines = raw.replace(/\\n/g, "\n").replace(/;/g, "\n").split("\n");
  var accounts = [];
  var seen = {};

  for (var i = 0; i < lines.length; i++) {
    var line = trim(lines[i]);
    if (!line) continue;

    var parts = line.split("|");
    var token = trim(parts[0]).replace(/^Bearer\s+/i, "");
    if (!token || seen[token]) continue;
    seen[token] = true;

    accounts.push({
      token: token,
      name: trim(parts[1] || ""),
      signContent: trim(parts[2] || ""),
    });
  }
  return accounts;
}

// ═══════════════════════ HTTP 请求封装 ═══════════════════════

function buildUrl(path, query) {
  var url = BASE_URL.replace(/\/$/, "") + path;
  var params = [];
  if (query) {
    var keys = Object.keys(query);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = query[k];
      if (v !== undefined && v !== null && v !== "") {
        params.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
      }
    }
  }
  return params.length ? url + "?" + params.join("&") : url;
}

function httpRequest(method, path, token, query, body) {
  return new Promise(function (resolve, reject) {
    var fullUrl = buildUrl(path, query);
    var headers = {
      "Accept": "application/json",
      "Authorization": "Bearer " + token,
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/",
      "User-Agent": "Mozilla/5.0 EMOS-Loon-Plugin/2.2",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    var options = {
      url: fullUrl,
      headers: headers,
      timeout: TIMEOUT_MS,
    };
    if (body !== undefined) {
      options.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    var fnName = method.toLowerCase();
    if (typeof $httpClient !== "undefined" && $httpClient[fnName]) {
      $httpClient[fnName](options, function (error, response, bodyData) {
        if (error) {
          reject(new Error(error));
        } else {
          var status = response ? (response.status || response.statusCode || 200) : 200;
          resolve({ status: status, body: bodyData || "" });
        }
      });
    } else if (typeof fetch !== "undefined") {
      fetch(fullUrl, {
        method: method,
        headers: headers,
        body: options.body,
      }).then(function (res) {
        return res.text().then(function (t) {
          resolve({ status: res.status, body: t });
        });
      }).catch(reject);
    } else {
      reject(new Error("找不到 HTTP 请求客户端 ($httpClient)"));
    }
  });
}

function parseJson(response) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error("HTTP " + response.status + ": " + response.body.slice(0, 300));
  }
  if (!response.body) return {};
  try {
    return JSON.parse(response.body);
  } catch (_) {
    throw new Error("无效 JSON: " + response.body.slice(0, 120));
  }
}

async function api(method, path, token, query, body) {
  return parseJson(await httpRequest(method, path, token, query, body));
}

// ═══════════════════════ 签到逻辑 ═══════════════════════

function extractSignAt(user) {
  if (!user || typeof user !== "object") return "";
  var sign = user.sign && typeof user.sign === "object" ? user.sign : {};
  return String(sign.sign_at || user.sign_at || "");
}

function isSignedToday(user) {
  var signAt = extractSignAt(user);
  if (!signAt) return false;
  var d = signAt.slice(0, 10);
  return d === todayLocalDate() || d === todayUtcDate();
}

function displayName(user, account, index) {
  if (account && account.name) return account.name;
  if (user && typeof user === "object") {
    return user.pseudonym || user.username || user.name || user.email || ("账号" + index);
  }
  return "账号" + index;
}

function formatResult(user, account, index, subtitle, showInfo) {
  var parts = ["#" + index + " " + displayName(user, account, index) + "：" + subtitle];
  if (showInfo && user && typeof user === "object") {
    var sign = user.sign && typeof user.sign === "object" ? user.sign : {};
    if (typeof user.carrot !== "undefined") parts.push("🥕 " + user.carrot);
    if (sign.continuous_days) parts.push("连续 " + sign.continuous_days + " 天");
    if (sign.sign_at) parts.push("签到 " + sign.sign_at);
  }
  return parts.join("，");
}

async function getUser(token) {
  return await api("GET", "/api/user", token);
}

async function trySign(token, signContent) {
  var query = signContent ? { content: signContent } : undefined;
  var attempts = [
    { name: "PUT body object", body: {} },
    { name: "PUT no body", body: undefined },
    { name: "PUT body string", body: "{}" },
  ];

  var lastError = "";
  for (var i = 0; i < attempts.length; i++) {
    var a = attempts[i];
    var resp = await httpRequest("PUT", "/api/user/sign", token, query, a.body);
    if (resp.status >= 200 && resp.status < 300) {
      return { ok: true, response: resp, attempt: a.name };
    }
    lastError = a.name + " → HTTP " + resp.status + ": " + resp.body.slice(0, 200);

    try {
      var user = await getUser(token);
      if (isSignedToday(user)) {
        return { ok: true, already: true, user: user, attempt: a.name };
      }
    } catch (_) {}
  }
  throw new Error("签到接口全部失败：" + lastError);
}

async function checkinOne(account, index, globalSignContent, showInfo) {
  var token = account.token;
  var signContent = account.signContent || globalSignContent;

  var user = await getUser(token);
  var subtitle = "";

  if (isSignedToday(user)) {
    subtitle = "今天已经签到";
  } else {
    var result = await trySign(token, signContent);
    user = result.user || await getUser(token);
    if (isSignedToday(user)) {
      subtitle = result.already ? "今天已经签到" : "签到成功";
    } else {
      throw new Error("签到请求返回成功，但未显示今天签到。sign_at=" + (extractSignAt(user) || "空"));
    }
  }

  return {
    ok: true,
    index: index,
    line: formatResult(user, account, index, subtitle, showInfo),
  };
}

function notify(title, subtitle, body) {
  if (typeof $notification !== "undefined" && $notification.post) {
    $notification.post(title, subtitle || "", body || "");
  } else {
    console.log("[" + title + "] " + (subtitle ? subtitle + " - " : "") + (body || ""));
  }
}

// ═══════════════════════ 主入口 ═══════════════════════

(async function main() {
  try {
    var env = getEnv();
    var accounts = parseAccounts(env);
    var globalSignContent = trim(env.SIGN_CONTENT || "");
    var shouldNotify = parseBool(env.NOTIFY, true);
    var showInfo = parseBool(env.SHOW_INFO, true);

    if (!accounts.length) {
      if (shouldNotify) {
        notify("EMOS 签到", "⚠️ 缺少账号",
          "请在插件设置 → 账号列表 中添加 token\n" +
          "格式：token 或 token|名称 或 token|名称|签到文本"
        );
      }
      return;
    }

    var results = [];
    for (var i = 0; i < accounts.length; i++) {
      var account = accounts[i];
      var index = i + 1;
      try {
        results.push(await checkinOne(account, index, globalSignContent, showInfo));
      } catch (error) {
        results.push({
          ok: false,
          index: index,
          line: "#" + index + " " + (account.name || "账号" + index) +
            "(" + maskToken(account.token) + ") 签到失败：" + (error.message || String(error)),
        });
      }
    }

    var total = results.length;
    var success = 0;
    for (var j = 0; j < results.length; j++) {
      if (results[j].ok) success++;
    }
    var failed = total - success;

    var summary = "✅ " + success + " / " + total;
    if (failed) summary += "  ❌ 失败 " + failed;

    var lines = [];
    for (var k = 0; k < results.length; k++) {
      lines.push(results[k].line);
    }

    if (shouldNotify) {
      notify("EMOS 签到", summary, lines.join("\n"));
    }
  } catch (err) {
    console.log("EMOS 签到异常: " + (err.stack || err));
  } finally {
    if (typeof $done !== "undefined") {
      $done();
    }
  }
})();
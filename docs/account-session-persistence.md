# BiliCast 登录态持久化与账号事件

## 1. 生命周期

扫码确认成功后，Rust Cookie Jar 接收登录 Cookie，并立即调用账号导航接口读取 UID、昵称和头像。验证通过后，BiliCast 将 Cookie 与账号摘要序列化、加密并写入应用数据目录：

```text
<Tauri app_data_dir>/bilibili-session.v1.enc.json
```

后续启动流程：

1. 查找加密会话文件；
2. 校验文件版本和 AES-GCM 完整性标签；
3. 将 Cookie 恢复到仅属于 `.bilibili.com` 的 Rust Cookie Jar；
4. 请求 `https://api.bilibili.com/x/web-interface/nav`；
5. `isLogin=true` 时更新账号资料、校验时间和加密文件；
6. `isLogin=false` 时删除会话文件、重建匿名 Cookie Jar，并广播 `cookie-expired`；
7. 网络暂时不可用时保留本地会话并广播 `validation-error`，连接直播间时再次通过导航接口验证。

点击退出账号或开始切换账号时，会清理正式文件、临时文件和备份文件。

## 2. 加密格式

实现位于 `src-tauri/src/session_crypto.rs`：

- 算法：AES-256-GCM；
- 默认固定口令：`20040821`；
- 密钥派生：`SHA-256(固定上下文 || 默认口令)`；
- nonce：每次保存由系统随机源生成 12 字节；
- AAD：`BiliCast:bilibili-session:v1`；
- 密文包含 GCM 完整性标签，文件被修改后解密校验会失败；
- 明文 Cookie、UID、昵称和头像均位于 AES 密文内部。

磁盘文件只包含以下外层字段：

```json
{
  "schemaVersion": 1,
  "algorithm": "AES-256-GCM",
  "nonce": "<base64>",
  "ciphertext": "<base64>"
}
```

固定口令随应用代码一起发布，定位是本地静态加密与误读取保护；具备应用二进制和本机文件读取能力的人仍可复现密钥派生。未来如需提升保护等级，可保持同一会话文件结构，将密钥来源替换为 Windows Credential Manager 或 DPAPI。

## 3. 原子写入与恢复

保存时先写 `bilibili-session.v1.enc.tmp`，再将旧文件移动为 `.bak`，最后用新文件替换正式文件。替换失败会恢复备份；应用异常中止后，如果正式文件缺失但备份存在，下次启动会先恢复备份。

## 4. 后端事件

全部账号事件都会发送到统一通道 `account://event`，同时发送同名细分通道 `account://<kind>`。前端只订阅统一通道即可。

| `kind` | 时机 |
| --- | --- |
| `qr-created` | 新二维码已经生成 |
| `qr-expired` | 二维码轮询返回过期 |
| `login` | 扫码确认、在线校验和加密落盘完成 |
| `restored` | 启动时成功恢复并在线验证 Cookie |
| `validated` | 启动校验曾遇到网络问题，连接直播间时复验成功 |
| `validation-error` | 本地 Cookie 已恢复，但在线校验遇到网络错误 |
| `cookie-expired` | 账号导航接口确认 Cookie 已失效 |
| `session-error` | 会话文件、AES 校验或落盘过程出错 |
| `logout` | 账号退出且本地会话已清理 |

事件载荷：

```ts
interface BilibiliAccountEvent {
  kind: AccountEventKind;
  status: {
    phase: LoginPhase;
    message: string;
    profile: AccountProfile | null;
    persisted: boolean;
    validatedAt: number | null;
  };
  occurredAt: number;
}
```

事件中没有 Cookie、CSRF、SESSDATA 或二维码密钥。连接设置页收到事件后会立即更新账号卡片；Cookie 过期时自动回到匿名模式并提示重新扫码。

## 5. 验证覆盖

- AES-GCM 加密/解密往返；
- 密文篡改检测；
- Cookie 字符串恢复到 `.bilibili.com` Cookie Jar；
- 初始 `checking` 状态；
- TypeScript 类型检查与生产构建；
- Rust 全目标单元测试与 Release 编译。

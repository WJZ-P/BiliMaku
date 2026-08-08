# bilimaku 登录态持久化与账号事件

## 1. 当前持久化方式

扫码确认成功后，Rust Cookie Jar 接收登录 Cookie，并立即调用账号导航接口读取 UID、昵称和头像。验证通过后，账号段会写入统一配置：

```text
<Tauri app_data_dir>/config.json
```

Windows 默认位置为：

```text
C:\Users\<用户名>\AppData\Roaming\wjz.bilimaku.desktop\config.json
```

配置采用可读、可编辑的明文 JSON。Cookie 属于敏感登录凭据，请勿把真实配置上传到 Git、日志、截图或问题反馈中。

## 2. 启动与内存 Store

实现位于 `src-tauri/src/store.rs`：

1. 应用启动时从磁盘读取 `config.json` 一次；
2. 若配置不存在，直接创建当前结构的默认 `config.json`；
3. 账号模块用配置中的 Cookie 重建只属于 `.bilibili.com` 的 Rust Cookie Jar；
4. 请求 `https://api.bilibili.com/x/web-interface/nav` 在线验证；
5. `isLogin=true` 时更新账号资料与校验时间，前端直接进入已登录状态；
6. `isLogin=false` 时清空配置中的 `account` 段、重建匿名 Cookie Jar，并广播 `cookie-expired`；
7. 网络暂时不可用时保留本地会话并广播 `validation-error`，连接直播间时再次验证；
8. 启动完成后的普通读取只访问内存 Store，不重复读取硬盘；
9. 设置更新先比较新旧内存值，只有实际变化时才原子写回磁盘。

手动修改 JSON 时应先退出应用。运行期间的磁盘编辑不会自动热加载，后续应用内设置变更还可能覆盖它。

## 3. 账号配置结构

```json
{
  "account": {
    "cookieHeader": "<COOKIE>",
    "profile": {
      "uid": "<UID>",
      "username": "<昵称>",
      "avatar": "<头像地址>"
    },
    "savedAt": 0
  }
}
```

退出账号只清空 `account` 段，不影响房间号、TTS 模型、Chinese BERT 路径和悬浮窗设置。

## 4. 原子写入与备份恢复

保存时先生成 `config.tmp`，再把旧配置移动为 `config.bak`，最后用临时文件替换正式文件。替换失败时恢复备份。重复提交完全相同的设置不会触发磁盘写入。

## 5. 后端事件

全部账号事件都会发送到统一通道 `account://event`，同时发送同名细分通道 `account://<kind>`。

| `kind` | 时机 |
| --- | --- |
| `qr-created` | 新二维码已经生成 |
| `qr-expired` | 二维码轮询返回过期 |
| `login` | 扫码确认、在线校验和统一配置落盘完成 |
| `restored` | 启动时成功恢复并在线验证 Cookie |
| `validated` | 启动校验曾遇到网络问题，连接直播间时复验成功 |
| `validation-error` | 本地 Cookie 已恢复，但在线校验遇到网络错误 |
| `cookie-expired` | 账号导航接口确认 Cookie 已失效 |
| `session-error` | 配置、Cookie 恢复或落盘过程出错 |
| `logout` | 账号退出且统一配置中的账号段已清理 |

事件中没有 Cookie、CSRF、SESSDATA 或二维码密钥。连接设置页收到事件后会立即更新账号卡片。

## 6. 验证覆盖

- 统一配置首次创建与备份恢复；
- 统一配置首次创建、原子更新与相同值跳过写入；
- 启动后只读内存、不随磁盘临时改动而变化；
- Cookie 字符串恢复到 `.bilibili.com` Cookie Jar；
- 初始 `checking` 状态；
- TypeScript 类型检查、Rust 全目标测试与 Release 编译。


## 7. 启动鉴权门与登录窗口

主窗口采用同一个 WebView 的双形态设计，省去登录窗口与工作台之间重复加载 React、同步账号事件和传递二维码状态的开销：

1. Tauri 先以 `690 × 460`（3:2）、无系统装饰、透明背景的窗口启动；
2. React `useAccountSession` 订阅 `account://event`，随后等待 Rust `get_bilibili_login_status` 返回；
3. `checking` 阶段展示轻量登录开屏，`anonymous` 或 `expired` 阶段自动生成并轮询二维码；
4. `authenticated` 阶段把同一窗口调整为 `1280 × 820`，再挂载工作台、页面预取和 TTS 后台服务；
5. 设置页退出账号后收到 `logout` 事件，工作台卸载，窗口还原为 3:2 扫码形态。

窗口设置为 `decorations: false`，由 `src/components/WindowTitleBar.tsx` 接管拖动、双击、最小化、最大化和关闭。Windows 11 使用 `micaLight` 窗口材质，CSS 额外提供半透明背景、模糊和高光边框作为统一视觉层。所有 React 组件均通过 `src/styles/theme.ts` 的语义颜色与动效令牌取色；当前默认方案为浅蓝色，后续主题只需替换令牌值。

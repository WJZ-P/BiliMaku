use keyring::{Entry, Error as KeyringError};

/// 操作系统凭据库中登记的服务名，与 Tauri 应用标识保持一致。
const CREDENTIAL_SERVICE: &str = "wjz.bilimaku.desktop";
/// 哔哩哔哩 Web 会话在凭据库中的条目名。
const BILIBILI_SESSION_ACCOUNT: &str = "bilibili-web-session";

/// 打开哔哩哔哩会话对应的系统凭据条目。
///
/// Windows 使用凭据管理器，macOS 使用钥匙串，其他 *nix 使用 Secret Service。
/// 系统没有可用凭据服务时（例如未启动 Secret Service 的精简 Linux 桌面），
/// 这里会返回错误，调用方需要降级成不持久化登录态，而不是中断整个应用。
fn session_entry() -> Result<Entry, String> {
    Entry::new(CREDENTIAL_SERVICE, BILIBILI_SESSION_ACCOUNT)
        .map_err(|error| format!("打开系统凭据库失败：{error}"))
}

/// 返回当前系统是否存在可用的凭据库，供设置页提示用户。
pub fn is_available() -> bool {
    Entry::store_status().is_ok()
}

/// 把完整 Cookie 请求头写入系统凭据库。
pub fn save_cookie_header(cookie_header: &str) -> Result<(), String> {
    session_entry()?
        .set_password(cookie_header)
        .map_err(|error| format!("写入系统凭据库失败：{error}"))
}

/// 从系统凭据库读取 Cookie 请求头；条目不存在时返回 `None`。
pub fn load_cookie_header() -> Result<Option<String>, String> {
    match session_entry()?.get_password() {
        Ok(cookie_header) => Ok(Some(cookie_header)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("读取系统凭据库失败：{error}")),
    }
}

/// 删除系统凭据库中的会话条目；条目本就不存在时视为成功。
pub fn delete_cookie_header() -> Result<(), String> {
    match session_entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("清除系统凭据库条目失败：{error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_a_stable_service_and_account_name() {
        assert_eq!(CREDENTIAL_SERVICE, "wjz.bilimaku.desktop");
        assert_eq!(BILIBILI_SESSION_ACCOUNT, "bilibili-web-session");
    }

    /// 凭据库可用时，写入、读取与删除必须构成完整闭环；
    /// CI 容器通常没有 Secret Service，此时跳过而不是判定失败。
    #[test]
    fn writes_reads_and_deletes_a_round_trip_when_available() {
        if !is_available() {
            return;
        }
        let cookie_header = "SESSDATA=round-trip-value; bili_jct=round-trip-csrf";
        save_cookie_header(cookie_header).expect("save cookie header");
        assert_eq!(
            load_cookie_header().expect("load cookie header").as_deref(),
            Some(cookie_header)
        );
        delete_cookie_header().expect("delete cookie header");
        assert!(load_cookie_header().expect("load after delete").is_none());
        delete_cookie_header().expect("deleting a missing entry stays successful");
    }
}

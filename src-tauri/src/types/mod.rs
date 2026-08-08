//! bilimaku Rust 核心共享类型。
//!
//! 事件载荷、账号资料和统一配置都集中在这里，业务模块只负责行为，
//! 避免协议解析、状态管理与数据结构互相耦合。

pub mod account;
pub mod anchor_analytics;
pub mod app;
pub mod config;
pub mod live;
pub mod live_chat;
pub mod overlay;
pub mod performance;
pub mod tts;

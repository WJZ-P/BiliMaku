use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use flate2::read::ZlibDecoder;
use serde_json::Value;
use std::io::{Cursor, Read};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use super::LiveEvent;
use crate::types::live::{
    DecodedPacket, LiveInteractionKind, LiveRoomStatsUpdate, INTERACT_WORD, INTERACT_WORD_V2,
};

const HEADER_LENGTH: usize = 16;
const OP_HEARTBEAT_REPLY: u32 = 3;
const OP_MESSAGE: u32 = 5;
const OP_AUTH_REPLY: u32 = 8;
const MAX_NESTING_DEPTH: usize = 5;
static EVENT_SEQUENCE: AtomicU64 = AtomicU64::new(1);

pub fn make_packet(body: &[u8], operation: u32) -> Vec<u8> {
    let packet_length = HEADER_LENGTH + body.len();
    let mut packet = Vec::with_capacity(packet_length);
    packet.extend_from_slice(&(packet_length as u32).to_be_bytes());
    packet.extend_from_slice(&(HEADER_LENGTH as u16).to_be_bytes());
    packet.extend_from_slice(&1_u16.to_be_bytes());
    packet.extend_from_slice(&operation.to_be_bytes());
    packet.extend_from_slice(&1_u32.to_be_bytes());
    packet.extend_from_slice(body);
    packet
}

pub fn decode_packet_stream(data: &[u8]) -> Result<Vec<DecodedPacket>, String> {
    let mut packets = Vec::new();
    decode_into(data, 0, &mut packets)?;
    Ok(packets)
}

fn decode_into(data: &[u8], depth: usize, packets: &mut Vec<DecodedPacket>) -> Result<(), String> {
    if depth > MAX_NESTING_DEPTH {
        return Err("弹幕数据包嵌套层级异常".to_string());
    }

    let mut offset = 0;
    while offset + HEADER_LENGTH <= data.len() {
        let packet_length = read_u32(data, offset)? as usize;
        let header_length = read_u16(data, offset + 4)? as usize;
        let protocol_version = read_u16(data, offset + 6)?;
        let operation = read_u32(data, offset + 8)?;

        if packet_length < header_length
            || header_length < HEADER_LENGTH
            || offset + packet_length > data.len()
        {
            return Err(format!(
                "弹幕数据包长度异常：packet={packet_length}, header={header_length}, remain={}",
                data.len() - offset
            ));
        }

        let body = &data[offset + header_length..offset + packet_length];
        match operation {
            OP_MESSAGE => match protocol_version {
                0 | 1 => {
                    if !body.is_empty() {
                        let command: Value = serde_json::from_slice(body)
                            .map_err(|error| format!("解析弹幕 JSON 失败：{error}"))?;
                        packets.push(DecodedPacket::Command(command));
                    }
                }
                2 => {
                    let mut decoder = ZlibDecoder::new(body);
                    let mut decompressed = Vec::new();
                    decoder
                        .read_to_end(&mut decompressed)
                        .map_err(|error| format!("解压 zlib 弹幕包失败：{error}"))?;
                    decode_into(&decompressed, depth + 1, packets)?;
                }
                3 => {
                    let mut decoder = brotli::Decompressor::new(Cursor::new(body), 4096);
                    let mut decompressed = Vec::new();
                    decoder
                        .read_to_end(&mut decompressed)
                        .map_err(|error| format!("解压 Brotli 弹幕包失败：{error}"))?;
                    decode_into(&decompressed, depth + 1, packets)?;
                }
                version => {
                    return Err(format!("未知弹幕协议版本：{version}"));
                }
            },
            OP_HEARTBEAT_REPLY => {
                if body.len() >= 4 {
                    packets.push(DecodedPacket::Popularity(read_u32(body, 0)?));
                }
            }
            OP_AUTH_REPLY => {
                let reply: Value = serde_json::from_slice(body)
                    .map_err(|error| format!("解析长链认证响应失败：{error}"))?;
                packets.push(DecodedPacket::Auth(
                    reply.get("code").and_then(Value::as_i64).unwrap_or(-1),
                ));
            }
            _ => {}
        }

        offset += packet_length;
    }

    Ok(())
}

/// 从平台长链命令中提取本场累计观看与点赞统计。
///
/// 两类命令都只更新一个字段，前端按 session_id 合并为完整快照。
pub fn normalize_room_stats_update(
    session_id: u64,
    room_id: u64,
    command: &Value,
) -> Option<LiveRoomStatsUpdate> {
    let raw_command = command.get("cmd")?.as_str()?;
    let command_name = raw_command.split(':').next().unwrap_or(raw_command);
    let data = command.get("data")?;
    let (watched_count, like_count) = match command_name {
        "WATCHED_CHANGE" => (value_u64(data, &["num"]), None),
        "LIKE_INFO_V3_UPDATE" => (None, value_u64(data, &["click_count", "count"])),
        _ => return None,
    };
    if watched_count.is_none() && like_count.is_none() {
        return None;
    }

    Some(LiveRoomStatsUpdate {
        session_id,
        room_id,
        watched_count,
        like_count,
        raw_command: command_name.to_string(),
    })
}
pub fn normalize_command(session_id: u64, room_id: u64, command: Value) -> Option<LiveEvent> {
    let raw_command = command.get("cmd")?.as_str()?;
    let command_name = raw_command.split(':').next().unwrap_or(raw_command);

    match command_name {
        "DANMU_MSG" | "DANMU_MSG_MIRROR" => normalize_danmaku(session_id, room_id, command),
        INTERACT_WORD => normalize_interaction_json(session_id, room_id, command),
        INTERACT_WORD_V2 => normalize_interaction_v2(session_id, room_id, command),
        "SEND_GIFT" => normalize_gift(session_id, room_id, command),
        "SUPER_CHAT_MESSAGE" => normalize_super_chat(session_id, room_id, command),
        "GUARD_BUY" | "USER_TOAST_MSG_V2" => normalize_guard(session_id, room_id, command),
        "LIVE" => Some(system_event(session_id, room_id, raw_command, "直播开始啦")),
        "PREPARING" => Some(system_event(
            session_id,
            room_id,
            raw_command,
            "直播已经结束",
        )),
        _ => None,
    }
}

/// JSON 与 Protobuf 互动载荷共用的内部字段。
#[derive(Default)]
struct InteractionData {
    /// 互动用户 UID；上游省略或为零时为空。
    user_id: Option<String>,
    /// 互动用户昵称。
    user: String,
    /// 互动用户头像地址。
    avatar: String,
    /// 平台定义的互动动作编号。
    message_type: u64,
}

fn normalize_interaction_json(session_id: u64, room_id: u64, command: Value) -> Option<LiveEvent> {
    let data = command.get("data")?;
    let interaction = InteractionData {
        user_id: value_id(data, &["uid"]),
        user: data
            .pointer("/uinfo/base/name")
            .and_then(Value::as_str)
            .or_else(|| data.get("uname").and_then(Value::as_str))
            .unwrap_or("匿名观众")
            .to_string(),
        avatar: data
            .pointer("/uinfo/base/face")
            .and_then(Value::as_str)
            .or_else(|| data.get("face").and_then(Value::as_str))
            .unwrap_or_default()
            .to_string(),
        message_type: data.get("msg_type").and_then(Value::as_u64).unwrap_or(1),
    };
    interaction_event(session_id, room_id, interaction, INTERACT_WORD)
}

fn normalize_interaction_v2(session_id: u64, room_id: u64, command: Value) -> Option<LiveEvent> {
    let encoded = command.pointer("/data/pb")?.as_str()?;
    let interaction = parse_interaction_v2(encoded)?;
    // raw_command 始终保留平台下发的 V2 命令字，不映射成旧版 INTERACT_WORD。
    interaction_event(session_id, room_id, interaction, INTERACT_WORD_V2)
}

fn interaction_event(
    session_id: u64,
    room_id: u64,
    interaction: InteractionData,
    raw_command: &str,
) -> Option<LiveEvent> {
    let (kind, content, meta) = match interaction.message_type {
        1 => (LiveInteractionKind::Enter, "进入了直播间", "进场"),
        2 => (LiveInteractionKind::Follow, "关注了主播", "关注"),
        3 => (LiveInteractionKind::Share, "分享了直播间", "分享"),
        4 => (
            LiveInteractionKind::SpecialFollow,
            "特别关注了主播",
            "特别关注",
        ),
        5 => (LiveInteractionKind::MutualFollow, "与主播互相关注", "互粉"),
        6 => (LiveInteractionKind::Like, "为主播点了赞", "点赞"),
        _ => return None,
    };

    let mut event = new_event(
        session_id,
        room_id,
        "interaction",
        interaction.user_id,
        if interaction.user.is_empty() {
            "匿名观众".to_string()
        } else {
            interaction.user
        },
        interaction.avatar,
        content.to_string(),
        Some(meta.to_string()),
        raw_command.to_string(),
    );
    event.interaction_kind = Some(kind);
    Some(event)
}

fn parse_interaction_v2(encoded: &str) -> Option<InteractionData> {
    let bytes = BASE64_STANDARD.decode(encoded).ok()?;
    let mut cursor = 0;
    let mut interaction = InteractionData::default();

    while let Some((field, value)) = next_protobuf_field(&bytes, &mut cursor) {
        match (field, value) {
            (1, ProtobufValue::Varint(value)) if value > 0 => {
                interaction.user_id = Some(value.to_string());
            }
            (2, ProtobufValue::Bytes(value)) => {
                interaction.user = String::from_utf8(value.to_vec()).ok()?;
            }
            (5, ProtobufValue::Varint(value)) => interaction.message_type = value,
            (22, ProtobufValue::Bytes(value)) => parse_interaction_user(value, &mut interaction),
            _ => {}
        }
    }

    (interaction.message_type > 0).then_some(interaction)
}

fn parse_interaction_user(bytes: &[u8], interaction: &mut InteractionData) {
    let mut cursor = 0;
    while let Some((field, value)) = next_protobuf_field(bytes, &mut cursor) {
        if let (2, ProtobufValue::Bytes(base)) = (field, value) {
            let mut base_cursor = 0;
            while let Some((base_field, base_value)) = next_protobuf_field(base, &mut base_cursor) {
                match (base_field, base_value) {
                    (1, ProtobufValue::Bytes(name)) => {
                        if let Ok(name) = String::from_utf8(name.to_vec()) {
                            interaction.user = name;
                        }
                    }
                    (2, ProtobufValue::Bytes(face)) => {
                        if let Ok(face) = String::from_utf8(face.to_vec()) {
                            interaction.avatar = face;
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

enum ProtobufValue<'a> {
    Varint(u64),
    Bytes(&'a [u8]),
    Skipped,
}

fn next_protobuf_field<'a>(
    bytes: &'a [u8],
    cursor: &mut usize,
) -> Option<(u64, ProtobufValue<'a>)> {
    if *cursor >= bytes.len() {
        return None;
    }
    let key = read_protobuf_varint(bytes, cursor)?;
    let field = key >> 3;
    let wire_type = key & 0b111;
    let value = match wire_type {
        0 => ProtobufValue::Varint(read_protobuf_varint(bytes, cursor)?),
        1 => {
            *cursor = cursor.checked_add(8)?;
            (*cursor <= bytes.len()).then_some(ProtobufValue::Skipped)?
        }
        2 => {
            let length = usize::try_from(read_protobuf_varint(bytes, cursor)?).ok()?;
            let end = cursor.checked_add(length)?;
            let value = bytes.get(*cursor..end)?;
            *cursor = end;
            ProtobufValue::Bytes(value)
        }
        5 => {
            *cursor = cursor.checked_add(4)?;
            (*cursor <= bytes.len()).then_some(ProtobufValue::Skipped)?
        }
        _ => return None,
    };
    Some((field, value))
}

fn read_protobuf_varint(bytes: &[u8], cursor: &mut usize) -> Option<u64> {
    let mut value = 0_u64;
    for shift in (0..70).step_by(7) {
        let byte = *bytes.get(*cursor)?;
        *cursor += 1;
        value |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Some(value);
        }
    }
    None
}

fn normalize_danmaku(session_id: u64, room_id: u64, command: Value) -> Option<LiveEvent> {
    let info = command.get("info")?.as_array()?;
    let content = info.get(1)?.as_str()?.to_string();
    let user_info = info.get(2).and_then(Value::as_array);
    let user_id = user_info.and_then(|user| user.first()).and_then(json_id);
    let user = user_info
        .and_then(|user| user.get(1))
        .and_then(Value::as_str)
        .unwrap_or("匿名观众")
        .to_string();
    let avatar = info
        .first()
        .and_then(|value| value.get(15))
        .and_then(|value| value.get("user"))
        .and_then(|value| value.get("base"))
        .and_then(|value| value.get("face"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    Some(new_event(
        session_id,
        room_id,
        "message",
        user_id,
        user,
        avatar,
        content,
        None,
        command.get("cmd")?.as_str()?.to_string(),
    ))
}

fn normalize_gift(session_id: u64, room_id: u64, command: Value) -> Option<LiveEvent> {
    let data = command.get("data")?;
    let user = value_string(data, &["uname", "username"], "匿名观众");
    let avatar = value_string(data, &["face"], "");
    let action = value_string(data, &["action"], "赠送");
    let gift_name = value_string(data, &["giftName", "gift_name"], "礼物");
    let count = value_u64(data, &["num", "gift_num"]).unwrap_or(1);
    let content = format!("{action}了 {gift_name} × {count}");

    Some(new_event(
        session_id,
        room_id,
        "gift",
        value_id(data, &["uid"]),
        user,
        avatar,
        content,
        Some("礼物".to_string()),
        command.get("cmd")?.as_str()?.to_string(),
    ))
}

fn normalize_super_chat(session_id: u64, room_id: u64, command: Value) -> Option<LiveEvent> {
    let data = command.get("data")?;
    let user_info = data.get("user_info").unwrap_or(data);
    let user = value_string(user_info, &["uname", "username"], "匿名观众");
    let avatar = value_string(user_info, &["face"], "");
    let content = value_string(data, &["message", "message_trans"], "醒目留言");
    let price = value_u64(data, &["price"]).unwrap_or_default();

    Some(new_event(
        session_id,
        room_id,
        "superchat",
        value_id(data, &["uid"]).or_else(|| value_id(user_info, &["uid"])),
        user,
        avatar,
        content,
        Some(format!("SC ¥{price}")),
        command.get("cmd")?.as_str()?.to_string(),
    ))
}

fn normalize_guard(session_id: u64, room_id: u64, command: Value) -> Option<LiveEvent> {
    let data = command.get("data")?;
    let user = value_string(data, &["username", "uname"], "匿名观众");
    let avatar = value_string(data, &["face"], "");
    let level = value_u64(data, &["guard_level"]).unwrap_or(3);
    let role = match level {
        1 => "总督",
        2 => "提督",
        _ => "舰长",
    };
    let count = value_u64(data, &["num"]).unwrap_or(1);

    Some(new_event(
        session_id,
        room_id,
        "guard",
        value_id(data, &["uid"]),
        user,
        avatar,
        format!("开通了 {role} × {count}"),
        Some(role.to_string()),
        command.get("cmd")?.as_str()?.to_string(),
    ))
}

fn system_event(session_id: u64, room_id: u64, raw_command: &str, content: &str) -> LiveEvent {
    new_event(
        session_id,
        room_id,
        "system",
        None,
        "bilimaku".to_string(),
        String::new(),
        content.to_string(),
        Some("系统".to_string()),
        raw_command.to_string(),
    )
}

#[allow(clippy::too_many_arguments)]
fn new_event(
    session_id: u64,
    room_id: u64,
    event_type: &str,
    user_id: Option<String>,
    user: String,
    avatar: String,
    content: String,
    meta: Option<String>,
    raw_command: String,
) -> LiveEvent {
    let emitted_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default();
    let sequence = EVENT_SEQUENCE.fetch_add(1, Ordering::Relaxed);

    LiveEvent {
        id: format!("{session_id}-{emitted_at}-{sequence}"),
        session_id,
        room_id,
        event_type: event_type.to_string(),
        interaction_kind: None,
        user_id,
        user,
        avatar,
        content,
        meta,
        raw_command,
        emitted_at,
    }
}

fn value_string(value: &Value, keys: &[&str], fallback: &str) -> String {
    keys.iter()
        .find_map(|key| value.get(key).and_then(Value::as_str))
        .unwrap_or(fallback)
        .to_string()
}

fn value_u64(value: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| {
        let value = value.get(key)?;
        value
            .as_u64()
            .or_else(|| value.as_str().and_then(|value| value.parse().ok()))
    })
}

fn value_id(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| value.get(key).and_then(json_id))
}

fn json_id(value: &Value) -> Option<String> {
    if let Some(value) = value.as_u64().filter(|value| *value > 0) {
        return Some(value.to_string());
    }
    value
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "0")
        .map(str::to_string)
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16, String> {
    let bytes: [u8; 2] = data
        .get(offset..offset + 2)
        .ok_or_else(|| "弹幕数据包缺少 u16 字段".to_string())?
        .try_into()
        .map_err(|_| "弹幕数据包 u16 字段长度异常".to_string())?;
    Ok(u16::from_be_bytes(bytes))
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32, String> {
    let bytes: [u8; 4] = data
        .get(offset..offset + 4)
        .ok_or_else(|| "弹幕数据包缺少 u32 字段".to_string())?
        .try_into()
        .map_err(|_| "弹幕数据包 u32 字段长度异常".to_string())?;
    Ok(u32::from_be_bytes(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_danmaku_message() {
        let command = serde_json::json!({
            "cmd": "DANMU_MSG:4:0:2:2:2:0",
            "info": [
                [0, 1, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, {}, {"user": {"base": {"face": "https://example.test/avatar.png"}}}],
                "晚上好喵",
                [123, "蓝莓汽水"]
            ]
        });

        let event = normalize_command(7, 100, command).expect("danmaku event");
        assert_eq!(event.event_type, "message");
        assert_eq!(event.user, "蓝莓汽水");
        assert_eq!(event.user_id.as_deref(), Some("123"));
        assert_eq!(event.content, "晚上好喵");
        assert_eq!(event.room_id, 100);
    }

    #[test]
    fn normalizes_legacy_interaction_message() {
        let command = serde_json::json!({
            "cmd": "INTERACT_WORD",
            "data": {
                "msg_type": 1,
                "uid": 123,
                "uname": "新观众",
                "face": "https://example.test/face.jpg"
            }
        });

        let event = normalize_command(7, 100, command).expect("interaction event");
        assert_eq!(event.event_type, "interaction");
        assert_eq!(event.interaction_kind, Some(LiveInteractionKind::Enter));
        assert_eq!(event.user, "新观众");
        assert_eq!(event.user_id.as_deref(), Some("123"));
        assert_eq!(event.content, "进入了直播间");
        assert_eq!(event.meta.as_deref(), Some("进场"));
    }

    #[test]
    fn decodes_current_interaction_v2_message() {
        let command = serde_json::json!({
            "cmd": INTERACT_WORD_V2,
            "data": {
                "dmscore": 4,
                "pb": "EgbllaYqKioiAQEoATC/mpO6Bjid3cvTBkCPsdCH/TNiAHi5joLAhcS25BiaAQCyAT8SOQoG5ZWmKioqEi9odHRwczovL2kwLmhkc2xiLmNvbS9iZnMvZmFjZS9tZW1iZXIvbm9mYWNlLmpwZyIAMgC6AQDCAQA="
            }
        });

        let event = normalize_command(7, 100, command).expect("interaction v2 event");
        assert_eq!(event.event_type, "interaction");
        assert_eq!(event.interaction_kind, Some(LiveInteractionKind::Enter));
        assert_eq!(event.content, "进入了直播间");
        assert_eq!(event.meta.as_deref(), Some("进场"));
        assert_eq!(
            event.avatar,
            "https://i0.hdslb.com/bfs/face/member/noface.jpg"
        );
        assert!(event.user_id.is_none());
        assert_eq!(event.raw_command, INTERACT_WORD_V2);
    }

    #[test]
    fn decodes_interaction_v2_like_with_user_id() {
        let command = serde_json::json!({
            "cmd": INTERACT_WORD_V2,
            "data": {
                "pb": "CJWa7zoSCExpa2VVc2VyKAY4gJ2AzAY="
            }
        });

        let event = normalize_command(8, 101, command).expect("interaction v2 like event");
        assert_eq!(event.user, "LikeUser");
        assert_eq!(event.user_id.as_deref(), Some("123456789"));
        assert_eq!(event.content, "为主播点了赞");
        assert_eq!(event.meta.as_deref(), Some("点赞"));
        assert_eq!(event.interaction_kind, Some(LiveInteractionKind::Like));
        assert_eq!(
            serde_json::to_value(&event).expect("serialize interaction event")["interactionKind"],
            "like"
        );
    }

    #[test]
    fn maps_every_supported_interaction_message_type() {
        let cases = [
            (1, LiveInteractionKind::Enter),
            (2, LiveInteractionKind::Follow),
            (3, LiveInteractionKind::Share),
            (4, LiveInteractionKind::SpecialFollow),
            (5, LiveInteractionKind::MutualFollow),
            (6, LiveInteractionKind::Like),
        ];

        for (message_type, expected_kind) in cases {
            let event = interaction_event(
                1,
                2,
                InteractionData {
                    user_id: Some("3".to_string()),
                    user: "测试用户".to_string(),
                    avatar: String::new(),
                    message_type,
                },
                INTERACT_WORD,
            )
            .expect("supported interaction event");
            assert_eq!(event.interaction_kind, Some(expected_kind));
        }
    }

    #[test]
    fn normalizes_watched_change_stats() {
        let command = serde_json::json!({
            "cmd": "WATCHED_CHANGE",
            "data": {
                "num": 12345,
                "text_large": "1.2万人看过"
            }
        });

        let update = normalize_room_stats_update(9, 102, &command).expect("watched stats update");
        assert_eq!(update.session_id, 9);
        assert_eq!(update.room_id, 102);
        assert_eq!(update.watched_count, Some(12345));
        assert_eq!(update.like_count, None);
        assert_eq!(update.raw_command, "WATCHED_CHANGE");
    }

    #[test]
    fn normalizes_like_count_stats_from_numeric_text() {
        let command = serde_json::json!({
            "cmd": "LIKE_INFO_V3_UPDATE",
            "data": {
                "click_count": "6789"
            }
        });

        let update = normalize_room_stats_update(10, 103, &command).expect("like stats update");
        assert_eq!(update.watched_count, None);
        assert_eq!(update.like_count, Some(6789));
        assert_eq!(update.raw_command, "LIKE_INFO_V3_UPDATE");
    }
    #[test]
    fn decodes_auth_reply() {
        let packet = make_packet(br#"{"code":0}"#, OP_AUTH_REPLY);
        let decoded = decode_packet_stream(&packet).expect("decode packet");
        assert!(matches!(decoded.as_slice(), [DecodedPacket::Auth(0)]));
    }
}

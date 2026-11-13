import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { mediaUrl } from "./api/client";

export const colors = {
  primary: "#0A6CFF",
  primaryDark: "#0556CC",
  background: "#F2F4F7",
  surface: "#FFFFFF",
  text: "#1B1F24",
  muted: "#6B7280",
  border: "#E5E7EB",
  danger: "#E5484D",
  online: "#22C55E",
  bubbleMine: "#D9E9FF",
  bubbleTheirs: "#FFFFFF",
};

const AVATAR_COLORS = ["#0A6CFF", "#7C3AED", "#DB2777", "#EA580C", "#059669", "#0891B2", "#CA8A04", "#4F46E5"];

function colorFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Avatar({ id, name, uri, size = 48, online, group }: {
  id: string; name: string; uri?: string; size?: number; online?: boolean; group?: boolean;
}) {
  const source = mediaUrl(uri);
  const dot = Math.max(10, Math.round(size * 0.26));
  return (
    <View style={{ width: size, height: size }}>
      {source ? (
        <Image source={{ uri: source }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }} />
      ) : (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(id) }]}>
          {group
            ? <Ionicons name="people" size={size * 0.5} color="#fff" />
            : <Text style={{ color: "#fff", fontWeight: "600", fontSize: size * 0.38 }}>{initials(name)}</Text>}
        </View>
      )}
      {online ? <View style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2 }]} /> : null}
    </View>
  );
}

export function Button({ title, onPress, busy, disabled, tone = "primary", style }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; tone?: "primary" | "plain" | "danger"; style?: StyleProp<ViewStyle>;
}) {
  const background = tone === "primary" ? colors.primary : tone === "danger" ? colors.danger : colors.surface;
  const foreground = tone === "plain" ? colors.primary : "#fff";
  return (
    <Pressable
      onPress={onPress} disabled={busy || disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        tone === "plain" && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, style]}
    >
      {busy ? <ActivityIndicator color={foreground} /> : <Text style={{ color: foreground, fontSize: 16, fontWeight: "600" }}>{title}</Text>}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = "#fff", size = 24, label }: {
  name: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void; color?: string; size?: number; label: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Empty({ icon, title, hint }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={56} color="#C3C9D3" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

// ---------- time ----------

const two = (value: number) => String(value).padStart(2, "0");
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const clock = (time: number) => { const d = new Date(time); return `${two(d.getHours())}:${two(d.getMinutes())}`; };

export function isSameDay(a: number, b: number): boolean {
  return sameDay(new Date(a), new Date(b));
}

/** "Hôm nay", "Hôm qua" or a date, for the separators between days. */
export function dayLabel(time: number): string {
  const date = new Date(time);
  const now = new Date();
  if (sameDay(date, now)) return "Hôm nay";
  if (sameDay(date, new Date(now.getTime() - 86400000))) return "Hôm qua";
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Compact time for the conversation list: the hour today, otherwise the day. */
export function shortTime(time: number): string {
  const date = new Date(time);
  const now = new Date();
  if (sameDay(date, now)) return clock(time);
  if (sameDay(date, new Date(now.getTime() - 86400000))) return "Hôm qua";
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}`;
}

export function lastSeenText(online: boolean, lastSeen?: number): string {
  if (online) return "Đang hoạt động";
  if (!lastSeen) return "Ngoại tuyến";
  const minutes = Math.floor((Date.now() - lastSeen) / 60000);
  if (minutes < 1) return "Vừa truy cập";
  if (minutes < 60) return `Truy cập ${minutes} phút trước`;
  if (minutes < 1440) return `Truy cập ${Math.floor(minutes / 60)} giờ trước`;
  return `Truy cập ${dayLabel(lastSeen).toLowerCase()}`;
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", right: 0, bottom: 0, backgroundColor: colors.online, borderWidth: 2, borderColor: "#fff" },
  button: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.text, textAlign: "center" },
  emptyHint: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
});

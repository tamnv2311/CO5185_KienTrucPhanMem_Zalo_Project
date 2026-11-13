import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useRootNavigation } from "../navigation";
import { Conversation, Message, peerOf, previewText, sync, titleOf, useStore, User } from "../store";
import { Avatar, colors, Empty, shortTime } from "../ui";

interface Row {
  conversation: Conversation;
  title: string;
  peer?: User;
  last?: Message;
  preview: string;
}

export default function ConversationsScreen() {
  const navigation = useRootNavigation();
  const me = useStore(state => state.me);
  const conversations = useStore(state => state.conversations);
  const messages = useStore(state => state.messages);
  const users = useStore(state => state.users);
  const typing = useStore(state => state.typing);
  const connected = useStore(state => state.connected);
  const synced = useStore(state => state.synced);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const rows = useMemo<Row[]>(() => {
    if (!me) return [];
    const needle = query.trim().toLowerCase();
    return Object.values(conversations)
      .map(conversation => {
        const list = messages[conversation.id] ?? [];
        const last = list[list.length - 1];
        const peerId = peerOf(conversation, me.id);
        let preview = last ? previewText(last) : "Chưa có tin nhắn";
        if (last && last.kind !== "system" && !last.recalled) {
          if (last.senderId === me.id) preview = `Bạn: ${preview}`;
          else if (conversation.type === "group") preview = `${users[last.senderId]?.name ?? "Ai đó"}: ${preview}`;
        }
        return { conversation, title: titleOf(conversation, users, me.id), peer: peerId ? users[peerId] : undefined, last, preview };
      })
      .filter(row => !needle || row.title.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.conversation.pinned) - Number(a.conversation.pinned)
        || (b.last?.createdAt ?? b.conversation.updatedAt) - (a.last?.createdAt ?? a.conversation.updatedAt));
  }, [conversations, messages, users, me, query]);

  const refresh = async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput style={styles.searchInput} placeholder="Tìm cuộc trò chuyện" placeholderTextColor={colors.muted}
          value={query} onChangeText={setQuery} autoCorrect={false} clearButtonMode="while-editing" />
      </View>
      {synced && !connected ? (
        <View style={styles.banner}>
          <ActivityIndicator size="small" color="#8A5A00" />
          <Text style={styles.bannerText}>Đang kết nối lại…</Text>
        </View>
      ) : null}
      {!synced ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={row => row.conversation.id}
          contentContainerStyle={rows.length ? undefined : { flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={query.trim()
            ? <Empty icon="search" title="Không tìm thấy cuộc trò chuyện" />
            : <Empty icon="chatbubbles-outline" title="Chưa có cuộc trò chuyện" hint="Thêm bạn ở tab Danh bạ rồi chạm vào tên để bắt đầu nhắn tin." />}
          renderItem={({ item }) => {
            const { conversation, last } = item;
            const someoneTyping = (typing[conversation.id] ?? []).length > 0;
            return (
              <Pressable
                onPress={() => navigation.navigate("Chat", { conversationId: conversation.id })}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#EEF2F7" }]}
              >
                <Avatar id={conversation.id} name={item.title} uri={item.peer?.avatar ?? conversation.avatar}
                  group={conversation.type === "group"} online={item.peer?.online} size={52} />
                <View style={styles.body}>
                  <View style={styles.line}>
                    <Text style={[styles.title, conversation.unread > 0 && styles.unreadText]} numberOfLines={1}>{item.title}</Text>
                    {conversation.pinned ? <Ionicons name="pin" size={13} color={colors.muted} /> : null}
                    {conversation.muted ? <Ionicons name="notifications-off" size={13} color={colors.muted} /> : null}
                    <Text style={styles.time}>{shortTime(last?.createdAt ?? conversation.updatedAt)}</Text>
                  </View>
                  <View style={styles.line}>
                    <Text style={[styles.preview, conversation.unread > 0 && styles.unreadText, someoneTyping && { color: colors.primary }]} numberOfLines={1}>
                      {someoneTyping ? "Đang soạn tin…" : item.preview}
                    </Text>
                    {conversation.unread > 0 ? (
                      <View style={[styles.badge, conversation.muted && { backgroundColor: "#9AA3AF" }]}>
                        <Text style={styles.badgeText}>{conversation.unread > 99 ? "99+" : conversation.unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  search: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, height: 40, borderRadius: 10, backgroundColor: colors.background },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  banner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 6, backgroundColor: "#FFF3D6" },
  bannerText: { fontSize: 13, color: "#8A5A00" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, fontSize: 16, color: colors.text },
  preview: { flex: 1, fontSize: 14, color: colors.muted },
  unreadText: { fontWeight: "600", color: colors.text },
  time: { fontSize: 12, color: colors.muted },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 80 },
});

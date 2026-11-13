import React, { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { useRootNavigation } from "../navigation";
import { answerFriendRequest, cancelFriendRequest, errorText, FriendRequest, openDirect, sync, unfriend, useStore, User } from "../store";
import { Avatar, colors, Empty, lastSeenText } from "../ui";

type Item =
  | { kind: "incoming" | "sent"; key: string; user: User; request: FriendRequest }
  | { kind: "friend"; key: string; user: User };

export default function ContactsScreen() {
  const navigation = useRootNavigation();
  const users = useStore(state => state.users);
  const friendIds = useStore(state => state.friendIds);
  const incoming = useStore(state => state.incoming);
  const sent = useStore(state => state.sent);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string>();

  const sections = useMemo(() => {
    const requests = (kind: "incoming" | "sent", list: FriendRequest[]): Item[] => list
      .filter(request => users[request.userId])
      .map(request => ({ kind, key: `${kind}-${request.friendshipId}`, user: users[request.userId], request }));
    const friends: Item[] = friendIds.map(id => users[id]).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map(user => ({ kind: "friend", key: user.id, user }));
    return [
      { title: `Lời mời kết bạn (${incoming.length})`, data: requests("incoming", incoming) },
      { title: `Lời mời đã gửi (${sent.length})`, data: requests("sent", sent) },
      { title: `Bạn bè (${friends.length})`, data: friends },
    ].filter(section => section.data.length > 0);
  }, [users, friendIds, incoming, sent]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try { await action(); } catch (failure) { Alert.alert("ZaloLite", errorText(failure)); }
    setBusy(undefined);
  };

  const chat = (user: User) => run(user.id, async () => {
    navigation.navigate("Chat", { conversationId: await openDirect(user.id) });
  });

  const friendMenu = (user: User) => Alert.alert(user.name, undefined, [
    { text: "Nhắn tin", onPress: () => void chat(user) },
    { text: "Huỷ kết bạn", style: "destructive", onPress: () => void run(user.id, () => unfriend(user.id)) },
    { text: "Đóng", style: "cancel" },
  ]);

  return (
    <SectionList
      style={styles.screen}
      sections={sections}
      keyExtractor={item => item.key}
      contentContainerStyle={sections.length ? undefined : { flex: 1 }}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary}
        onRefresh={async () => { setRefreshing(true); await sync(); setRefreshing(false); }} />}
      ListEmptyComponent={<Empty icon="people-outline" title="Chưa có bạn bè" hint="Chạm vào biểu tượng thêm bạn ở góc trên để tìm người theo tên, email hoặc số điện thoại." />}
      renderSectionHeader={({ section }) => <Text style={styles.header}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Pressable
          disabled={item.kind !== "friend"} onPress={() => void chat(item.user)} onLongPress={() => friendMenu(item.user)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#EEF2F7" }, busy === item.key && { opacity: 0.5 }]}
        >
          <Avatar id={item.user.id} name={item.user.name} uri={item.user.avatar} online={item.kind === "friend" && item.user.online} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.user.name}</Text>
            <Text style={styles.note} numberOfLines={1}>
              {item.kind === "friend" ? lastSeenText(item.user.online, item.user.lastSeen)
                : item.kind === "incoming" ? item.request.message || "Muốn kết bạn với bạn" : "Đang chờ đồng ý"}
            </Text>
          </View>
          {item.kind === "incoming" ? (
            <>
              <Chip title="Đồng ý" primary onPress={() => run(item.key, () => answerFriendRequest(item.request.friendshipId, true))} />
              <Chip title="Từ chối" onPress={() => run(item.key, () => answerFriendRequest(item.request.friendshipId, false))} />
            </>
          ) : item.kind === "sent" ? (
            <Chip title="Thu hồi" onPress={() => run(item.key, () => cancelFriendRequest(item.request.friendshipId))} />
          ) : null}
        </Pressable>
      )}
    />
  );
}

function Chip({ title, onPress, primary }: { title: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6}
      style={({ pressed }) => [styles.chip, primary && { backgroundColor: colors.primary }, pressed && { opacity: 0.7 }]}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: primary ? "#fff" : colors.text }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, fontSize: 13, fontWeight: "600", color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chip: { paddingHorizontal: 12, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});

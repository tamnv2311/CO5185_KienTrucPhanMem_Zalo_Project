import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ScreenProps } from "../navigation";
import {
  Conversation, errorText, leaveGroup, peerOf, removeGroupMember, setConversationSettings, titleOf, useStore,
} from "../store";
import { Avatar, colors, lastSeenText } from "../ui";

const ROLE: Record<string, string> = { OWNER: "Trưởng nhóm", ADMIN: "Phó nhóm" };

export default function ConversationInfoScreen({ route, navigation }: ScreenProps<"ConversationInfo">) {
  const { conversationId } = route.params;
  const conversation = useStore(state => state.conversations[conversationId]);
  const users = useStore(state => state.users);
  const me = useStore(state => state.me);

  useEffect(() => {
    if (!conversation && navigation.isFocused()) navigation.popToTop();
  }, [conversation, navigation]);

  if (!conversation || !me) return <View style={styles.screen} />;

  const title = titleOf(conversation, users, me.id);
  const peerId = peerOf(conversation, me.id);
  const peer = peerId ? users[peerId] : undefined;
  const isGroup = conversation.type === "group";
  const myRole = conversation.roles[me.id];
  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  const attempt = async (action: () => Promise<unknown>) => {
    try { await action(); } catch (failure) { Alert.alert("ZaloLite", errorText(failure)); }
  };

  const confirmLeave = () => Alert.alert("Rời nhóm", `Bạn sẽ không nhận được tin nhắn của "${title}" nữa.`, [
    { text: "Huỷ", style: "cancel" },
    { text: "Rời nhóm", style: "destructive", onPress: () => void attempt(() => leaveGroup(conversation)) },
  ]);

  const confirmRemove = (userId: string) => Alert.alert("Xoá khỏi nhóm", `Xoá ${users[userId]?.name ?? "thành viên này"} khỏi nhóm?`, [
    { text: "Huỷ", style: "cancel" },
    { text: "Xoá", style: "destructive", onPress: () => void attempt(() => removeGroupMember(conversation, userId)) },
  ]);

  const members = [...conversation.memberIds].sort((a, b) => rank(conversation, a) - rank(conversation, b));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.head}>
        <Avatar id={conversation.id} name={title} uri={peer?.avatar ?? conversation.avatar} group={isGroup} size={88} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {isGroup ? `${conversation.memberIds.length} thành viên` : lastSeenText(peer?.online ?? false, peer?.lastSeen)}
        </Text>
        {!isGroup && peer?.bio ? <Text style={styles.bio}>{peer.bio}</Text> : null}
      </View>

      <View style={styles.card}>
        <Toggle icon="pin-outline" label="Ghim cuộc trò chuyện" value={conversation.pinned}
          onChange={pinned => void attempt(() => setConversationSettings(conversationId, { pinned }))} />
        <View style={styles.divider} />
        <Toggle icon="notifications-off-outline" label="Tắt thông báo" value={conversation.muted}
          onChange={muted => void attempt(() => setConversationSettings(conversationId, { muted }))} />
      </View>

      {isGroup ? (
        <>
          <Text style={styles.section}>Thành viên</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => navigation.navigate("PickFriends", { addTo: conversationId })}>
              <View style={styles.addIcon}><Ionicons name="person-add" size={20} color={colors.primary} /></View>
              <Text style={[styles.rowLabel, { color: colors.primary }]}>Thêm thành viên</Text>
            </Pressable>
            {members.map(userId => {
              const user = userId === me.id ? me : users[userId];
              const role = conversation.roles[userId];
              const removable = canManage && userId !== me.id && role !== "OWNER" && !(myRole === "ADMIN" && role === "ADMIN");
              return (
                <View key={userId}>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Avatar id={userId} name={user?.name ?? "?"} uri={user?.avatar} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel} numberOfLines={1}>{userId === me.id ? `${me.name} (bạn)` : user?.name ?? "Người dùng"}</Text>
                      {ROLE[role] ? <Text style={styles.role}>{ROLE[role]}</Text> : null}
                    </View>
                    {removable ? (
                      <Pressable hitSlop={10} onPress={() => confirmRemove(userId)} accessibilityLabel="Xoá khỏi nhóm">
                        <Ionicons name="remove-circle-outline" size={24} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.card, { marginTop: 16 }]}>
            <Pressable style={styles.row} onPress={confirmLeave}>
              <Ionicons name="exit-outline" size={22} color={colors.danger} />
              <Text style={[styles.rowLabel, { color: colors.danger }]}>Rời nhóm</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function rank(conversation: Conversation, userId: string): number {
  const role = conversation.roles[userId];
  return role === "OWNER" ? 0 : role === "ADMIN" ? 1 : 2;
}

function Toggle({ icon, label, value, onChange }: {
  icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: boolean; onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  head: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 24, backgroundColor: colors.surface, marginBottom: 16, gap: 6 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center", marginTop: 8 },
  subtitle: { fontSize: 14, color: colors.muted },
  bio: { fontSize: 14, color: colors.text, textAlign: "center", marginTop: 6 },
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, fontSize: 13, fontWeight: "600", color: colors.muted },
  card: { backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  rowLabel: { fontSize: 16, color: colors.text },
  role: { fontSize: 12, color: colors.muted, marginTop: 2 },
  addIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#E6F0FF" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 16 },
});

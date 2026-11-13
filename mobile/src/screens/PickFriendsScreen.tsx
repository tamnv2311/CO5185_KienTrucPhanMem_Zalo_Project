import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenProps } from "../navigation";
import { addGroupMembers, createGroup, errorText, useStore } from "../store";
import { Avatar, Button, colors, Empty } from "../ui";

/** Creates a group from chosen friends, or adds friends to an existing group (route param addTo). */
export default function PickFriendsScreen({ route, navigation }: ScreenProps<"PickFriends">) {
  const addTo = route.params?.addTo;
  const group = useStore(state => addTo ? state.conversations[addTo] : undefined);
  const users = useStore(state => state.users);
  const friendIds = useStore(state => state.friendIds);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const friends = useMemo(() => friendIds
    .filter(id => users[id] && !group?.memberIds.includes(id))
    .map(id => users[id])
    .sort((a, b) => a.name.localeCompare(b.name, "vi")), [friendIds, users, group]);

  const toggle = (id: string) => setPicked(now => now.includes(id) ? now.filter(other => other !== id) : [...now, id]);

  const ready = picked.length > 0 && (addTo ? true : name.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    try {
      if (group) {
        await addGroupMembers(group, picked);
        navigation.goBack();
      } else {
        const conversationId = await createGroup(name, picked);
        if (conversationId) navigation.replace("Chat", { conversationId });
        else navigation.goBack();
      }
    } catch (failure) {
      Alert.alert("ZaloLite", errorText(failure));
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      {!addTo ? (
        <TextInput style={styles.name} placeholder="Tên nhóm" placeholderTextColor={colors.muted}
          value={name} onChangeText={setName} maxLength={60} />
      ) : null}
      <Text style={styles.header}>
        {addTo ? "Chọn bạn để thêm vào nhóm" : "Chọn thành viên"}{picked.length ? ` · đã chọn ${picked.length}` : ""}
      </Text>
      <FlatList
        data={friends}
        keyExtractor={user => user.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={friends.length ? undefined : { flex: 1 }}
        ListEmptyComponent={<Empty icon="people-outline" title={addTo ? "Mọi người bạn đều đã ở trong nhóm" : "Chưa có bạn bè để lập nhóm"} />}
        renderItem={({ item }) => {
          const on = picked.includes(item.id);
          return (
            <Pressable onPress={() => toggle(item.id)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#EEF2F7" }]}>
              <Avatar id={item.id} name={item.name} uri={item.avatar} size={44} />
              <Text style={styles.friend} numberOfLines={1}>{item.name}</Text>
              <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={26} color={on ? colors.primary : "#C3C9D3"} />
            </Pressable>
          );
        }}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button title={addTo ? "Thêm vào nhóm" : "Tạo nhóm"} onPress={submit} busy={busy} disabled={!ready} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  name: { margin: 12, marginBottom: 0, height: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, fontSize: 13, fontWeight: "600", color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  friend: { flex: 1, fontSize: 16, color: colors.text },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

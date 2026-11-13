import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { RemoteUser } from "../api/zalolite";
import { ScreenProps } from "../navigation";
import { answerFriendRequest, errorText, openDirect, searchUsers, sendFriendRequest } from "../store";
import { Avatar, colors, Empty } from "../ui";

export default function AddFriendScreen({ navigation }: ScreenProps<"AddFriend">) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteUser[]>();
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string>();

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setResults((await searchUsers(query)).filter(user => user.relation !== "SELF"));
    } catch (failure) {
      Alert.alert("ZaloLite", errorText(failure));
    }
    setSearching(false);
  };

  /** Runs an action on a search result, then shows its new relation. */
  const act = async (user: RemoteUser, action: () => Promise<unknown>, relation?: string) => {
    setBusy(user.id);
    try {
      await action();
      if (relation) setResults(list => list?.map(other => other.id === user.id ? { ...other, relation } : other));
    } catch (failure) {
      Alert.alert("ZaloLite", errorText(failure));
    }
    setBusy(undefined);
  };

  const button = (user: RemoteUser) => {
    if (busy === user.id) return <ActivityIndicator color={colors.primary} />;
    switch (user.relation) {
      case "FRIEND":
        return <Chip title="Nhắn tin" onPress={() => act(user, async () => navigation.replace("Chat", { conversationId: await openDirect(user.id) }))} />;
      case "REQUEST_SENT":
        return <Text style={styles.state}>Đã gửi lời mời</Text>;
      case "REQUEST_RECEIVED":
        return user.friendshipId
          ? <Chip title="Đồng ý" primary onPress={() => act(user, () => answerFriendRequest(user.friendshipId!, true), "FRIEND")} />
          : <Text style={styles.state}>Đã mời bạn</Text>;
      case "BLOCKED":
        return <Text style={styles.state}>Không khả dụng</Text>;
      default:
        return <Chip title="Kết bạn" primary onPress={() => act(user, () => sendFriendRequest(user.id), "REQUEST_SENT")} />;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput style={styles.input} placeholder="Tên, email hoặc số điện thoại" placeholderTextColor={colors.muted}
          value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search"
          autoCapitalize="none" autoCorrect={false} autoFocus clearButtonMode="while-editing" />
      </View>
      {searching ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={user => user.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={results?.length ? undefined : { flex: 1 }}
          ListEmptyComponent={results
            ? <Empty icon="person-outline" title="Không tìm thấy ai" hint="Thử lại với email hoặc số điện thoại chính xác." />
            : <Empty icon="person-add-outline" title="Tìm bạn bè" hint="Nhập ít nhất 2 ký tự rồi bấm Tìm trên bàn phím." />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar id={item.id} name={item.displayName} uri={item.avatar ?? undefined} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                {item.bio ? <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text> : null}
              </View>
              {button(item)}
            </View>
          )}
        />
      )}
    </View>
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
  search: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, height: 44, borderRadius: 10, backgroundColor: colors.background },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  name: { fontSize: 16, color: colors.text },
  bio: { fontSize: 13, color: colors.muted, marginTop: 2 },
  state: { fontSize: 13, color: colors.muted },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});

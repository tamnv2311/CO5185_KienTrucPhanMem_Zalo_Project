import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { errorText, signOut, updateAvatar, updateProfile, useStore } from "../store";
import { Avatar, Button, colors } from "../ui";

export default function ProfileScreen() {
  const me = useStore(state => state.me);
  const server = useStore(state => state.server);
  const connected = useStore(state => state.connected);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!me) return null;

  const edit = () => {
    setName(me.name);
    setBio(me.bio ?? "");
    setEditing(true);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert("ZaloLite", "Tên hiển thị không được để trống"); return; }
    setSaving(true);
    try {
      await updateProfile({ name, bio });
      setEditing(false);
    } catch (failure) {
      Alert.alert("ZaloLite", errorText(failure));
    }
    setSaving(false);
  };

  const changeAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      setUploading(true);
      await updateAvatar({ uri: asset.uri, name: asset.fileName ?? `avatar_${Date.now()}.jpg`, mime: asset.mimeType ?? "image/jpeg" });
    } catch (failure) {
      Alert.alert("Không đổi được ảnh đại diện", errorText(failure));
    }
    setUploading(false);
  };

  const confirmSignOut = () => Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
    { text: "Huỷ", style: "cancel" },
    { text: "Đăng xuất", style: "destructive", onPress: () => void signOut() },
  ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <Pressable onPress={changeAvatar} disabled={uploading} accessibilityLabel="Đổi ảnh đại diện">
          <Avatar id={me.id} name={me.name} uri={me.avatar} size={96} />
          <View style={styles.camera}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={16} color="#fff" />}
          </View>
        </Pressable>
        <Text style={styles.name}>{me.name}</Text>
        {me.email ? <Text style={styles.muted}>{me.email}</Text> : null}
        {me.bio && !editing ? <Text style={styles.bio}>{me.bio}</Text> : null}
      </View>

      {editing ? (
        <View style={styles.card}>
          <Text style={styles.label}>Tên hiển thị</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={60} />
          <Text style={styles.label}>Giới thiệu</Text>
          <TextInput style={[styles.input, { height: 90, textAlignVertical: "top", paddingTop: 12 }]} value={bio} onChangeText={setBio}
            multiline maxLength={500} placeholder="Viết vài dòng về bạn" placeholderTextColor={colors.muted} />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            <Button title="Huỷ" tone="plain" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            <Button title="Lưu" onPress={save} busy={saving} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={edit}>
            <Ionicons name="create-outline" size={22} color={colors.text} />
            <Text style={styles.rowLabel}>Sửa hồ sơ</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </View>
      )}

      <View style={[styles.card, { marginTop: 16 }]}>
        <View style={styles.row}>
          <Ionicons name="server-outline" size={22} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Máy chủ</Text>
            <Text style={styles.muted} numberOfLines={1}>{server.replace(/^https?:\/\//, "")}</Text>
          </View>
          <View style={[styles.state, { backgroundColor: connected ? colors.online : "#F5A524" }]} />
          <Text style={styles.muted}>{connected ? "Đã kết nối" : "Đang kết nối"}</Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Pressable style={styles.row} onPress={confirmSignOut}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={[styles.rowLabel, { color: colors.danger }]}>Đăng xuất</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  head: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 24, backgroundColor: colors.surface, marginBottom: 16, gap: 4 },
  camera: { position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 10, textAlign: "center" },
  muted: { fontSize: 14, color: colors.muted },
  bio: { fontSize: 15, color: colors.text, textAlign: "center", marginTop: 8, lineHeight: 21 },
  card: { backgroundColor: colors.surface, paddingHorizontal: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: 14, marginBottom: 6 },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: 52 },
  rowLabel: { flex: 1, fontSize: 16, color: colors.text },
  state: { width: 8, height: 8, borderRadius: 4 },
});

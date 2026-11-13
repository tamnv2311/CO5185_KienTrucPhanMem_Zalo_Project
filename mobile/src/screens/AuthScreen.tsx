import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { errorText, signIn, signUp, useStore } from "../store";
import { Button, colors } from "../ui";

export default function AuthScreen() {
  const savedServer = useStore(state => state.server);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(savedServer);
  const [showServer, setShowServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (registering && !name.trim()) { setError("Nhập tên hiển thị"); return; }
    if (!email.trim() || !password) { setError("Nhập email và mật khẩu"); return; }
    if (registering && password.length < 6) { setError("Mật khẩu cần ít nhất 6 ký tự"); return; }
    setBusy(true);
    setError(undefined);
    try {
      await (registering ? signUp(server, email, password, name) : signIn(server, email, password));
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Ionicons name="chatbubbles" size={44} color="#fff" />
          </View>
          <Text style={styles.title}>ZaloLite</Text>
          <Text style={styles.subtitle}>{registering ? "Tạo tài khoản mới" : "Đăng nhập để trò chuyện"}</Text>

          {registering ? (
            <TextInput style={styles.input} placeholder="Tên hiển thị" placeholderTextColor={colors.muted}
              value={name} onChangeText={setName} autoCapitalize="words" maxLength={60} />
          ) : null}
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted}
            value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="Mật khẩu" placeholderTextColor={colors.muted}
            value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} returnKeyType="go" />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={registering ? "Đăng ký" : "Đăng nhập"} onPress={submit} busy={busy} style={{ marginTop: 8 }} />

          <Pressable onPress={() => { setRegistering(!registering); setError(undefined); }} style={styles.link}>
            <Text style={styles.linkText}>{registering ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}</Text>
          </Pressable>

          <Pressable onPress={() => setShowServer(!showServer)} style={styles.link}>
            <Text style={styles.serverToggle}>Máy chủ: {server.replace(/^https?:\/\//, "")}</Text>
          </Pressable>
          {showServer ? (
            <TextInput style={styles.input} placeholder="https://may-chu-cua-ban" placeholderTextColor={colors.muted}
              value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  title: { fontSize: 30, fontWeight: "700", color: colors.primary, textAlign: "center", marginTop: 8 },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: 12 },
  input: { height: 50, borderRadius: 12, backgroundColor: colors.background, paddingHorizontal: 16, fontSize: 16, color: colors.text },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
  link: { paddingVertical: 8, alignItems: "center" },
  linkText: { color: colors.primary, fontSize: 15, fontWeight: "500" },
  serverToggle: { color: colors.muted, fontSize: 13 },
});

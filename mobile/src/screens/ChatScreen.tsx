import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mediaUrl } from "../api/client";
import { ScreenProps } from "../navigation";
import {
  deleteMessage, errorText, loadOlder, Message, peerOf, previewText, reactToMessage, recallMessage, resendMessage, sendMessage,
  sendTyping, setActiveConversation, titleOf, useStore, User,
} from "../store";
import { Avatar, clock, colors, dayLabel, IconButton, isSameDay, lastSeenText } from "../ui";

const NO_MESSAGES: Message[] = [];
const NOBODY: string[] = [];
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];
const STATUS: Record<Message["status"], string> = {
  sending: "Đang gửi", sent: "Đã gửi", delivered: "Đã nhận", seen: "Đã xem", failed: "Chưa gửi được · chạm để gửi lại",
};

export default function ChatScreen({ route, navigation }: ScreenProps<"Chat">) {
  const { conversationId } = route.params;
  const conversation = useStore(state => state.conversations[conversationId]);
  const messages = useStore(state => state.messages[conversationId] ?? NO_MESSAGES);
  const typing = useStore(state => state.typing[conversationId] ?? NOBODY);
  const users = useStore(state => state.users);
  const me = useStore(state => state.me);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message>();
  const [selected, setSelected] = useState<Message>();
  const [viewer, setViewer] = useState<string>();
  const [loadingOlder, setLoadingOlder] = useState(false);

  // While this screen is in front, the conversation is kept read.
  useFocusEffect(useCallback(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(undefined);
  }, [conversationId]));

  // The conversation disappears when I leave the group or get removed from it.
  useEffect(() => {
    if (!conversation && navigation.isFocused()) navigation.goBack();
  }, [conversation, navigation]);

  const meId = me?.id ?? "";
  const title = conversation ? titleOf(conversation, users, meId) : "";
  const peerId = conversation ? peerOf(conversation, meId) : undefined;
  const peer = peerId ? users[peerId] : undefined;
  const subtitle = !conversation ? "" : conversation.type === "group"
    ? `${conversation.memberIds.length} thành viên` : lastSeenText(peer?.online ?? false, peer?.lastSeen);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
      ),
      headerRight: () => (
        <IconButton name="information-circle-outline" label="Thông tin cuộc trò chuyện"
          onPress={() => navigation.navigate("ConversationInfo", { conversationId })} />
      ),
    });
  }, [navigation, title, subtitle, conversationId]);

  // The list is inverted: index 0 is the newest message, at the bottom of the screen.
  const data = useMemo(() => [...messages].reverse(), [messages]);

  const send = () => {
    const content = text.trim();
    if (!content) return;
    sendMessage(conversationId, { text: content, replyTo });
    setText("");
    setReplyTo(undefined);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      sendMessage(conversationId, {
        file: { uri: asset.uri, name: asset.fileName ?? `anh_${Date.now()}.jpg`, mime: asset.mimeType ?? "image/jpeg" },
        replyTo,
      });
      setReplyTo(undefined);
    } catch {
      Alert.alert("Không mở được thư viện ảnh", "Hãy cấp quyền truy cập ảnh cho ứng dụng trong phần Cài đặt.");
    }
  };

  const older = async () => {
    if (loadingOlder || !conversation?.hasMore) return;
    setLoadingOlder(true);
    await loadOlder(conversationId);
    setLoadingOlder(false);
  };

  const act = async (action: () => Promise<unknown>) => {
    setSelected(undefined);
    try { await action(); } catch (failure) { Alert.alert("ZaloLite", errorText(failure)); }
  };

  const typingNames = typing.map(id => users[id]?.name ?? "Ai đó");

  if (!conversation || !me) return <View style={styles.screen} />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}>
      <FlatList
        data={data}
        inverted
        keyExtractor={message => message.clientMsgId || message.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReached={older}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingOlder ? <ActivityIndicator style={{ margin: 12 }} color={colors.primary} /> : undefined}
        renderItem={({ item, index }) => {
          const before = data[index + 1]; // the message shown above this one
          const startsDay = !before || !isSameDay(before.createdAt, item.createdAt);
          const startsGroup = startsDay || before.senderId !== item.senderId || before.kind === "system";
          return (
            <Bubble
              message={item} mine={item.senderId === me.id} sender={users[item.senderId]}
              quoted={item.replyTo ? (item.replyTo.senderId === me.id ? "Bạn" : users[item.replyTo.senderId]?.name ?? "") : undefined}
              showDay={startsDay} showSender={startsGroup && conversation.type === "group"} showAvatar={startsGroup}
              showStatus={index === 0 || item.status === "failed" || item.status === "sending"}
              onLongPress={setSelected} onOpenImage={setViewer}
            />
          );
        }}
      />

      {typingNames.length ? (
        <Text style={styles.typing} numberOfLines={1}>
          {conversation.type === "group" ? `${typingNames.join(", ")} đang soạn tin…` : "Đang soạn tin…"}
        </Text>
      ) : null}

      {replyTo ? (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyName}>Trả lời {replyTo.senderId === me.id ? "chính mình" : users[replyTo.senderId]?.name ?? ""}</Text>
            <Text style={styles.replyPreview} numberOfLines={1}>{previewText(replyTo)}</Text>
          </View>
          <IconButton name="close" label="Bỏ trả lời" color={colors.muted} size={20} onPress={() => setReplyTo(undefined)} />
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <IconButton name="image-outline" label="Gửi ảnh" color={colors.primary} size={26} onPress={pickImage} />
        <TextInput
          style={styles.input} placeholder="Tin nhắn" placeholderTextColor={colors.muted} multiline
          value={text} onChangeText={value => { setText(value); if (value) sendTyping(conversationId); }}
        />
        <IconButton name="send" label="Gửi" color={text.trim() ? colors.primary : "#B6BEC9"} size={24} onPress={send} />
      </View>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(undefined)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(undefined)}>
          {selected ? (
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              {!selected.recalled && selected.status !== "sending" && selected.status !== "failed" ? (
                <View style={styles.emojiRow}>
                  {EMOJIS.map(emoji => (
                    <Pressable key={emoji} onPress={() => act(() => reactToMessage(selected, emoji))} hitSlop={6}>
                      <Text style={styles.emoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {!selected.recalled && selected.status !== "sending" && selected.status !== "failed" ? (
                <Action icon="arrow-undo-outline" label="Trả lời" onPress={() => { setReplyTo(selected); setSelected(undefined); }} />
              ) : null}
              {selected.status === "failed" ? (
                <Action icon="refresh" label="Gửi lại" onPress={() => { resendMessage(selected); setSelected(undefined); }} />
              ) : null}
              {selected.senderId === me.id && !selected.recalled && selected.status !== "sending" && selected.status !== "failed" ? (
                <Action icon="return-up-back-outline" label="Thu hồi với mọi người" onPress={() => act(() => recallMessage(selected))} />
              ) : null}
              {selected.status !== "sending" ? (
                <Action icon="trash-outline" label="Xoá ở phía tôi" danger onPress={() => act(() => deleteMessage(selected))} />
              ) : null}
              <Action icon="close" label="Đóng" onPress={() => setSelected(undefined)} />
            </View>
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(undefined)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(undefined)}>
          {viewer ? <Image source={{ uri: viewer }} style={{ flex: 1 }} resizeMode="contain" /> : null}
          <Text style={[styles.viewerHint, { bottom: insets.bottom + 16 }]}>Chạm để đóng</Text>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Action({ icon, label, onPress, danger }: {
  icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; danger?: boolean;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.background }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ fontSize: 16, color }}>{label}</Text>
    </Pressable>
  );
}

interface BubbleProps {
  message: Message;
  mine: boolean;
  sender?: User;
  /** Name of the author of the quoted message, when this one is a reply. */
  quoted?: string;
  showDay: boolean;
  showSender: boolean;
  showAvatar: boolean;
  showStatus: boolean;
  onLongPress: (message: Message) => void;
  onOpenImage: (url: string) => void;
}

const Bubble = memo(function Bubble({ message, mine, sender, quoted, showDay, showSender, showAvatar, showStatus, onLongPress, onOpenImage }: BubbleProps) {
  const day = showDay ? <Text style={styles.day}>{dayLabel(message.createdAt)}</Text> : null;

  if (message.kind === "system") {
    return (
      <View>
        {day}
        <Text style={styles.system}>{message.text}</Text>
      </View>
    );
  }

  const reactions = Object.entries(message.reactions).filter(([, ids]) => ids.length > 0);
  return (
    <View>
      {day}
      <View style={[styles.messageRow, mine ? { justifyContent: "flex-end" } : null, showAvatar && { marginTop: 8 }]}>
        {!mine ? (
          <View style={{ width: 32 }}>
            {showAvatar ? <Avatar id={message.senderId} name={sender?.name ?? "?"} uri={sender?.avatar} size={32} /> : null}
          </View>
        ) : null}
        <View style={{ maxWidth: "78%", alignItems: mine ? "flex-end" : "flex-start" }}>
          <Pressable
            onLongPress={() => onLongPress(message)} delayLongPress={250}
            onPress={message.status === "failed" ? () => onLongPress(message) : undefined}
            style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, message.status === "failed" && { opacity: 0.6 }]}
          >
            {showSender && !mine ? <Text style={styles.sender}>{sender?.name ?? "Người dùng"}</Text> : null}
            {message.recalled ? (
              <Text style={styles.recalled}>Tin nhắn đã được thu hồi</Text>
            ) : (
              <>
                {message.replyTo ? (
                  <View style={styles.quote}>
                    {quoted ? <Text style={styles.quoteName} numberOfLines={1}>{quoted}</Text> : null}
                    <Text style={styles.quoteText} numberOfLines={2}>{message.replyTo.preview || "Tin nhắn"}</Text>
                  </View>
                ) : null}
                {message.attachments?.map(attachment => {
                  const url = mediaUrl(attachment.url) ?? attachment.url;
                  return attachment.kind === "image" ? (
                    <Pressable key={attachment.id} onPress={() => onOpenImage(url)} onLongPress={() => onLongPress(message)} delayLongPress={250}>
                      <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                    </Pressable>
                  ) : (
                    <Pressable key={attachment.id} style={styles.file} onPress={() => void Linking.openURL(url).catch(() => undefined)}
                      onLongPress={() => onLongPress(message)} delayLongPress={250}>
                      <Ionicons name={attachment.kind === "video" ? "videocam" : "document-text"} size={26} color={colors.primary} />
                      <Text style={styles.fileName} numberOfLines={2}>{attachment.name}</Text>
                    </Pressable>
                  );
                })}
                {message.text ? <Text style={message.kind === "sticker" ? styles.sticker : styles.text}>{message.text}</Text> : null}
              </>
            )}
            <Text style={styles.time}>{clock(message.createdAt)}</Text>
          </Pressable>
          {reactions.length ? (
            <View style={styles.reactions}>
              {reactions.map(([emoji, ids]) => (
                <Text key={emoji} style={styles.reaction}>{emoji}{ids.length > 1 ? ` ${ids.length}` : ""}</Text>
              ))}
            </View>
          ) : null}
          {mine && showStatus ? (
            <Text style={[styles.status, message.status === "failed" && { color: colors.danger }]}>{STATUS[message.status]}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#E9EEF5" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "600", maxWidth: 220 },
  headerSubtitle: { color: "#D6E6FF", fontSize: 12, maxWidth: 220 },
  list: { paddingHorizontal: 10, paddingVertical: 8 },
  day: { alignSelf: "center", marginVertical: 10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: "hidden", backgroundColor: "#C9D2DE", color: "#fff", fontSize: 12 },
  system: { alignSelf: "center", textAlign: "center", marginVertical: 6, paddingHorizontal: 12, color: colors.muted, fontSize: 13 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 3 },
  bubble: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, minWidth: 56 },
  bubbleMine: { backgroundColor: colors.bubbleMine },
  bubbleTheirs: { backgroundColor: colors.bubbleTheirs },
  sender: { fontSize: 12, fontWeight: "600", color: colors.primary, marginBottom: 2 },
  text: { fontSize: 16, lineHeight: 22, color: colors.text },
  sticker: { fontSize: 44, lineHeight: 54 },
  recalled: { fontSize: 15, fontStyle: "italic", color: colors.muted },
  time: { fontSize: 11, color: colors.muted, marginTop: 3 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8, marginBottom: 6 },
  quoteName: { fontSize: 13, fontWeight: "600", color: colors.text },
  quoteText: { fontSize: 13, color: colors.muted },
  image: { width: 220, height: 220, borderRadius: 10, marginBottom: 4, backgroundColor: colors.border },
  file: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 220, marginBottom: 4 },
  fileName: { flex: 1, fontSize: 15, color: colors.text },
  reactions: { flexDirection: "row", gap: 4, marginTop: -6, marginHorizontal: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: "#fff", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  reaction: { fontSize: 12, color: colors.text },
  status: { fontSize: 11, color: colors.muted, marginTop: 2, marginRight: 4 },
  typing: { paddingHorizontal: 14, paddingVertical: 4, fontSize: 12, color: colors.muted },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  replyName: { fontSize: 13, fontWeight: "600", color: colors.primary },
  replyPreview: { fontSize: 13, color: colors.muted },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: 8, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 38, maxHeight: 120, borderRadius: 19, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontSize: 16, color: colors.text, backgroundColor: colors.background },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8 },
  emojiRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  emoji: { fontSize: 30 },
  action: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerHint: { position: "absolute", alignSelf: "center", color: "#fff", opacity: 0.7, fontSize: 13 },
});

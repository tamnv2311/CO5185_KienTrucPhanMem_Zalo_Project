import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootStackParamList, useRootNavigation } from "./src/navigation";
import AddFriendScreen from "./src/screens/AddFriendScreen";
import AuthScreen from "./src/screens/AuthScreen";
import ChatScreen from "./src/screens/ChatScreen";
import ContactsScreen from "./src/screens/ContactsScreen";
import ConversationInfoScreen from "./src/screens/ConversationInfoScreen";
import ConversationsScreen from "./src/screens/ConversationsScreen";
import PickFriendsScreen from "./src/screens/PickFriendsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import { boot, useStore } from "./src/store";
import { colors, IconButton } from "./src/ui";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const header = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "600" as const },
};

function HeaderActions() {
  const navigation = useRootNavigation();
  return (
    <View style={{ flexDirection: "row", gap: 4, marginRight: 8 }}>
      <IconButton name="person-add-outline" label="Thêm bạn" onPress={() => navigation.navigate("AddFriend")} />
      <IconButton name="people-outline" label="Tạo nhóm" onPress={() => navigation.navigate("PickFriends")} />
    </View>
  );
}

function Tabs() {
  const unread = useStore(state => state.conversations);
  const requests = useStore(state => state.incoming.length);
  const unreadCount = Object.values(unread).reduce((total, conversation) => total + (conversation.muted ? 0 : conversation.unread), 0);
  return (
    <Tab.Navigator screenOptions={{ ...header, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted }}>
      <Tab.Screen name="Messages" component={ConversationsScreen} options={{
        title: "Tin nhắn", headerRight: () => <HeaderActions />,
        tabBarBadge: unreadCount ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
        tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={size} color={color} />,
      }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{
        title: "Danh bạ", headerRight: () => <HeaderActions />,
        tabBarBadge: requests || undefined,
        tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />,
      }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{
        title: "Cá nhân",
        tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />,
      }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const booting = useStore(state => state.booting);
  const signedIn = useStore(state => !!state.me);

  useEffect(() => { void boot(); }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={signedIn ? "light" : "dark"} />
      {booting ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !signedIn ? (
        <AuthScreen />
      ) : (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ ...header, headerBackButtonDisplayMode: "minimal" }}>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "" }} />
            <Stack.Screen name="ConversationInfo" component={ConversationInfoScreen} options={{ title: "Thông tin" }} />
            <Stack.Screen name="AddFriend" component={AddFriendScreen} options={{ title: "Thêm bạn" }} />
            <Stack.Screen name="PickFriends" component={PickFriendsScreen}
              options={({ route }) => ({ title: route.params?.addTo ? "Thêm thành viên" : "Tạo nhóm" })} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

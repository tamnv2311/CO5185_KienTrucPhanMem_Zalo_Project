import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Tabs: undefined;
  Chat: { conversationId: string };
  ConversationInfo: { conversationId: string };
  AddFriend: undefined;
  /** Picks friends for a new group, or for the group conversation given in addTo. */
  PickFriends: { addTo?: string } | undefined;
};

export type ScreenProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Name>;

/** Navigation of the root stack, for screens that live inside the tabs. */
export const useRootNavigation = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();

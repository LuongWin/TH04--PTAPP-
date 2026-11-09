import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Contacts: undefined;
  Notifications: undefined;
  Settings: undefined;
};
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  CompleteProfile: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Chat: { chatId: string; partnerId: string };
};

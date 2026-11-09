import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Bell,
  ContactRound,
  MessageCircle,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorNotice, Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ChatDataProvider, useChatData } from '../context/ChatDataContext';
import {
  LoginScreen,
  RegisterScreen,
  CompleteProfileScreen,
} from '../screens/AuthScreens';
import { HomeScreen } from '../screens/HomeScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { errorMessage } from '../services/errors';
import { colors, shared } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
type TabIconProps = { color: string; size: number; focused: boolean };
function NavigationIcon({
  icon: Icon,
  color,
  size,
  focused,
}: TabIconProps & { icon: LucideIcon }) {
  return (
    <View style={[styles.tabIcon, focused && styles.activeTabIcon]}>
      <Icon size={size - 2} color={color} strokeWidth={focused ? 2.3 : 1.7} />
    </View>
  );
}
const tabIcons = {
  Home: (props: TabIconProps) => (
    <NavigationIcon icon={MessageCircle} {...props} />
  ),
  Contacts: (props: TabIconProps) => (
    <NavigationIcon icon={ContactRound} {...props} />
  ),
  Notifications: (props: TabIconProps) => (
    <NavigationIcon icon={Bell} {...props} />
  ),
  Settings: (props: TabIconProps) => (
    <NavigationIcon icon={Settings} {...props} />
  ),
};
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.ink,
    border: colors.border,
  },
};

function MainTabs() {
  const { conversations } = useChatData();
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarButtonTestID: `tab-${route.name.toLowerCase()}`,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#8A978E',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: tabIcons[route.name],
        tabBarBadgeStyle: styles.badge,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Tin nhắn',
          tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ title: 'Danh bạ' }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Thông báo' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Cài đặt' }}
      />
    </Tab.Navigator>
  );
}

function AuthenticatedNavigation() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Chat" component={ChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export function RootNavigator() {
  const {
    user,
    profile,
    initializing,
    profileLoading,
    profileError,
    registering,
    retryProfile,
    signOut,
  } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const exit = () => {
    void signOut().catch(failure => setError(errorMessage(failure)));
  };
  if (initializing || (user && (profileLoading || registering))) {
    return (
      <SafeAreaView style={shared.screen}>
        <Loading
          label={registering ? 'Đang tạo hồ sơ của bạn…' : 'Đang mở Chạm…'}
        />
        {user && (
          <View style={styles.recovery}>
            <Text style={shared.subtitle}>Cần kết nối mạng để tải hồ sơ.</Text>
            <ErrorNotice message={error} />
            <Button secondary title="Quay về đăng nhập" onPress={exit} />
          </View>
        )}
      </SafeAreaView>
    );
  }
  if (user && profileError) {
    return (
      <SafeAreaView style={shared.screen}>
        <View style={[shared.content, styles.recoveryCenter]}>
          <Text style={shared.title}>Chưa tải được hồ sơ</Text>
          <ErrorNotice message={profileError} />
          <ErrorNotice message={error} />
          <Button title="Thử lại" onPress={retryProfile} />
          <Button secondary title="Đăng xuất" onPress={exit} />
        </View>
      </SafeAreaView>
    );
  }
  if (user && profile) {
    return (
      <ChatDataProvider key={user.uid} uid={user.uid}>
        <AuthenticatedNavigation />
      </ChatDataProvider>
    );
  }
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        key={user ? 'profile' : 'guest'}
      >
        {user ? (
          <Stack.Screen
            name="CompleteProfile"
            component={CompleteProfileScreen}
          />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    paddingTop: 8,
    elevation: 0,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  tabItem: { paddingBottom: 4 },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    width: 44,
    height: 29,
  },
  activeTabIcon: { backgroundColor: colors.mint },
  badge: { backgroundColor: colors.primary, color: colors.white, fontSize: 10 },
  recovery: { padding: 24, gap: 14 },
  recoveryCenter: { justifyContent: 'center', padding: 28, gap: 18 },
});

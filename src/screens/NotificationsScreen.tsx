import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import {
  Avatar,
  ConnectionNotice,
  EmptyState,
  ErrorNotice,
  Screen,
} from '../components/ui';
import { useChatData } from '../context/ChatDataContext';
import { useOpenChat } from '../hooks/useOpenChat';
import { colors, shared } from '../theme';
import { conversationTime } from '../utils/chat';

export function NotificationsScreen() {
  const { conversations, users, connected, error, refresh } = useChatData();
  const { openChat } = useOpenChat();
  const notifications = conversations.filter(item => item.unreadCount > 0);
  return (
    <Screen>
      <ConnectionNotice connected={connected} />
      <View style={styles.header}>
        <Text style={shared.title}>Thông báo</Text>
        <Text style={shared.subtitle}>Những lời nhắn đang chờ bạn mở.</Text>
      </View>
      <View style={styles.error}>
        <ErrorNotice message={error} onRetry={refresh} />
      </View>
      <FlatList
        data={notifications}
        keyExtractor={item => item.chat.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={Bell}
            title="Mọi thứ đã được cập nhật"
            description="Khi có tin nhắn chưa đọc, thông báo sẽ xuất hiện ở đây."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              void openChat(item.partnerId, item.chat.id);
            }}
            accessibilityRole="button"
            style={styles.notification}
          >
            <Avatar
              name={users[item.partnerId]?.fullName ?? 'Người dùng'}
              uri={users[item.partnerId]?.avatarUrl}
              size={46}
            />
            <View style={styles.body}>
              <Text style={styles.title}>
                {users[item.partnerId]?.fullName ?? 'Người dùng'}
              </Text>
              <Text style={styles.description}>
                Đã gửi bạn {item.unreadCount} tin nhắn chưa đọc.
              </Text>
              <Text style={styles.time}>
                {conversationTime(item.lastMessage.createdAt)}
              </Text>
            </View>
            <View style={styles.dot} />
          </Pressable>
        )}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { padding: 24, gap: 6 },
  error: { paddingHorizontal: 24 },
  list: { flexGrow: 1, padding: 20, gap: 12 },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1, gap: 5 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  description: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  time: { fontSize: 11, color: colors.muted, marginTop: 4 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});

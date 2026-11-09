import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Check,
  ChevronRight,
  MessageCirclePlus,
  UsersRound,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Avatar,
  ConnectionNotice,
  EmptyState,
  ErrorNotice,
  Loading,
  Screen,
  SearchBox,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatDataContext';
import { useOpenChat } from '../hooks/useOpenChat';
import { colors, shared } from '../theme';
import { conversationTime, matchesProfile } from '../utils/chat';
import type { RootStackParamList } from '../navigation/types';

export function HomeScreen() {
  const { user, profile } = useAuth();
  const {
    users,
    presence,
    conversations,
    connected,
    chatsLoading,
    error,
    refresh,
  } = useChatData();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { openChat, openingId } = useOpenChat();
  const [search, setSearch] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const unread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const rows = useMemo(
    () =>
      conversations.filter(
        item =>
          (!onlyUnread || item.unreadCount > 0) &&
          matchesProfile(users[item.partnerId], search),
      ),
    [conversations, users, search, onlyUnread],
  );
  const online = Object.values(users)
    .filter(item => item.uid !== user?.uid && presence[item.uid]?.online)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
  const contacts = () => navigation.navigate('Main', { screen: 'Contacts' });

  return (
    <Screen>
      <ConnectionNotice connected={connected} />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>CHẠM · MỖI NGÀY MỘT KẾT NỐI</Text>
          <Text style={shared.title}>
            Tin nhắn<Text style={styles.titleDot}>.</Text>
          </Text>
          <Text testID="home-unread" style={shared.subtitle}>
            {unread
              ? `Bạn có ${unread} tin nhắn chưa đọc`
              : 'Những câu chuyện luôn ở đây.'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở cài đặt tài khoản"
          onPress={() => navigation.navigate('Main', { screen: 'Settings' })}
        >
          <Avatar
            name={profile?.fullName ?? ''}
            uri={profile?.avatarUrl}
            size={48}
          />
        </Pressable>
      </View>
      <SearchBox
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm cuộc trò chuyện…"
      />
      {online.length > 0 && !search && (
        <View style={styles.onlineSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Đang hoạt động</Text>
            <Text style={styles.onlineCount}>{online.length} người</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.onlineList}
          >
            {online.map(person => (
              <Pressable
                key={person.uid}
                disabled={Boolean(openingId)}
                onPress={() => {
                  void openChat(person.uid);
                }}
                style={styles.onlinePerson}
                accessibilityRole="button"
                accessibilityLabel={`Trò chuyện với ${person.fullName}`}
              >
                <Avatar
                  name={person.fullName}
                  uri={person.avatarUrl}
                  size={54}
                  online
                />
                <Text numberOfLines={1} style={styles.onlineName}>
                  {person.fullName.split(' ').slice(-1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={styles.filters}>
        <Pressable
          onPress={() => setOnlyUnread(false)}
          style={[styles.filter, !onlyUnread && styles.activeFilter]}
          accessibilityRole="button"
          accessibilityState={{ selected: !onlyUnread }}
        >
          <Text
            style={[styles.filterText, !onlyUnread && styles.activeFilterText]}
          >
            Tất cả
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setOnlyUnread(true)}
          style={[styles.filter, onlyUnread && styles.activeFilter]}
          accessibilityRole="button"
          accessibilityState={{ selected: onlyUnread }}
        >
          <Text
            style={[styles.filterText, onlyUnread && styles.activeFilterText]}
          >
            Chưa đọc{unread ? `  ${unread}` : ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={contacts}
          accessibilityRole="button"
          accessibilityLabel="Bắt đầu cuộc trò chuyện"
          style={styles.newChat}
        >
          <MessageCirclePlus size={22} color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.errorWrap}>
        <ErrorNotice message={error} onRetry={refresh} />
      </View>
      {chatsLoading && !conversations.length ? (
        <Loading label="Đang mở hộp thư…" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.chat.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title={
                search
                  ? 'Chưa tìm thấy cuộc trò chuyện'
                  : onlyUnread
                  ? 'Bạn đã đọc hết rồi'
                  : 'Bắt đầu bằng một lời chào'
              }
              description={
                search
                  ? 'Thử tìm theo tên hoặc email khác nhé.'
                  : onlyUnread
                  ? 'Tin nhắn mới sẽ xuất hiện ở đây.'
                  : 'Chọn một người trong danh bạ để cùng mở một câu chuyện mới.'
              }
              icon={UsersRound}
              action={!search && !onlyUnread ? 'Mở danh bạ' : undefined}
              onAction={contacts}
            />
          }
          renderItem={({ item }) => {
            const person = users[item.partnerId];
            const name = person?.fullName ?? 'Người dùng';
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${item.unreadCount} tin chưa đọc`}
                onPress={() => {
                  void openChat(item.partnerId, item.chat.id);
                }}
                style={({ pressed }) => [
                  styles.conversation,
                  pressed && styles.pressed,
                ]}
              >
                <Avatar
                  name={name}
                  uri={person?.avatarUrl}
                  size={56}
                  online={Boolean(presence[item.partnerId]?.online)}
                />
                <View style={styles.conversationBody}>
                  <View style={shared.row}>
                    <Text
                      style={[
                        styles.name,
                        item.unreadCount > 0 && styles.unreadName,
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={[
                        styles.time,
                        item.unreadCount > 0 && styles.unreadTime,
                      ]}
                    >
                      {conversationTime(item.lastMessage.createdAt)}
                    </Text>
                  </View>
                  <View style={[shared.row, styles.previewRow]}>
                    {item.lastMessage.senderId === user?.uid && (
                      <Check size={15} color={colors.muted} />
                    )}
                    <Text
                      style={[
                        styles.preview,
                        item.unreadCount > 0 && styles.unreadPreview,
                      ]}
                      numberOfLines={1}
                    >
                      {item.lastMessage.senderId === user?.uid ? 'Bạn: ' : ''}
                      {item.lastMessage.text}
                    </Text>
                    {item.unreadCount > 0 ? (
                      <View style={styles.count}>
                        <Text style={styles.countText}>
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </Text>
                      </View>
                    ) : (
                      <ChevronRight size={14} color="#B0BDB4" />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      {openingId && (
        <View style={styles.opening}>
          <ActivityIndicator color={colors.primary} />
          <Text style={shared.subtitle}>Đang mở cuộc trò chuyện…</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 9,
  },
  titleDot: { color: colors.primary },
  onlineSection: { marginBottom: 22 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  onlineCount: { fontSize: 12, color: colors.muted },
  onlineList: { paddingHorizontal: 24, gap: 18 },
  onlinePerson: { width: 60, alignItems: 'center', gap: 8 },
  onlineName: { fontSize: 12, color: colors.muted },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  filter: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  activeFilter: { backgroundColor: colors.primary },
  filterText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  activeFilterText: { color: colors.white },
  newChat: { marginLeft: 'auto', padding: 8 },
  errorWrap: { paddingHorizontal: 24 },
  list: { flexGrow: 1, paddingBottom: 20 },
  conversation: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 17,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  pressed: { backgroundColor: colors.canvas },
  conversationBody: { flex: 1, gap: 8 },
  name: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    paddingRight: 8,
  },
  unreadName: { fontWeight: '800' },
  time: { fontSize: 11, color: colors.muted },
  unreadTime: { color: colors.primary, fontWeight: '600' },
  previewRow: { gap: 4 },
  preview: { flex: 1, color: colors.muted, fontSize: 13 },
  unreadPreview: { color: colors.ink, fontWeight: '600' },
  count: {
    backgroundColor: colors.primary,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  countText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  opening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    justifyContent: 'center',
  },
});

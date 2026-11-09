import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronRight, UsersRound } from 'lucide-react-native';
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
import { matchesProfile } from '../utils/chat';

export function ContactsScreen() {
  const { user } = useAuth();
  const { users, presence, connected, usersLoading, error, refresh } =
    useChatData();
  const { openChat, openingId } = useOpenChat();
  const [search, setSearch] = useState('');
  const contacts = useMemo(
    () =>
      Object.values(users)
        .filter(
          person => person.uid !== user?.uid && matchesProfile(person, search),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    [users, user?.uid, search],
  );
  return (
    <Screen>
      <ConnectionNotice connected={connected} />
      <View style={styles.header}>
        <View>
          <Text style={shared.title}>Danh bạ</Text>
          <Text style={shared.subtitle}>
            Một người bạn, một câu chuyện mới.
          </Text>
        </View>
        <View style={styles.headerIcon}>
          <UsersRound size={25} color={colors.primary} />
        </View>
      </View>
      <SearchBox
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm tên hoặc email…"
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MỌI NGƯỜI</Text>
        <Text style={shared.subtitle}>{contacts.length} liên hệ</Text>
      </View>
      <View style={styles.error}>
        <ErrorNotice message={error} onRetry={refresh} />
      </View>
      {usersLoading ? (
        <Loading label="Đang tải danh bạ…" />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={item => item.uid}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={UsersRound}
              title={
                search ? 'Không tìm thấy liên hệ' : 'Danh bạ đang đợi bạn bè'
              }
              description={
                search
                  ? 'Thử tìm theo tên hoặc email khác.'
                  : 'Người dùng mới sẽ tự xuất hiện ở đây sau khi đăng ký và hoàn tất hồ sơ.'
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mở chat với ${item.fullName}`}
              disabled={Boolean(openingId)}
              onPress={() => {
                void openChat(item.uid);
              }}
              style={({ pressed }) => [
                styles.contact,
                pressed && styles.pressed,
              ]}
            >
              <Avatar
                name={item.fullName}
                uri={item.avatarUrl}
                online={Boolean(presence[item.uid]?.online)}
              />
              <View style={styles.details}>
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.email} numberOfLines={1}>
                  {item.email}
                </Text>
                <View style={styles.status}>
                  <View
                    style={[
                      styles.dot,
                      presence[item.uid]?.online
                        ? styles.online
                        : styles.offline,
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {presence[item.uid]?.online
                      ? 'Đang hoạt động'
                      : 'Ngoại tuyến'}
                  </Text>
                </View>
              </View>
              {openingId === item.uid ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <ChevronRight size={19} color="#9BAA9F" />
              )}
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  online: { backgroundColor: colors.online },
  offline: { backgroundColor: '#ABB6AE' },
  header: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    backgroundColor: colors.mint,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: colors.muted,
  },
  list: { flexGrow: 1, paddingBottom: 20 },
  error: { paddingHorizontal: 24 },
  contact: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 17,
    alignItems: 'center',
  },
  pressed: { backgroundColor: colors.canvas },
  details: { flex: 1, gap: 5 },
  name: { fontSize: 16, color: colors.ink, fontWeight: '700' },
  email: { fontSize: 12, color: colors.muted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, color: colors.muted },
});

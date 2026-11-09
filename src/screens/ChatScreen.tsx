import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  MapPin,
  MessageCircle,
  Send,
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Avatar,
  ConnectionNotice,
  EmptyState,
  ErrorNotice,
  Loading,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatDataContext';
import { useForeground } from '../hooks/useForeground';
import {
  markMessagesRead,
  sendLocationMessage,
  sendMessage,
} from '../services/chatService';
import { currentLocation } from '../services/locationService';
import { errorMessage } from '../services/errors';
import { clockTime, dayLabel, unreadMessages } from '../utils/chat';
import { colors, shared } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import type { Message } from '../types/models';

export function ChatScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Chat'>) {
  const { chatId, partnerId } = route.params;
  const { user } = useAuth();
  const { users, presence, chats, connected, error, refresh } = useChatData();
  const state = chats[chatId];
  const partner = users[partnerId];
  const focused = useIsFocused();
  const foreground = useForeground();
  const list = useRef<FlatList<Message>>(null);
  const mounted = useRef(true);
  const sendingRef = useRef(false);
  const readsInFlight = useRef(new Set<string>());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [readRetry, setReadRetry] = useState(0);
  const messages = useMemo(
    () => [...(state?.messages ?? [])].reverse(),
    [state?.messages],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () =>
      list.current?.scrollToOffset({ offset: 0, animated: true }),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user || !state?.ready || !focused || !foreground || !connected) {
      return;
    }
    const ids = unreadMessages(state.messages, state.reads, user.uid)
      .map(message => message.id)
      .filter(id => !readsInFlight.current.has(id));
    if (!ids.length) {
      return;
    }
    ids.forEach(id => readsInFlight.current.add(id));
    void markMessagesRead(chatId, user.uid, ids)
      .then(() => {
        if (mounted.current) {
          setReadError(null);
        }
      })
      .catch(failure => {
        if (mounted.current) {
          setReadError(errorMessage(failure));
        }
      })
      .finally(() => {
        ids.forEach(id => readsInFlight.current.delete(id));
      });
  }, [chatId, user, state, focused, foreground, connected, readRetry]);

  const submit = async () => {
    if (
      !user ||
      !draft.trim() ||
      sendingRef.current ||
      !connected ||
      !state?.ready
    ) {
      return;
    }
    const original = draft;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(chatId, user.uid, original);
      if (mounted.current) {
        setDraft(current => (current === original ? '' : current));
      }
    } catch (failure) {
      if (mounted.current) {
        setSendError(errorMessage(failure));
      }
    } finally {
      sendingRef.current = false;
      if (mounted.current) {
        setSending(false);
      }
    }
  };
  const online = Boolean(presence[partnerId]?.online);
  const shareLocation = async () => {
    if (!user || sendingRef.current || !connected || !state?.chat) {
      return;
    }
    sendingRef.current = true;
    setLocating(true);
    setSendError(null);
    Keyboard.dismiss();
    try {
      const location = await currentLocation();
      await sendLocationMessage(chatId, user.uid, location);
    } catch (failure) {
      if (mounted.current) {
        setSendError(errorMessage(failure));
      }
    } finally {
      sendingRef.current = false;
      if (mounted.current) {
        setLocating(false);
      }
    }
  };
  const openLocation = async (location: NonNullable<Message['location']>) => {
    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`,
      );
    } catch {
      if (mounted.current) {
        setSendError(
          'Không mở được bản đồ. Bạn có thể sao chép tọa độ trong tin nhắn.',
        );
      }
    }
  };
  const status = online
    ? 'Đang hoạt động'
    : presence[partnerId]?.lastOnline
    ? `Hoạt động ${clockTime(presence[partnerId].lastOnline!)}`
    : 'Ngoại tuyến';
  const canSend =
    Boolean(draft.trim()) &&
    connected &&
    !sending &&
    !locating &&
    Boolean(state?.ready && state.chat);
  const canShareLocation =
    connected && !sending && !locating && Boolean(state?.ready && state.chat);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={shared.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            testID="chat-back"
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={10}
            onPress={() => navigation.goBack()}
            style={styles.back}
          >
            <ArrowLeft size={23} color={colors.ink} />
          </Pressable>
          <Avatar
            name={partner?.fullName ?? 'Người dùng'}
            uri={partner?.avatarUrl}
            size={43}
            online={online}
          />
          <View style={styles.person}>
            <Text numberOfLines={1} style={styles.personName}>
              {partner?.fullName ?? 'Người dùng'}
            </Text>
            <Text
              testID="chat-status"
              style={[styles.status, online && styles.online]}
            >
              {status}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <MessageCircle size={20} color={colors.primary} />
          </View>
        </View>
        <ConnectionNotice connected={connected} />
        <View style={styles.errors}>
          <ErrorNotice message={error} onRetry={refresh} />
          <ErrorNotice
            message={readError}
            onRetry={() => setReadRetry(value => value + 1)}
          />
        </View>
        {!state?.ready ? (
          error ? (
            <EmptyState
              title="Chưa tải được cuộc trò chuyện"
              description="Kiểm tra kết nối và thử tải lại."
              action="Tải lại"
              onAction={refresh}
            />
          ) : (
            <Loading label="Đang tải cuộc trò chuyện…" />
          )
        ) : !state.chat ? (
          <EmptyState
            title="Cuộc trò chuyện không khả dụng"
            description="Vui lòng quay về danh bạ để mở lại."
          />
        ) : (
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={item => item.id}
            inverted
            style={styles.messageList}
            contentContainerStyle={[
              styles.messageContent,
              !messages.length && styles.emptyList,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() =>
              list.current?.scrollToOffset({ offset: 0, animated: true })
            }
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 120,
            }}
            ListEmptyComponent={
              <View style={styles.invertedEmpty}>
                <EmptyState
                  title={`Chào ${
                    partner?.fullName.split(' ').slice(-1)[0] ?? 'bạn'
                  }!`}
                  description="Một lời chào nhỏ có thể mở đầu một câu chuyện lớn. Gửi tin nhắn đầu tiên nhé."
                />
              </View>
            }
            renderItem={({ item, index }) => {
              const own = item.senderId === user?.uid;
              const older = messages[index + 1];
              const showDay =
                !older ||
                new Date(item.createdAt).toDateString() !==
                  new Date(older.createdAt).toDateString();
              return (
                <View>
                  {showDay && (
                    <View style={styles.day}>
                      <Text style={styles.dayText}>
                        {dayLabel(item.createdAt)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.messageRow, own && styles.ownRow]}>
                    {!own && (
                      <Avatar
                        name={partner?.fullName ?? 'Người dùng'}
                        uri={partner?.avatarUrl}
                        size={28}
                      />
                    )}
                    <View
                      style={[
                        styles.bubble,
                        own ? styles.ownBubble : styles.otherBubble,
                      ]}
                    >
                      {item.location ? (
                        <Pressable
                          testID="message-location"
                          accessibilityRole="button"
                          accessibilityLabel="Mở vị trí được chia sẻ trên bản đồ"
                          onPress={() => {
                            void openLocation(item.location!);
                          }}
                          style={styles.locationCard}
                        >
                          <View style={styles.locationPin}>
                            <MapPin size={25} color={colors.primary} />
                          </View>
                          <Text
                            style={[
                              styles.locationTitle,
                              own && styles.ownText,
                            ]}
                          >
                            Vị trí được chia sẻ
                          </Text>
                          <Text
                            selectable
                            style={[styles.coordinates, own && styles.ownTime]}
                          >
                            {item.location.latitude.toFixed(6)},{' '}
                            {item.location.longitude.toFixed(6)}
                          </Text>
                          <Text style={[styles.mapLink, own && styles.ownTime]}>
                            Chạm để mở bản đồ ↗
                          </Text>
                        </Pressable>
                      ) : (
                        <Text
                          selectable
                          style={[styles.messageText, own && styles.ownText]}
                        >
                          {item.text}
                        </Text>
                      )}
                      <View style={styles.messageFooter}>
                        <Text
                          style={[styles.messageTime, own && styles.ownTime]}
                        >
                          {clockTime(item.createdAt)}
                        </Text>
                        {own && <Check size={12} color="#C5E4D6" />}
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
        <View style={styles.composerArea}>
          <ErrorNotice message={sendError} />
          <View style={styles.composer}>
            <Pressable
              testID="chat-location"
              accessibilityRole="button"
              accessibilityLabel="Gửi vị trí hiện tại"
              accessibilityState={{
                disabled: !canShareLocation,
                busy: locating,
              }}
              disabled={!canShareLocation}
              onPress={() => {
                void shareLocation();
              }}
              style={[
                styles.locationButton,
                !canShareLocation && styles.locationDisabled,
              ]}
            >
              {locating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <MapPin size={23} color={colors.primary} />
              )}
            </Pressable>
            <TextInput
              accessibilityLabel="Nội dung tin nhắn"
              testID="chat-input"
              placeholder={
                connected ? 'Viết một lời nhắn…' : 'Đang kết nối lại…'
              }
              placeholderTextColor="#91A095"
              value={draft}
              onChangeText={setDraft}
              maxLength={4000}
              multiline
              style={styles.draft}
              textAlignVertical="center"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
              testID="chat-send"
              accessibilityState={{ disabled: !canSend, busy: sending }}
              disabled={!canSend}
              onPress={() => {
                void submit();
              }}
              style={[styles.send, !canSend && styles.disabledSend]}
            >
              {sending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Send size={21} color={colors.white} />
              )}
            </Pressable>
          </View>
          {draft.length > 3500 && (
            <Text style={styles.characterCount}>{draft.length}/4.000</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  back: { padding: 4 },
  person: { flex: 1, gap: 5 },
  personName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  status: { fontSize: 11, color: colors.muted },
  online: { color: colors.primary },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errors: { paddingHorizontal: 16 },
  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 16, paddingVertical: 16 },
  emptyList: { flexGrow: 1 },
  invertedEmpty: { transform: [{ scaleY: -1 }] },
  day: {
    alignSelf: 'center',
    marginVertical: 20,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: '#E1EAE0',
  },
  dayText: { fontSize: 10, color: '#7A897C', fontWeight: '600' },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
    paddingRight: 34,
  },
  ownRow: { justifyContent: 'flex-end', paddingRight: 0, paddingLeft: 34 },
  bubble: {
    maxWidth: '87%',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 19,
    minWidth: 70,
  },
  ownBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  otherBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: '#E4EAE1',
  },
  messageText: { fontSize: 15, lineHeight: 23, color: colors.ink },
  ownText: { color: colors.white },
  locationCard: { gap: 7, minWidth: 190, paddingBottom: 4 },
  locationPin: {
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  coordinates: { fontSize: 11, color: colors.muted },
  mapLink: { fontSize: 11, color: colors.primary },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 5,
  },
  messageTime: { fontSize: 10, color: '#8B978E' },
  ownTime: { color: '#C5E4D6' },
  composerArea: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  locationButton: {
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.mint,
  },
  locationDisabled: { opacity: 0.5 },
  draft: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 17,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSend: { backgroundColor: '#9ABAA9' },
  characterCount: {
    textAlign: 'right',
    marginTop: 7,
    fontSize: 10,
    color: colors.muted,
  },
});

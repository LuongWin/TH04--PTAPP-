import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ChevronRight,
  LogOut,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wifi,
} from 'lucide-react-native';
import { Avatar, ErrorNotice, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatDataContext';
import { currentLocation } from '../services/locationService';
import { errorMessage } from '../services/errors';
import { colors, shared } from '../theme';

export function SettingsScreen() {
  const { profile, signOut, presenceError, retryProfile } = useAuth();
  const { connected } = useChatData();
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exit = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };
  const locate = async () => {
    if (locationBusy) {
      return;
    }
    setLocationBusy(true);
    setError(null);
    try {
      setLocation(await currentLocation());
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLocationBusy(false);
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={shared.title}>Cài đặt</Text>
        <Text style={shared.subtitle}>Một chút về bạn và những kết nối.</Text>
        <View style={styles.profileCard}>
          <Avatar
            name={profile?.fullName ?? ''}
            uri={profile?.avatarUrl}
            size={80}
          />
          <Text style={styles.name}>{profile?.fullName}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <View style={styles.status}>
            <View
              style={[
                styles.dot,
                { backgroundColor: connected ? colors.online : colors.muted },
              ]}
            />
            <Text style={styles.statusText}>
              {connected ? 'Đang hoạt động' : 'Đang kết nối lại'}
            </Text>
          </View>
        </View>
        <Text style={styles.sectionLabel}>ỨNG DỤNG CỦA BẠN</Text>
        <View style={styles.card}>
          <View style={styles.item}>
            <View style={styles.icon}>
              <Wifi size={21} color={colors.primary} />
            </View>
            <View style={styles.body}>
              <Text style={styles.itemTitle}>Kết nối</Text>
              <Text style={styles.itemDescription}>
                {connected
                  ? 'Sẵn sàng nhận và gửi tin nhắn'
                  : 'Hãy kiểm tra kết nối mạng'}
              </Text>
            </View>
            <View
              style={[
                styles.dot,
                { backgroundColor: connected ? colors.online : colors.muted },
              ]}
            />
          </View>
          <View style={styles.separator} />
          <View style={styles.item}>
            <View style={styles.icon}>
              <ShieldCheck size={21} color={colors.primary} />
            </View>
            <View style={styles.body}>
              <Text style={styles.itemTitle}>
                Quyền riêng tư cuộc trò chuyện
              </Text>
              <Text style={styles.itemDescription}>
                Chỉ hai thành viên được truy cập tin nhắn.
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.sectionLabel}>TIỆN ÍCH</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kiểm tra vị trí hiện tại"
            disabled={locationBusy}
            onPress={() => {
              void locate();
            }}
            style={styles.item}
          >
            <View style={styles.icon}>
              <MapPin size={21} color={colors.primary} />
            </View>
            <View style={styles.body}>
              <Text style={styles.itemTitle}>Vị trí hiện tại</Text>
              <Text style={styles.itemDescription}>
                {location
                  ? `${location.latitude.toFixed(
                      5,
                    )}, ${location.longitude.toFixed(5)}`
                  : 'Nhấn để kiểm tra vị trí trên thiết bị'}
              </Text>
            </View>
            {locationBusy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <ChevronRight size={18} color={colors.muted} />
            )}
          </Pressable>
          <Text style={styles.privacyNote}>
            Chỉ lấy vị trí khi bạn nhấn. Vị trí không được gửi lên máy chủ.
          </Text>
        </View>
        <ErrorNotice message={presenceError} onRetry={retryProfile} />
        <ErrorNotice message={error} />
        <Pressable
          testID="settings-logout"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            void exit();
          }}
          style={styles.logout}
        >
          {busy ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <LogOut size={20} color={colors.error} />
          )}
          <Text style={styles.logoutText}>
            {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </Text>
        </Pressable>
        <View style={styles.footer}>
          <MessageCircle size={18} color={colors.primary} />
          <Text style={styles.footerBrand}>Chạm.</Text>
          <Text style={styles.version}>
            Phiên bản 1.0 · Gần nhau hơn mỗi ngày
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 36, gap: 7 },
  profileCard: {
    alignItems: 'center',
    padding: 28,
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 25,
    marginTop: 24,
    marginBottom: 22,
  },
  name: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  email: { fontSize: 14, color: colors.muted },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.mint,
    marginTop: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.3,
    color: colors.muted,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  itemDescription: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 66 },
  privacyNote: {
    fontSize: 11,
    lineHeight: 18,
    color: colors.muted,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  logout: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.errorLight,
    marginTop: 20,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.error },
  footer: { alignItems: 'center', paddingTop: 30, gap: 7 },
  footerBrand: { fontSize: 21, color: colors.ink, fontWeight: '800' },
  version: { fontSize: 11, color: colors.muted },
});

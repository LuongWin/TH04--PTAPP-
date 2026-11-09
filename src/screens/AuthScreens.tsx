import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, ErrorNotice, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { completeProfile, login } from '../services/authService';
import { errorMessage } from '../services/errors';
import { colors, shared } from '../theme';
import { validateRegistration } from '../utils/chat';
import type { RootStackParamList } from '../navigation/types';

function AuthLayout({
  children,
  registration = false,
  onBack,
}: React.PropsWithChildren<{ registration?: boolean; onBack?: () => void }>) {
  return (
    <SafeAreaView style={shared.screen}>
      <KeyboardAvoidingView
        style={shared.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quay lại đăng nhập"
                onPress={onBack}
                style={styles.back}
              >
                <ArrowLeft size={22} color={colors.ink} />
              </Pressable>
            ) : (
              <View style={styles.logo}>
                <MessageCircle
                  color={colors.white}
                  size={25}
                  fill={colors.white}
                  fillOpacity={0.15}
                />
              </View>
            )}
            <Text style={styles.brand}>
              Chạm<Text style={styles.brandDot}>.</Text>
            </Text>
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>Kết nối mỗi ngày</Text>
            </View>
          </View>
          <View style={styles.hero}>
            <View style={styles.heroMark}>
              <MessageCircle
                color={colors.primary}
                size={44}
                strokeWidth={1.5}
              />
              <View style={styles.tinyBubble}>
                <Text style={styles.wave}>✦</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>
              {registration
                ? 'Một lời chào,\nmột kết nối mới.'
                : 'Gần nhau hơn,\nqua từng tin nhắn.'}
            </Text>
            <Text style={shared.subtitle}>
              {registration
                ? 'Tạo tài khoản để bắt đầu cuộc trò chuyện của bạn.'
                : 'Đăng nhập và tiếp tục những câu chuyện còn dang dở.'}
            </Text>
          </View>
          {children}
          <View style={styles.footer}>
            <ShieldCheck size={15} color={colors.muted} />
            <Text style={styles.footerText}>
              Trò chuyện riêng tư. Kết nối theo cách của bạn.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function LoginScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current) {
      return;
    }
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <AuthLayout>
      <View style={styles.form}>
        <Field
          label="Email"
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          placeholder="ban@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
          testID="login-email"
        />
        <Field
          label="Mật khẩu"
          icon={LockKeyhole}
          value={password}
          onChangeText={setPassword}
          placeholder="Nhập mật khẩu của bạn"
          secret
          autoComplete="current-password"
          textContentType="password"
          editable={!busy}
          onSubmitEditing={() => {
            void submit();
          }}
          testID="login-password"
        />
        <ErrorNotice message={error} />
        <Button
          title="Đăng nhập"
          onPress={() => {
            void submit();
          }}
          busy={busy}
          testID="login-submit"
        />
        <View style={styles.switchRow}>
          <Text style={shared.subtitle}>Bạn chưa có tài khoản?</Text>
          <Pressable
            testID="register-link"
            disabled={busy}
            onPress={() => navigation.navigate('Register')}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Đăng ký ngay</Text>
          </Pressable>
        </View>
      </View>
    </AuthLayout>
  );
}

export function RegisterScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Register'>) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current) {
      return;
    }
    const validation = validateRegistration(
      name,
      email,
      password,
      confirmation,
    );
    if (validation) {
      setError(validation);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await register(name, email, password);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <AuthLayout registration onBack={() => navigation.goBack()}>
      <View style={styles.form}>
        <Field
          label="Họ và tên"
          testID="register-name"
          icon={UserRound}
          value={name}
          onChangeText={setName}
          placeholder="Mọi người gọi bạn là gì?"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={100}
          editable={!busy}
        />
        <Field
          label="Email"
          testID="register-email"
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          placeholder="ban@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!busy}
        />
        <Field
          label="Mật khẩu"
          testID="register-password"
          icon={LockKeyhole}
          value={password}
          onChangeText={setPassword}
          placeholder="Ít nhất 6 ký tự"
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!busy}
        />
        <Field
          label="Nhập lại mật khẩu"
          testID="register-confirmation"
          icon={LockKeyhole}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="Nhập lại mật khẩu"
          secret
          textContentType="newPassword"
          editable={!busy}
          onSubmitEditing={() => {
            void submit();
          }}
        />
        <ErrorNotice message={error} />
        <Button
          title="Tạo tài khoản"
          testID="register-submit"
          onPress={() => {
            void submit();
          }}
          busy={busy}
        />
        <View style={styles.switchRow}>
          <Text style={shared.subtitle}>Đã có tài khoản?</Text>
          <Pressable
            disabled={busy}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Đăng nhập</Text>
          </Pressable>
        </View>
      </View>
    </AuthLayout>
  );
}

export function CompleteProfileScreen() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!user || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await completeProfile(user, name);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={shared.screen}>
      <View style={[shared.content, styles.recovery]}>
        <View style={styles.logo}>
          <UserRound size={25} color={colors.white} />
        </View>
        <Text style={shared.title}>Bạn muốn được gọi là gì?</Text>
        <Text style={shared.subtitle}>
          Tài khoản {user?.email} đã sẵn sàng. Thêm tên để xuất hiện trong danh
          bạ và bắt đầu trò chuyện.
        </Text>
        <Field
          label="Họ và tên"
          icon={UserRound}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Nhập họ tên của bạn"
          maxLength={100}
        />
        <ErrorNotice message={error} />
        <Button
          title="Hoàn tất hồ sơ"
          onPress={() => {
            void submit();
          }}
          busy={busy}
        />
        <Button
          secondary
          title="Quay về đăng nhập"
          onPress={() => {
            void signOut().catch(failure => setError(errorMessage(failure)));
          }}
          disabled={busy}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 28, paddingTop: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -1,
  },
  brandDot: { color: colors.primary },
  badge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.mint,
  },
  badgeText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  hero: { paddingTop: 36, paddingBottom: 30, gap: 14 },
  heroMark: {
    width: 92,
    height: 80,
    borderRadius: 28,
    backgroundColor: '#E4EFE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    transform: [{ rotate: '-6deg' }],
  },
  tinyBubble: {
    position: 'absolute',
    right: -12,
    bottom: -4,
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#F3DEAB',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
  },
  wave: { fontSize: 25, color: '#996C26' },
  heroTitle: {
    fontSize: 34,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: colors.ink,
  },
  form: { gap: 18 },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  link: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  footer: {
    marginTop: 'auto',
    paddingTop: 35,
    paddingBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: { fontSize: 11, color: colors.muted },
  back: { padding: 10, marginLeft: -10 },
  recovery: { justifyContent: 'center', padding: 28, gap: 20 },
});

import React, { useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  MessageCircle,
  Search,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, shared } from '../theme';
import { initials } from '../utils/chat';

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={shared.screen}>
      <View style={shared.content}>{children}</View>
    </SafeAreaView>
  );
}

export function Avatar({
  name,
  uri,
  size = 52,
  online,
}: {
  name: string;
  uri?: string;
  size?: number;
  online?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const palette = ['#DDEDE2', '#F1E4D7', '#E2E6F5', '#F1DFE5', '#DFECF1'];
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (
    <View style={{ width: size, height: size }}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityLabel={`Ảnh đại diện của ${name}`}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: palette[hash % palette.length],
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.3 }]}>
            {initials(name)}
          </Text>
        </View>
      )}
      {online !== undefined && (
        <View
          accessibilityLabel={online ? 'Đang hoạt động' : 'Ngoại tuyến'}
          style={[styles.onlineDot, online ? styles.online : styles.offline]}
        />
      )}
    </View>
  );
}

export function Button({
  title,
  onPress,
  busy,
  disabled,
  secondary,
  testID,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled, busy }}
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (busy || disabled) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.primary : colors.white} />
      ) : (
        <>
          <Text
            style={[styles.buttonText, secondary && { color: colors.primary }]}
          >
            {title}
          </Text>
          {!secondary && <ArrowRight size={18} color={colors.white} />}
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  icon: Icon,
  secret,
  ...props
}: TextInputProps & { label: string; icon: LucideIcon; secret?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused]}>
        <Icon size={19} color={focused ? colors.primary : colors.muted} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          style={styles.input}
          placeholderTextColor="#97A39B"
          secureTextEntry={secret && !visible}
          autoCapitalize={props.autoCapitalize ?? 'none'}
          onFocus={event => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={event => {
            setFocused(false);
            props.onBlur?.(event);
          }}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onPress={() => setVisible(!visible)}
            hitSlop={10}
          >
            {visible ? (
              <EyeOff size={20} color={colors.muted} />
            ) : (
              <Eye size={20} color={colors.muted} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Search size={19} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
      />
      {Boolean(value) && (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Xóa tìm kiếm"
          hitSlop={10}
        >
          <X size={17} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry?: () => void;
}) {
  if (!message) {
    return null;
  }
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={styles.error}
    >
      <AlertCircle size={18} color={colors.error} />
      <View style={styles.grow}>
        <Text style={styles.errorText}>{message}</Text>
        {onRetry && (
          <Pressable accessibilityRole="button" onPress={onRetry}>
            <Text style={styles.retry}>Thử lại</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ConnectionNotice({ connected }: { connected: boolean }) {
  if (connected) {
    return null;
  }
  return (
    <View style={styles.connection}>
      <WifiOff size={15} color={colors.amber} />
      <Text style={styles.connectionText}>
        Đang kết nối… Tin nhắn sẽ cập nhật khi có mạng.
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
  onAction,
  icon: Icon = MessageCircle,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={32} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action && onAction && (
        <Button secondary title={action} onPress={onAction} />
      )}
    </View>
  );
}

export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={shared.subtitle}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  online: { backgroundColor: colors.online },
  offline: { backgroundColor: '#ACB6AF' },
  grow: { flex: 1 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '700', color: colors.primaryDark },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.background,
  },
  button: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  secondaryButton: { backgroundColor: colors.mint },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.white },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  inputWrap: {
    minHeight: 54,
    paddingHorizontal: 15,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFocused: { borderColor: colors.primary },
  input: { flex: 1, color: colors.ink, fontSize: 15, paddingVertical: 12 },
  searchBox: {
    minHeight: 50,
    marginHorizontal: 24,
    marginBottom: 20,
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF0E9',
    borderRadius: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
    color: colors.ink,
  },
  error: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.errorLight,
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
  },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 20 },
  retry: { color: colors.error, fontWeight: '700', marginTop: 8 },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF5E3',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  connectionText: {
    flex: 1,
    fontSize: 12,
    color: colors.amber,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    padding: 32,
    gap: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 21,
    color: colors.ink,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 8,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 24,
  },
});

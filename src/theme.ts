import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#006D5B',
  primaryDark: '#004D41',
  ink: '#142F2A',
  muted: '#73817B',
  background: '#F6F8F4',
  white: '#FFFFFF',
  border: '#E1E8E1',
  mint: '#DDF2E4',
  canvas: '#EDF3ED',
  online: '#22A776',
  error: '#AC403A',
  errorLight: '#FFF0EC',
  amber: '#95652A',
};
export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', flex: 1 },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -1,
  },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

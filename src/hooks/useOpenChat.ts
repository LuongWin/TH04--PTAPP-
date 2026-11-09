import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatDataContext';
import { ensureChat } from '../services/chatService';
import { errorMessage } from '../services/errors';
import type { RootStackParamList } from '../navigation/types';

export function useOpenChat() {
  const { user } = useAuth();
  const { connected } = useChatData();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const openChat = async (partnerId: string, existingChatId?: string) => {
    if (!user || busy.current) {
      return;
    }
    if (existingChatId) {
      navigation.navigate('Chat', { chatId: existingChatId, partnerId });
      return;
    }
    if (!connected) {
      Alert.alert(
        'Chưa có kết nối',
        'Hãy kết nối mạng để bắt đầu cuộc trò chuyện mới.',
      );
      return;
    }
    busy.current = true;
    setOpeningId(partnerId);
    try {
      const chatId = await ensureChat(user.uid, partnerId);
      if (mounted.current) {
        navigation.navigate('Chat', { chatId, partnerId });
      }
    } catch (failure) {
      if (mounted.current) {
        Alert.alert('Chưa mở được cuộc trò chuyện', errorMessage(failure));
      }
    } finally {
      busy.current = false;
      if (mounted.current) {
        setOpeningId(null);
      }
    }
  };
  return { openChat, openingId };
}

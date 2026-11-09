global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  SafeAreaProvider: require('react-native').View,
}));
jest.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      {
        get: (_target, property) =>
          property === '__esModule' ? true : 'MockIcon',
      },
    ),
);

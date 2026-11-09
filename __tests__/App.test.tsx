import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { LoginScreen, RegisterScreen } from '../src/screens/AuthScreens';
import { login } from '../src/services/authService';
import { useAuth } from '../src/context/AuthContext';
import { Button, Field } from '../src/components/ui';

jest.mock('../src/services/authService', () => ({
  login: jest.fn(),
  completeProfile: jest.fn(),
}));
jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const register = jest.fn();
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ register });
});
afterEach(async () => {
  if (renderer) {
    await act(() => renderer.unmount());
  }
});

test('login validates required fields without making a request', async () => {
  await act(() => {
    renderer = TestRenderer.create(
      <LoginScreen
        navigation={navigation as never}
        route={{ key: 'Login', name: 'Login' }}
      />,
    );
  });
  await act(async () => {
    await renderer.root.findByType(Button).props.onPress();
  });
  expect(login).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Vui lòng nhập email và mật khẩu.',
  );
});

test('incorrect credentials show a Vietnamese error and allow another attempt', async () => {
  (login as jest.Mock).mockRejectedValueOnce({
    code: 'auth/invalid-credential',
  });
  await act(() => {
    renderer = TestRenderer.create(
      <LoginScreen
        navigation={navigation as never}
        route={{ key: 'Login', name: 'Login' }}
      />,
    );
  });
  await act(() => {
    const fields = renderer.root.findAllByType(Field);
    fields[0].props.onChangeText('alice@example.com');
    fields[1].props.onChangeText('wrong-password');
  });
  await act(async () => {
    await renderer.root.findByType(Button).props.onPress();
  });
  expect(login).toHaveBeenCalledWith('alice@example.com', 'wrong-password');
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Email hoặc mật khẩu chưa đúng.',
  );
  expect(renderer.root.findByType(Button).props.busy).toBe(false);
});

test('registration refuses mismatching confirmation before creating an account', async () => {
  await act(() => {
    renderer = TestRenderer.create(
      <RegisterScreen
        navigation={navigation as never}
        route={{ key: 'Register', name: 'Register' }}
      />,
    );
  });
  await act(() => {
    const fields = renderer.root.findAllByType(Field);
    ['Alice', 'alice@example.com', '123456', 'different'].forEach(
      (value, index) => fields[index].props.onChangeText(value),
    );
  });
  await act(async () => {
    await renderer.root.findByType(Button).props.onPress();
  });
  expect(register).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Mật khẩu nhập lại chưa khớp.',
  );
});

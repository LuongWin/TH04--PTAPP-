export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
    'auth/invalid-credential': 'Email hoặc mật khẩu chưa đúng.',
    'auth/invalid-login-credentials': 'Email hoặc mật khẩu chưa đúng.',
    'auth/wrong-password': 'Email hoặc mật khẩu chưa đúng.',
    'auth/user-not-found': 'Email hoặc mật khẩu chưa đúng.',
    'auth/email-already-in-use': 'Email này đã được đăng ký. Hãy đăng nhập.',
    'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
    'auth/too-many-requests':
      'Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.',
    'auth/network-request-failed':
      'Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.',
    'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa.',
    'auth/operation-not-allowed':
      'Phương thức Email/Password chưa được bật cho dự án.',
    PERMISSION_DENIED:
      'Bạn không có quyền truy cập dữ liệu này. Vui lòng thử đăng nhập lại.',
    permission_denied:
      'Bạn không có quyền truy cập dữ liệu này. Vui lòng thử đăng nhập lại.',
  };
  return (
    messages[code] ??
    (error instanceof Error
      ? error.message
      : 'Có lỗi xảy ra. Vui lòng thử lại.')
  );
}

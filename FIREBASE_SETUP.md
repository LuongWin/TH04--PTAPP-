# Firebase — Bài thực hành 5

Đã thiết lập ngày 09/11/2026 trên Firebase Console.

## Dự án và dịch vụ

- Tên: **ChatFirebase**.
- Project ID: `chatfirebase-9600c`.
- [Firebase Console](https://console.firebase.google.com/project/chatfirebase-9600c/overview).
- Gói Spark; chưa liên kết billing.
- Google Analytics và Gemini không bật ở bước tạo project.
- Ứng dụng JavaScript đã đăng ký: **ChatFirebase React Native**.
- Authentication: **Email/Password Enabled**; đăng nhập bằng email link không bật.
- Realtime Database: `chatfirebase-9600c-default-rtdb`, vùng Singapore (`asia-southeast1`).
- Database URL: `https://chatfirebase-9600c-default-rtdb.asia-southeast1.firebasedatabase.app`.
- Đã xuất bản luật trong `database.rules.json`; không dùng luật test mở toàn bộ database.

## Tệp cấu hình

- `src/services/firebaseConfig.json`: cấu hình client lấy từ Console, đã thêm Database URL.
- `database.rules.json`: bản luật đã xuất bản trên Console.
- `firebase.json`: trỏ tới tệp luật cho Firebase CLI.
- `.firebaserc`: chọn đúng project mặc định.

Đã cài Firebase JS SDK và triển khai ứng dụng React Native. Cấu hình được dùng tại `src/services/firebase.ts`; tài khoản/hồ sơ, chat, vị trí và presence có service riêng trong cùng thư mục. Đã tạo hai tài khoản QA riêng để kiểm thử hai giả lập qua Firebase thật; thông tin đăng nhập chỉ lưu trong `.artifacts/` và không nằm trong bài nộp.

## Cấu trúc dữ liệu của ứng dụng

| Đường dẫn                                   | Dữ liệu                                                | Quyền                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                               | `fullName`, `email`, `createdAt`, `avatarUrl` tùy chọn | Đã đăng nhập được đọc danh bạ; chỉ chủ hồ sơ được ghi. Email phải trùng token đăng nhập.                  |
| `presence/{uid}/connections/{connectionId}` | `true` khi kết nối còn hoạt động                       | Chỉ chủ tài khoản được ghi/xóa kết nối; người đã đăng nhập được đọc.                                      |
| `presence/{uid}/lastOnline`                 | Timestamp server                                       | Chỉ chủ tài khoản được ghi.                                                                               |
| `chats/{chatId}`                            | `memberA`, `memberB`, `createdAt`                      | Đúng hai UID khác nhau, đã có hồ sơ; người tạo phải là một trong hai; metadata không sửa/xóa sau khi tạo. |
| `messages/{chatId}/{messageId}`             | `senderId`, `text`, `createdAt`                        | Chỉ hai thành viên được đọc và thêm tin; không giả UID gửi, sửa hoặc xóa tin đã gửi.                      |
| `userChats/{uid}/{chatId}`                  | `true`                                                 | Chủ tài khoản đọc danh sách của mình; thành viên chỉ thêm chỉ mục cho hai thành viên thật của chat.       |
| `messageReads/{chatId}/{uid}/{messageId}`   | `true`                                                 | Chỉ chủ UID đọc/ghi dấu đã đọc của mình, trong chat mà mình là thành viên; tin phải tồn tại.              |

Thứ tự ghi: tạo hồ sơ trước; tạo metadata chat trước; sau khi metadata tồn tại mới thêm chỉ mục `userChats` cho hai UID bằng một multi-path update. Các kiểm tra thành viên dùng `root`, tức dữ liệu đã có trước lần ghi.

Service chat dùng một `chatId` xác định ổn định từ hai UID đã sắp xếp, mã hóa và có tiền tố độ dài để hai phía mở cùng cuộc trò chuyện. Dùng `serverTimestamp()` cho `createdAt`; luật yêu cầu thời gian server khi tạo hồ sơ/chat/tin. Không lưu mật khẩu trong Realtime Database.

Home nghe chỉ mục của chính tài khoản, nghe tin của từng chat để lấy tin cuối và đếm tin người kia gửi chưa có dấu `messageReads`. Khi chat đang được xem và ứng dụng ở foreground, đánh dấu những message ID đã tải; cách này không làm mất tin chưa đọc nếu tin mới tới đồng thời. Thiết kế phù hợp bài thực hành với dữ liệu nhỏ; chưa có bộ đếm/summary do backend duy trì.

Tin nhắn dài tối đa 4.000 ký tự, phải có ký tự khác khoảng trắng. Tin vị trí có thêm `location: { latitude, longitude }`; luật buộc đủ hai trường kiểu số, latitude trong [-90, 90], longitude trong [-180, 180], từ chối trường lạ. Tin thường cũ vẫn hợp lệ. Hai loại tin dùng cùng quyền thành viên và dấu đã đọc. Vị trí chỉ gửi khi nhấn nút gửi vị trí trong Chat; thao tác kiểm tra vị trí ở Cài đặt không ghi database.

Các trường dữ liệu ngoài schema bị từ chối. Không đọc toàn bộ gốc database hoặc toàn bộ `chats`/`messages`; đọc theo đường dẫn được cấp quyền.

## Kiểm tra đã thực hiện

Luật được Firebase biên dịch/chấp nhận khi mô phỏng và xuất bản thành công. Rules Playground dùng UID giả `rules-test-alice`, không tạo user thật:

1. Chưa đăng nhập đọc `/users`: **Denied**.
2. Đã đăng nhập đọc `/users`: **Allowed**.
3. Đã đăng nhập đọc `/messages/another-chat` khi không có quyền thành viên: **Denied**.
4. Alice ghi `/presence/rules-test-alice` với kết nối hợp lệ: **Allowed**.
5. Alice ghi `/presence/rules-test-bob`: **Denied**.

Đã chạy **40 kiểm thử tích hợp** trên Firebase Auth + Database Emulator, project cục bộ `demo-chatfirebase`: tạo hồ sơ đúng/sai quyền, email giả mạo, thời gian tạo bất biến, tạo chat, chỉ mục hai phía, quyền thành viên, tin nhiều dòng, tin rỗng, giả người gửi, sửa/xóa tin, dấu đã đọc đồng thời với tin mới, presence, listener realtime, đăng ký/đăng nhập/đăng xuất Email/Password; tin vị trí hợp lệ và các trường hợp tọa độ sai kiểu/thiếu/ngoài khoảng/trường lạ.

Trong lần kiểm thử này đã thay biểu thức regex kiểm tra khoảng trắng bằng `String.replace()` tương thích với Database Emulator, rồi cập nhật lại luật trên Console. Quyền thành viên và schema không thay đổi. Script: `scripts/test-firebase.cjs`; lệnh: `npm run test:firebase` (cài công cụ theo README).

APK Android debug/release đã build thành công. Đã chạy kịch bản phối hợp hai Android Emulator trên Firebase thật: gửi nhận tin hai chiều, số chưa đọc, trạng thái online/offline, tìm kiếm, mở lại chat không lặp tin và đăng xuất/đăng nhập. Ảnh Firebase Console tab Data trong bộ nộp bài cho thấy nội dung tin, người gửi, thời gian và tọa độ. iOS chưa kiểm thử.

Tham khảo: [Cú pháp luật Realtime Database](https://firebase.google.com/docs/database/security/core-syntax), [Điều kiện truy cập và xác thực dữ liệu](https://firebase.google.com/docs/database/security/rules-conditions), [Presence và onDisconnect](https://firebase.google.com/docs/database/web/offline-capabilities).

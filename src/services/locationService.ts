import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export async function currentLocation(): Promise<{
  latitude: number;
  longitude: number;
}> {
  let precise = Platform.OS === 'ios';
  if (Platform.OS === 'android') {
    const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    precise =
      permissions['android.permission.ACCESS_FINE_LOCATION'] ===
      PermissionsAndroid.RESULTS.GRANTED;
    if (
      permissions['android.permission.ACCESS_FINE_LOCATION'] !==
        PermissionsAndroid.RESULTS.GRANTED &&
      permissions['android.permission.ACCESS_COARSE_LOCATION'] !==
        PermissionsAndroid.RESULTS.GRANTED
    ) {
      throw new Error(
        'Chưa được cấp quyền vị trí. Bạn có thể cấp quyền trong cài đặt của thiết bị.',
      );
    }
  }
  Geolocation.setRNConfiguration({
    skipPermissionRequests: Platform.OS === 'android',
    authorizationLevel: 'whenInUse',
    locationProvider: 'android',
  });
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      error => {
        reject(
          new Error(
            error.code === 1
              ? 'Chưa được cấp quyền truy cập vị trí.'
              : error.code === 2
              ? 'Không lấy được vị trí. Hãy kiểm tra GPS của thiết bị.'
              : 'Lấy vị trí quá thời gian. Hãy thử lại.',
          ),
        );
      },
      { enableHighAccuracy: precise, timeout: 15000, maximumAge: 10000 },
    ),
  );
}

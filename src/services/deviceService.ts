import { PermissionsAndroid, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from 'react-native-geolocation-service';
import BackgroundService from 'react-native-background-actions';
import { apiDeviceHeartbeat, apiRegisterDevice } from '../api/client';
import { deviceStore } from '../stores/deviceStore';

const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time));
const TRACKING_INTERVAL_MS = 10000;

async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const permissions = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  if (Platform.Version >= 29) {
    permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
  }

  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(result).some((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  const hasPermission = await ensureLocationPermission();
  if (!hasPermission) return null;

  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  });
}

async function collectDeviceStatus() {
  const [batteryLevel, powerState, carrier, totalMem, usedMem, totalDisk, freeDisk, netInfo] =
    await Promise.all([
      DeviceInfo.getBatteryLevel(),
      DeviceInfo.getPowerState(),
      DeviceInfo.getCarrier(),
      DeviceInfo.getTotalMemory(),
      DeviceInfo.getUsedMemory(),
      DeviceInfo.getTotalDiskCapacity(),
      DeviceInfo.getFreeDiskStorage(),
      NetInfo.fetch(),
    ]);

  const batteryTemp: number | undefined = undefined;

  const location = await getCurrentLocation();
  const batteryPercent = Math.round((batteryLevel || 0) * 100);

  let networkType = netInfo.type?.toUpperCase() || 'UNKNOWN';
  if (netInfo.type === 'cellular' && netInfo.details && 'cellularGeneration' in netInfo.details) {
    const gen = (netInfo.details as any).cellularGeneration;
    networkType = gen ? String(gen).toUpperCase() : 'CELLULAR';
  }

  const batteryStatus = powerState?.batteryState || 'unknown';
  const chargingType = batteryStatus === 'charging' || batteryStatus === 'full' ? 'Charging' : 'Not Charging';

  return {
    latitude: location?.latitude,
    longitude: location?.longitude,
    battery_level: batteryPercent,
    battery_status: batteryStatus,
    charging_type: chargingType,
    battery_temp: batteryTemp,
    network_type: networkType,
    carrier: carrier || 'Unknown',
    ram_used: usedMem,
    ram_total: totalMem,
    storage_used: totalDisk && freeDisk ? totalDisk - freeDisk : undefined,
    storage_total: totalDisk,
  };
}

export async function registerDevice() {
  const deviceId = await DeviceInfo.getUniqueId();
  const deviceName = await DeviceInfo.getDeviceName();
  const model = DeviceInfo.getModel();
  const osVersion = DeviceInfo.getSystemVersion();
  const storedToken = await deviceStore.getDeviceToken();

  const result = await apiRegisterDevice({
    device_id: deviceId,
    device_name: deviceName,
    device_token: storedToken || undefined,
    platform: Platform.OS,
    model,
    os_version: osVersion,
  });

  await deviceStore.setDeviceId(result.device_id);
  await deviceStore.setDeviceToken(result.device_token);

  return result;
}

export async function sendHeartbeat() {
  let deviceId = await deviceStore.getDeviceId();
  let deviceToken = await deviceStore.getDeviceToken();
  if (!deviceId || !deviceToken) {
    const reg = await registerDevice();
    deviceId = reg.device_id;
    deviceToken = reg.device_token;
  }

  const status = await collectDeviceStatus();
  return apiDeviceHeartbeat({
    device_id: deviceId,
    device_token: deviceToken,
    ...status,
  });
}

const trackingOptions = {
  taskName: 'SciG Tracking',
  taskTitle: 'SciG Mode Tracking Aktif',
  taskDesc: 'Mengirim lokasi & status perangkat tiap 10 detik',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#3b82f6',
  parameters: {},
};

const trackingTask = async () => {
  while (BackgroundService.isRunning()) {
    try {
      await sendHeartbeat();
    } catch {
      // ignore errors to keep service running
    }
    await sleep(TRACKING_INTERVAL_MS);
  }
};

export async function startTracking() {
  const hasPermission = await ensureLocationPermission();
  if (!hasPermission) {
    throw new Error('Izin lokasi ditolak');
  }
  if (!BackgroundService.isRunning()) {
    await BackgroundService.start(trackingTask, trackingOptions);
  }
  await deviceStore.setTrackingEnabled(true);
}

export async function stopTracking() {
  if (BackgroundService.isRunning()) {
    await BackgroundService.stop();
  }
  await deviceStore.setTrackingEnabled(false);
}

export async function isTrackingRunning(): Promise<boolean> {
  return BackgroundService.isRunning();
}

import { Linking, PermissionsAndroid, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from 'react-native-geolocation-service';
import BackgroundService from 'react-native-background-actions';
import { apiDeviceHeartbeat, apiRegisterDevice } from '../api/client';
import { deviceStore } from '../stores/deviceStore';

const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time));
export const TRACKING_INTERVAL_MS = 10000;
let trackingStartPromise: Promise<void> | null = null;

type AndroidPermission = Parameters<typeof PermissionsAndroid.check>[0];

const FINE_LOCATION: AndroidPermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE_LOCATION: AndroidPermission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const BACKGROUND_LOCATION: AndroidPermission = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
const POST_NOTIFICATIONS: AndroidPermission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;

export interface TrackingPermissionSummary {
  ready: boolean;
  missing: string[];
  needsSettings: boolean;
  locationGranted: boolean;
  backgroundGranted: boolean;
  notificationsGranted: boolean;
}

function isAndroidPermissionRequired(permission: AndroidPermission): boolean {
  if (permission === BACKGROUND_LOCATION) {
    return Platform.OS === 'android' && Platform.Version >= 29;
  }
  if (permission === POST_NOTIFICATIONS) {
    return Platform.OS === 'android' && Platform.Version >= 33;
  }
  return Platform.OS === 'android';
}

function buildPermissionSummary(params: {
  locationGranted: boolean;
  backgroundGranted: boolean;
  notificationsGranted: boolean;
  needsSettings?: boolean;
}): TrackingPermissionSummary {
  const missing: string[] = [];
  if (!params.locationGranted) {
    missing.push('Lokasi perangkat');
  }
  if (!params.backgroundGranted) {
    missing.push('Lokasi latar belakang');
  }
  if (!params.notificationsGranted) {
    missing.push('Notifikasi foreground service');
  }
  return {
    ready: missing.length === 0,
    missing,
    needsSettings: params.needsSettings || false,
    locationGranted: params.locationGranted,
    backgroundGranted: params.backgroundGranted,
    notificationsGranted: params.notificationsGranted,
  };
}

async function checkAndroidPermission(permission: AndroidPermission): Promise<boolean> {
  if (!isAndroidPermissionRequired(permission)) return true;
  return PermissionsAndroid.check(permission);
}

export async function getTrackingPermissionSummary(): Promise<TrackingPermissionSummary> {
  if (Platform.OS !== 'android') {
    return buildPermissionSummary({
      locationGranted: true,
      backgroundGranted: true,
      notificationsGranted: true,
    });
  }

  const fineGranted = await checkAndroidPermission(FINE_LOCATION);
  const coarseGranted = await checkAndroidPermission(COARSE_LOCATION);
  const backgroundGranted = await checkAndroidPermission(BACKGROUND_LOCATION);
  const notificationsGranted = await checkAndroidPermission(POST_NOTIFICATIONS);

  return buildPermissionSummary({
    locationGranted: fineGranted || coarseGranted,
    backgroundGranted,
    notificationsGranted,
  });
}

function buildPermissionError(summary: TrackingPermissionSummary): string {
  if (summary.ready) {
    return '';
  }
  return `Izin wajib belum lengkap: ${summary.missing.join(', ')}.`;
}

export async function requestTrackingPermissions(): Promise<TrackingPermissionSummary> {
  if (Platform.OS !== 'android') {
    return getTrackingPermissionSummary();
  }

  let needsSettings = false;

  const locationResults = await PermissionsAndroid.requestMultiple([FINE_LOCATION, COARSE_LOCATION]);
  const locationGranted =
    locationResults[FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ||
    locationResults[COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

  if (
    locationResults[FINE_LOCATION] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
    locationResults[COARSE_LOCATION] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
  ) {
    needsSettings = true;
  }

  if (Platform.Version >= 33) {
    const notificationResult = await PermissionsAndroid.request(POST_NOTIFICATIONS);
    if (notificationResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      needsSettings = true;
    }
  }

  if (Platform.Version >= 29 && locationGranted) {
    const backgroundAlreadyGranted = await PermissionsAndroid.check(BACKGROUND_LOCATION);
    if (!backgroundAlreadyGranted) {
      const backgroundResult = await PermissionsAndroid.request(BACKGROUND_LOCATION);
      if (
        backgroundResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        (Platform.Version >= 30 && backgroundResult !== PermissionsAndroid.RESULTS.GRANTED)
      ) {
        needsSettings = true;
      }
    }
  }

  const summary = await getTrackingPermissionSummary();
  return {
    ...summary,
    needsSettings: needsSettings || summary.needsSettings,
  };
}

export async function openAppSettings() {
  await Linking.openSettings();
}

async function safeCall<T>(factory: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await factory();
  } catch {
    return fallback;
  }
}

async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  const summary = await getTrackingPermissionSummary();
  if (!summary.locationGranted) return null;

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
      safeCall(() => DeviceInfo.getBatteryLevel(), 0),
      safeCall(() => DeviceInfo.getPowerState(), null),
      safeCall(() => DeviceInfo.getCarrier(), ''),
      safeCall(() => DeviceInfo.getTotalMemory(), 0),
      safeCall(() => DeviceInfo.getUsedMemory(), 0),
      safeCall(() => DeviceInfo.getTotalDiskCapacity(), 0),
      safeCall(() => DeviceInfo.getFreeDiskStorage(), 0),
      safeCall(() => NetInfo.fetch(), null as any),
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
  const deviceName = await safeCall(() => DeviceInfo.getDeviceName(), 'SciG Device');
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

export async function startTracking(options: { skipPermissionCheck?: boolean } = {}) {
  if (trackingStartPromise) {
    return trackingStartPromise;
  }

  trackingStartPromise = (async () => {
    if (!options.skipPermissionCheck) {
      const summary = await requestTrackingPermissions();
      if (!summary.ready) {
        throw new Error(buildPermissionError(summary));
      }
    }

    try {
      if (!BackgroundService.isRunning()) {
        await BackgroundService.start(trackingTask, trackingOptions);
      }
    } catch {
      throw new Error(
        'Tracking latar belakang belum bisa dinyalakan. Pastikan izin lokasi, notifikasi, dan baterai tidak dibatasi.',
      );
    }

    await deviceStore.setTrackingEnabled(true);
    try {
      await sendHeartbeat();
    } catch {
      // keep service running even if first sync fails
    }
  })();

  try {
    await trackingStartPromise;
  } finally {
    trackingStartPromise = null;
  }
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

export async function bootstrapTrackingAfterLogin(): Promise<TrackingPermissionSummary> {
  const summary = await requestTrackingPermissions();
  if (!summary.ready) {
    return summary;
  }

  await registerDevice();
  await deviceStore.setTrackingEnabled(true);
  try {
    await sendHeartbeat();
  } catch {
    // allow app to continue even if backend has not replied yet
  }
  return summary;
}

export async function resumeTrackingIfEnabled() {
  const enabled = await deviceStore.isTrackingEnabled();
  if (!enabled) {
    return false;
  }

  const summary = await getTrackingPermissionSummary();
  if (!summary.ready) {
    return false;
  }

  await startTracking({ skipPermissionCheck: true });
  return true;
}

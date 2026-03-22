const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '10.0.2.2',
  '10.0.3.2',
  '::1',
]);

export const SERVER_URL_PLACEHOLDER = 'https://api.your-domain.example';

function isPrivateIpv4(hostname: string): boolean {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return (
    LOCAL_HOSTS.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.lan') ||
    host.endsWith('.internal')
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
}

function isLocalOrLanHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return isLocalHostname(host) || isPrivateIpv4(host) || isPrivateIpv6(host);
}

export function validateServerUrl(input: string): string {
  const raw = (input || '').trim();
  if (!raw) {
    throw new Error('Server URL wajib diisi.');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Server URL tidak valid. Gunakan format http:// atau https://');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error('Server URL harus memakai http:// atau https://');
  }

  if (!parsed.hostname) {
    throw new Error('Hostname server tidak valid.');
  }

  if (protocol === 'http:' && !isLocalOrLanHost(parsed.hostname)) {
    throw new Error('HTTP hanya boleh untuk localhost/LAN. Untuk VPS atau production wajib HTTPS.');
  }

  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

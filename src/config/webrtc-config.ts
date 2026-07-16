import { TURN_CREDENTIAL, TURN_SERVER_URLS, TURN_USERNAME } from './constants.js';

export const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302'
];

export const TURN_SERVERS = (() => {
  const urls = TURN_SERVER_URLS
    .split(/[;,\s]+/)
    .map(url => url.trim())
    .filter(url => /^turns?:/i.test(url));

  if (urls.length > 0 && TURN_USERNAME && TURN_CREDENTIAL) {
    return [{
      urls: urls.length === 1 ? urls[0] : urls,
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL
    }];
  }
  return [];
})();

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export function getIceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = STUN_SERVERS.map(url => ({ urls: url }));
  servers.push(...TURN_SERVERS);
  return servers;
}

export function hasTurnServers(): boolean {
  return TURN_SERVERS.length > 0;
}

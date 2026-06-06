export const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302'
];

export const TURN_SERVERS = (() => {
  const urls = process.env.TURN_SERVER_URLS || '';
  const username = process.env.TURN_USERNAME || '';
  const credential = process.env.TURN_CREDENTIAL || '';
  if (urls && username && credential) {
    return [{ urls, username, credential }];
  }
  return [];
})();

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: string;
}

export function getIceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = STUN_SERVERS.map(url => ({ urls: url }));
  servers.push(...TURN_SERVERS);
  return servers;
}

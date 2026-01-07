/**
 * Peer Simulator - Generates realistic BitTorrent peer data
 * Used for load testing the tracker
 */

import { randomBytes } from 'crypto';

// Client prefixes for realistic peer IDs
const CLIENT_PREFIXES = [
  '-UT3500-', // uTorrent
  '-DE13D0-', // Deluge
  '-TR2940-', // Transmission
  '-qB4500-', // qBittorrent
  '-lt0F10-', // libtorrent
  '-AZ5760-', // Azureus/Vuze
];

/**
 * Generate a random 20-byte info hash (40 hex chars)
 */
export function generateInfoHash(): string {
  return randomBytes(20).toString('hex');
}

/**
 * Generate a realistic peer ID (20 bytes = 40 hex chars)
 */
export function generatePeerId(): string {
  const prefix = CLIENT_PREFIXES[Math.floor(Math.random() * CLIENT_PREFIXES.length)];
  const suffix = randomBytes(12).toString('hex');
  return Buffer.from(prefix + suffix.slice(0, 12)).toString('hex');
}

/**
 * Generate a random passkey (64 hex chars)
 */
export function generatePasskey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a random port (typical BitTorrent range)
 */
export function generatePort(): number {
  return 6881 + Math.floor(Math.random() * 1000);
}

/**
 * Generate a random IP (for testing, uses local ranges)
 */
export function generateIP(): string {
  return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export interface SimulatedPeer {
  infoHash: string;
  peerId: string;
  passkey: string;
  ip: string;
  port: number;
  uploaded: number;
  downloaded: number;
  left: number;
  isSeeder: boolean;
}

/**
 * Create a simulated peer for a given torrent
 */
export function createPeer(infoHash: string, passkey: string, isSeeder = false): SimulatedPeer {
  const fileSize = 1000000000; // 1GB simulated torrent
  
  return {
    infoHash,
    peerId: generatePeerId(),
    passkey,
    ip: generateIP(),
    port: generatePort(),
    uploaded: isSeeder ? Math.floor(Math.random() * fileSize) : 0,
    downloaded: isSeeder ? fileSize : Math.floor(Math.random() * fileSize),
    left: isSeeder ? 0 : Math.floor(Math.random() * fileSize),
    isSeeder,
  };
}

/**
 * Generate a swarm with seeders and leechers
 */
export function generateSwarm(
  infoHash: string,
  passkey: string,
  seeders: number,
  leechers: number
): SimulatedPeer[] {
  const peers: SimulatedPeer[] = [];
  
  for (let i = 0; i < seeders; i++) {
    peers.push(createPeer(infoHash, passkey, true));
  }
  
  for (let i = 0; i < leechers; i++) {
    peers.push(createPeer(infoHash, passkey, false));
  }
  
  return peers;
}

export type AnnounceEvent = 'started' | 'stopped' | 'completed' | '';

/**
 * Build announce URL query string
 */
export function buildAnnounceQuery(peer: SimulatedPeer, event: AnnounceEvent = ''): string {
  const params = new URLSearchParams();
  
  // URL-encode info_hash and peer_id as binary (required by BT spec)
  // For simplicity in HTTP testing, we use hex representation
  params.set('info_hash', peer.infoHash);
  params.set('peer_id', peer.peerId);
  params.set('passkey', peer.passkey);
  params.set('port', peer.port.toString());
  params.set('uploaded', peer.uploaded.toString());
  params.set('downloaded', peer.downloaded.toString());
  params.set('left', peer.left.toString());
  params.set('compact', '1');
  params.set('numwant', '50');
  
  if (event) {
    params.set('event', event);
  }
  
  return params.toString();
}

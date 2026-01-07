declare module 'bittorrent-tracker' {
  import { EventEmitter } from 'events';
  import { Server as HttpServer } from 'http';
  import { Socket as DgramSocket } from 'dgram';
  import { Server as WsServer } from 'ws';

  interface ServerOptions {
    http?: boolean;
    udp?: boolean;
    ws?: boolean;
    stats?: boolean;
    trustProxy?: boolean;
    filter?: (
      infoHash: string,
      params: unknown,
      cb: (err: Error | null) => void
    ) => void;
  }

  interface TrackerServer {
    http?: HttpServer;
    udp?: DgramSocket;
    ws?: WsServer;
    torrents: Record<string, unknown>;
    on(event: 'start', listener: (addr: string, params: any) => void): this;
    on(event: 'stop', listener: (addr: string, params: any) => void): this;
    on(event: 'complete', listener: (addr: string, params: any) => void): this;
    on(event: 'update', listener: (addr: string, params: any) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    close(callback?: () => void): void;
    getSwarm(infoHash: string | Buffer): any;
  }

  export class Server extends EventEmitter implements TrackerServer {
    constructor(options?: ServerOptions);
    http?: HttpServer;
    udp?: DgramSocket;
    ws?: WsServer;
    torrents: Record<string, unknown>;
    on(event: 'start', listener: (addr: string, params: any) => void): this;
    on(event: 'stop', listener: (addr: string, params: any) => void): this;
    on(event: 'complete', listener: (addr: string, params: any) => void): this;
    on(event: 'update', listener: (addr: string, params: any) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    close(callback?: () => void): void;
    getSwarm(infoHash: string | Buffer): any;
  }
}

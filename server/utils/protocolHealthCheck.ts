/**
 * Protocol Health Check Utility
 * Dynamically checks if tracker protocols are actually responding
 */

export interface ProtocolStatus {
  http: boolean;
  udp: boolean;
  ws: boolean;
}

/**
 * Check if HTTP tracker is responding
 */
async function checkHttpHealth(): Promise<boolean> {
  try {
    // Use local tracker port for health check to avoid Cloudflare/proxy issues
    const httpPort = process.env.TRACKER_HTTP_PORT || '8080';
    const httpUrl = `http://localhost:${httpPort}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    try {
      const response = await fetch(httpUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // Read response body
      const text = await response.text();
      
      // Valid tracker responses are bencoded and start with 'd'
      if (text.startsWith('d')) {
        return true;
      }
      
      // If we get here, it's not a valid tracker response
      return false;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Timeout means server didn't respond
      if (fetchError.name === 'AbortError') {
        return false;
      }
      
      // Connection refused means server is down
      if (fetchError.cause?.code === 'ECONNREFUSED' || fetchError.cause?.code === 'ECONNRESET') {
        return false;
      }
      
      // Network errors mean server is unreachable
      return false;
    }
  } catch (error) {
    console.error('[Health Check] HTTP check failed:', error);
    return false;
  }
}

/**
 * Check if UDP tracker is responding
 * TODO: Implement UDP health check
 * Port: 6969 (from TRACKER_UDP_URL)
 */
async function checkUdpHealth(): Promise<boolean> {
  try {
    const udpUrl = process.env.TRACKER_UDP_URL;
    if (!udpUrl) {
      return false;
    }

    // TODO: Implement UDP connection test
    // This requires sending a UDP connect request to the tracker
    // and waiting for a response
    // For now, return false as UDP is disabled in the tracker config
    return false;
  } catch (error) {
    console.error('[Health Check] UDP check failed:', error);
    return false;
  }
}

/**
 * Check if WebSocket tracker is responding
 * TODO: Implement WebSocket health check
 */
async function checkWsHealth(): Promise<boolean> {
  try {
    const wsUrl = process.env.TRACKER_WS_URL;
    if (!wsUrl) {
      return false;
    }

    // TODO: Implement WebSocket connection test
    // This requires opening a WebSocket connection and checking if it connects
    // For now, return false as WS is disabled in the tracker config
    return false;
  } catch (error) {
    console.error('[Health Check] WebSocket check failed:', error);
    return false;
  }
}

/**
 * Check all protocol health statuses
 * Returns the current status of each protocol
 */
export async function checkProtocolHealth(): Promise<ProtocolStatus> {
  const [http, udp, ws] = await Promise.all([
    checkHttpHealth(),
    checkUdpHealth(),
    checkWsHealth(),
  ]);

  return {
    http,
    udp,
    ws,
  };
}

/**
 * Load Test Runner for OpenTracker
 * 
 * Stress tests the BitTorrent tracker with simulated peer announces.
 * Measures throughput, latency, and error rates.
 */

import {
  generateInfoHash,
  generatePasskey,
  createPeer,
  buildAnnounceQuery,
  type SimulatedPeer,
  type AnnounceEvent,
} from './peer-simulator';

// ============================================================================
// Configuration
// ============================================================================

interface LoadTestConfig {
  trackerUrl: string;
  numPeers: number;
  numTorrents: number;
  durationMs: number;
  announceIntervalMs: number;
  rampUpMs: number;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  requestsPerSecond: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  latencyMin: number;
  latencyMax: number;
  latencyAvg: number;
  durationMs: number;
}

// ============================================================================
// Latency Tracking
// ============================================================================

const latencies: number[] = [];

function recordLatency(ms: number): void {
  latencies.push(ms);
}

function calculatePercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ============================================================================
// HTTP Client (using native fetch)
// ============================================================================

async function sendAnnounce(
  trackerUrl: string,
  peer: SimulatedPeer,
  event: AnnounceEvent
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const query = buildAnnounceQuery(peer, event);
  const url = `${trackerUrl}/announce?${query}`;
  
  const start = performance.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    
    const latencyMs = performance.now() - start;
    
    if (response.ok) {
      return { success: true, latencyMs };
    } else {
      const text = await response.text();
      return { success: false, latencyMs, error: `HTTP ${response.status}: ${text}` };
    }
  } catch (err) {
    const latencyMs = performance.now() - start;
    return { success: false, latencyMs, error: (err as Error).message };
  }
}

// ============================================================================
// Load Test Engine
// ============================================================================

async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  OpenTracker Load Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Tracker URL:     ${config.trackerUrl}`);
  console.log(`  Peers:           ${config.numPeers}`);
  console.log(`  Torrents:        ${config.numTorrents}`);
  console.log(`  Duration:        ${config.durationMs / 1000}s`);
  console.log(`  Announce Rate:   ${1000 / config.announceIntervalMs}/s per peer`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Generate test data
  console.log('Generating test data...');
  const passkey = generatePasskey();
  const torrents = Array.from({ length: config.numTorrents }, () => generateInfoHash());
  
  const peers: SimulatedPeer[] = [];
  for (let i = 0; i < config.numPeers; i++) {
    const torrent = torrents[i % torrents.length];
    const isSeeder = Math.random() > 0.7; // 30% seeders
    peers.push(createPeer(torrent, passkey, isSeeder));
  }
  
  console.log(`  Created ${peers.length} peers across ${torrents.length} torrents\n`);

  // Stats
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  latencies.length = 0;

  // Progress tracking
  const startTime = Date.now();
  const endTime = startTime + config.durationMs;
  let lastProgressUpdate = startTime;

  // Send initial "started" announces for all peers
  console.log('Phase 1: Sending initial "started" announces...');
  const startedPromises = peers.map(async (peer, index) => {
    // Ramp up: stagger the initial announces
    await new Promise(resolve => setTimeout(resolve, (index / peers.length) * config.rampUpMs));
    
    const result = await sendAnnounce(config.trackerUrl, peer, 'started');
    totalRequests++;
    if (result.success) {
      successfulRequests++;
    } else {
      failedRequests++;
      if (failedRequests <= 5) {
        console.log(`  Error: ${result.error}`);
      }
    }
    recordLatency(result.latencyMs);
  });
  
  await Promise.all(startedPromises);
  console.log(`  Completed: ${successfulRequests}/${totalRequests} successful\n`);

  // Main load test loop
  console.log('Phase 2: Sustained load test...');
  
  const intervalId = setInterval(() => {
    const now = Date.now();
    const elapsed = now - startTime;
    const progress = Math.min(100, (elapsed / config.durationMs) * 100);
    
    if (now - lastProgressUpdate > 2000) {
      const currentRps = totalRequests / (elapsed / 1000);
      console.log(
        `  [${progress.toFixed(0)}%] Requests: ${totalRequests} | ` +
        `Success: ${successfulRequests} | Errors: ${failedRequests} | ` +
        `RPS: ${currentRps.toFixed(0)}`
      );
      lastProgressUpdate = now;
    }
  }, 1000);

  // Continuous announce loop
  const announceLoop = async () => {
    while (Date.now() < endTime) {
      // Select random peers for this batch
      const batchSize = Math.min(50, peers.length);
      const batch = Array.from({ length: batchSize }, () => 
        peers[Math.floor(Math.random() * peers.length)]
      );
      
      const batchPromises = batch.map(async (peer) => {
        // Simulate progress
        if (!peer.isSeeder) {
          peer.downloaded += Math.floor(Math.random() * 1000000);
          peer.left = Math.max(0, peer.left - Math.floor(Math.random() * 1000000));
          if (peer.left === 0) {
            peer.isSeeder = true;
          }
        } else {
          peer.uploaded += Math.floor(Math.random() * 1000000);
        }
        
        const result = await sendAnnounce(config.trackerUrl, peer, '');
        totalRequests++;
        if (result.success) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
        recordLatency(result.latencyMs);
      });
      
      await Promise.all(batchPromises);
      await new Promise(resolve => setTimeout(resolve, config.announceIntervalMs));
    }
  };
  
  await announceLoop();
  clearInterval(intervalId);

  // Send "stopped" announces
  console.log('\nPhase 3: Sending "stopped" announces...');
  const stoppedPromises = peers.slice(0, Math.min(100, peers.length)).map(async (peer) => {
    const result = await sendAnnounce(config.trackerUrl, peer, 'stopped');
    totalRequests++;
    if (result.success) {
      successfulRequests++;
    } else {
      failedRequests++;
    }
    recordLatency(result.latencyMs);
  });
  
  await Promise.all(stoppedPromises);

  // Calculate results
  const actualDuration = Date.now() - startTime;
  
  const result: LoadTestResult = {
    totalRequests,
    successfulRequests,
    failedRequests,
    errorRate: (failedRequests / totalRequests) * 100,
    requestsPerSecond: totalRequests / (actualDuration / 1000),
    latencyP50: calculatePercentile(latencies, 50),
    latencyP95: calculatePercentile(latencies, 95),
    latencyP99: calculatePercentile(latencies, 99),
    latencyMin: Math.min(...latencies),
    latencyMax: Math.max(...latencies),
    latencyAvg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    durationMs: actualDuration,
  };

  return result;
}

// ============================================================================
// Results Display
// ============================================================================

function displayResults(result: LoadTestResult): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  LOAD TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n  Throughput:');
  console.log(`    Total Requests:     ${result.totalRequests}`);
  console.log(`    Successful:         ${result.successfulRequests}`);
  console.log(`    Failed:             ${result.failedRequests}`);
  console.log(`    Error Rate:         ${result.errorRate.toFixed(2)}%`);
  console.log(`    Requests/sec:       ${result.requestsPerSecond.toFixed(2)}`);
  
  console.log('\n  Latency (ms):');
  console.log(`    Min:                ${result.latencyMin.toFixed(2)}`);
  console.log(`    Avg:                ${result.latencyAvg.toFixed(2)}`);
  console.log(`    P50:                ${result.latencyP50.toFixed(2)}`);
  console.log(`    P95:                ${result.latencyP95.toFixed(2)}`);
  console.log(`    P99:                ${result.latencyP99.toFixed(2)}`);
  console.log(`    Max:                ${result.latencyMax.toFixed(2)}`);
  
  console.log('\n  Duration:');
  console.log(`    Actual:             ${(result.durationMs / 1000).toFixed(2)}s`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Assessment
  const passed = result.errorRate < 1 && result.latencyP99 < 500;
  if (passed) {
    console.log('  ✓ PASSED - Tracker is performing well');
  } else {
    console.log('  ✗ FAILED - Performance issues detected');
    if (result.errorRate >= 1) {
      console.log(`    - Error rate too high (${result.errorRate.toFixed(2)}% > 1%)`);
    }
    if (result.latencyP99 >= 500) {
      console.log(`    - P99 latency too high (${result.latencyP99.toFixed(2)}ms > 500ms)`);
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function main(args: string[]): Promise<void> {
  // Parse arguments
  const getArg = (name: string, defaultValue: string): string => {
    const index = args.findIndex(a => a === `--${name}`);
    if (index !== -1 && args[index + 1]) {
      return args[index + 1];
    }
    return defaultValue;
  };
  
  const config: LoadTestConfig = {
    trackerUrl: getArg('url', 'http://localhost:8080'),
    numPeers: parseInt(getArg('peers', '100'), 10),
    numTorrents: parseInt(getArg('torrents', '10'), 10),
    durationMs: parseInt(getArg('duration', '10'), 10) * 1000,
    announceIntervalMs: parseInt(getArg('interval', '100'), 10),
    rampUpMs: parseInt(getArg('rampup', '2000'), 10),
  };
  
  // Help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
OpenTracker Load Test

Usage: tsx tests/load/load-test.ts [options]

Options:
  --url <url>         Tracker URL (default: http://localhost:8080)
  --peers <n>         Number of simulated peers (default: 100)
  --torrents <n>      Number of torrents (default: 10)
  --duration <s>      Test duration in seconds (default: 10)
  --interval <ms>     Announce interval in ms (default: 100)
  --rampup <ms>       Ramp-up time in ms (default: 2000)
  --help, -h          Show this help
`);
    return;
  }
  
  try {
    const result = await runLoadTest(config);
    displayResults(result);
    
    // Exit with error code if test failed
    if (result.errorRate >= 1 || result.latencyP99 >= 500) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Load test failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1]?.includes('load-test')) {
  main(process.argv.slice(2));
}

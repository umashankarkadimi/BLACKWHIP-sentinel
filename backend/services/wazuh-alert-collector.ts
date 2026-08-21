import 'dotenv/config';

import { getClient } from '../opensearch.js';
import { logger } from '../logger.js';

// Which OpenSearch index holds the real Wazuh alert stream. Configurable via
// OPENSEARCH_ALERTS_INDEX — the default is a lab-specific pattern, so real
// deployments MUST point this at their own index (e.g. wazuh-alerts-*).
const ALERTS_INDEX = process.env.OPENSEARCH_ALERTS_INDEX || 'wazuh-alerts-4.*';
const POLL_INTERVAL_MS = 5000;

let lastTimestamp = new Date(Date.now() - 60000).toISOString(); // Look back 1 minute on startup
const seenIds = new Set<string>();
let isRunning = false;
let lastErrorLog = 0; // throttle repeated poll failures to 1 log / minute

export const startCollector = (ingestCallback: (event: any) => void) => {
    if (isRunning) return;
    isRunning = true;

    logger.info('collector_started', {
        index: ALERTS_INDEX,
        poll_interval_ms: POLL_INTERVAL_MS,
        lookback: '60s',
    });

    // Poll every 5 seconds
    setInterval(async () => {
        try {
            const client = getClient();
            if (!client) return;

            const response = await client.search({
                index: ALERTS_INDEX,
                body: {
                    query: {
                        range: {
                            "@timestamp": {
                                gte: lastTimestamp
                            }
                        }
                    },
                    sort: [{ "@timestamp": { "order": "asc" } }],
                    size: 100 // Process in batches
                }
            });

            const hits = response.body?.hits?.hits || [];
            if (hits.length > 0) {
                for (const hit of hits) {
                    const event = hit._source;
                    if (seenIds.has(hit._id)) continue;
                    seenIds.add(hit._id);
                    if (seenIds.size > 1000) {
                        // Keep set from growing infinitely
                        const iter = seenIds.values();
                        for (let i = 0; i < 500; i++) seenIds.delete(iter.next().value!);
                    }
                    if (event["@timestamp"]) {
                        lastTimestamp = event["@timestamp"];
                    }
                    // Pass to ingest
                    try {
                        ingestCallback(event);
                    } catch (e: any) {
                        logger.error('collector_ingest_failed', { error: e?.message || String(e) });
                    }
                }
            }
        } catch (error: any) {
            // Retry silently, but log at most once per minute so a down
            // OpenSearch is visible in the logs without spamming them.
            const now = Date.now();
            if (now - lastErrorLog > 60000) {
                lastErrorLog = now;
                logger.warn('collector_poll_failed', { index: ALERTS_INDEX, error: error?.message || String(error) });
            }
        }
    }, POLL_INTERVAL_MS);
};

import { searchEvents, getClient } from '../opensearch.js';

let lastTimestamp = new Date(Date.now() - 60000).toISOString(); // Look back 1 minute on startup
const seenIds = new Set<string>();
let isRunning = false;

export const startCollector = (ingestCallback: (event: any) => void) => {
    if (isRunning) return;
    isRunning = true;
    
    // Poll every 5 seconds
    setInterval(async () => {
        try {
            const client = getClient();
            if (!client) return;
            
            const response = await client.search({
                index: 'wazuh-alerts-4.*', // Real Wazuh alerts
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
                    } catch (e) {
                        console.error("[Collector] Error ingesting event:", e);
                    }
                }
            }
        } catch (error: any) {
            // Silently retry to prevent log spam if disconnected
        }
    }, 5000);
};

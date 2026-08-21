import { Client } from '@opensearch-project/opensearch';
import { logger } from './logger.js';

// Search index for historical Wazuh alerts — same env knob as the collector.
const ALERTS_SEARCH_INDEX = process.env.OPENSEARCH_ALERTS_INDEX || 'wazuh-alerts-*';
// Index used to mirror normalized events back into OpenSearch.
const EVENTS_INDEX = process.env.OPENSEARCH_EVENTS_INDEX || 'wazuh-alerts-lab';

let lastErrorLog = 0; // throttle repeated failures to 1 log / minute

function logThrottled(msg: string, error: any) {
  const now = Date.now();
  if (now - lastErrorLog > 60000) {
    lastErrorLog = now;
    logger.warn(msg, { error: error?.message || String(error) });
  }
}

export const getClient = () => {
    const url = process.env.OPENSEARCH_URL;
    if (!url) throw new Error("OpenSearch Offline");

    // Verify TLS by default outside development; labs with self-signed certs
    // can explicitly opt out with OPENSEARCH_VERIFY_TLS=false.
    const verifyTls = process.env.OPENSEARCH_VERIFY_TLS === undefined
        ? process.env.NODE_ENV !== 'development'
        : process.env.OPENSEARCH_VERIFY_TLS === 'true';

    return new Client({
        node: url,
        auth: {
            username: process.env.OPENSEARCH_USERNAME || process.env.OPENSEARCH_USER || '',
            password: process.env.OPENSEARCH_PASSWORD || ''
        },
        ssl: { rejectUnauthorized: verifyTls }
    });
};

export async function searchEvents(query: string, filters: any = {}) {
    try {
        const client = getClient();

        let mustClauses: any[] = [];
        if (query) {
            mustClauses.push({
                multi_match: {
                    query: query,
                    fields: ["rule.description", "full_log", "agent.name", "data.srcip", "data.win.eventdata.hashes"]
                }
            });
        }

        if (filters.hostname) mustClauses.push({ match: { "agent.name": filters.hostname } });
        if (filters.ip) mustClauses.push({ term: { "data.srcip": filters.ip } });

        const body = {
            query: mustClauses.length > 0 ? { bool: { must: mustClauses } } : { match_all: {} },
            size: 50,
            sort: [{ "@timestamp": { "order": "desc" as any } }]
        };

        const response = await client.search({
            index: ALERTS_SEARCH_INDEX,
            body: body
        });

        return response.body.hits.hits.map((h: any) => h._source);
    } catch (error: any) {
        logThrottled('opensearch_query_failed', error);
        throw new Error("OpenSearch Offline");
    }
}

export async function indexEvent(event: any) {
    try {
        const client = getClient();
        await client.index({
            index: EVENTS_INDEX,
            body: event
        });
    } catch (error: any) {
        logThrottled('opensearch_index_failed', error);
        throw new Error("OpenSearch Offline");
    }
}

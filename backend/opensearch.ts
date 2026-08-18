import { Client } from '@opensearch-project/opensearch';

const getClient = () => {
    const url = process.env.OPENSEARCH_URL;
    if (!url) throw new Error("OpenSearch Offline");

    const verifyTls = process.env.OPENSEARCH_VERIFY_TLS === 'true';

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
            index: 'wazuh-alerts-*',
            body: body
        });
        
        return response.body.hits.hits.map((h: any) => h._source);
    } catch (error: any) {
        console.error("[OpenSearch] Query failed:", error.message);
        throw new Error("OpenSearch Offline");
    }
}

export async function indexEvent(event: any) {
    try {
        const client = getClient();
        await client.index({
            index: `wazuh-alerts-lab`,
            body: event
        });
    } catch (error: any) {
        console.error("[OpenSearch] Index failed:", error.message);
        throw new Error("OpenSearch Offline");
    }
}

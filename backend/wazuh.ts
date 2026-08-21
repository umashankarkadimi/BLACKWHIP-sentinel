import axios from 'axios';
import https from 'https';
import { logger } from './logger.js';

const getWazuhClient = async () => {
    const url = process.env.WAZUH_API_URL;
    const username = process.env.WAZUH_API_USERNAME || process.env.WAZUH_API_USER;
    const password = process.env.WAZUH_API_PASSWORD;
    // Verify TLS by default outside development; labs with self-signed certs
    // can explicitly opt out with WAZUH_VERIFY_TLS=false.
    const verifyTls = process.env.WAZUH_VERIFY_TLS === undefined
        ? process.env.NODE_ENV !== 'development'
        : process.env.WAZUH_VERIFY_TLS === 'true';

    if (!url || !username || !password) {
        throw new Error("Wazuh API configuration missing");
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: verifyTls });

    // Login to get token
    const authString = Buffer.from(`${username}:${password}`).toString('base64');
    const loginRes = await axios.get(`${url}/security/user/authenticate`, {
        headers: { Authorization: `Basic ${authString}` },
        httpsAgent
    });

    const token = loginRes.data?.data?.token;
    if (!token) throw new Error("Wazuh Authentication Failed");

    return axios.create({
        baseURL: url,
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent
    });
};

export async function getAgents() {
    try {
        const client = await getWazuhClient();
        const res = await client.get('/agents');
        const agents = res.data?.data?.affected_items || [];
        
        return agents.map((a: any) => ({
            id: a.id,
            name: a.name,
            status: a.status,
            ip: a.ip || 'Unknown',
            os: a.os?.name || 'Unknown',
            version: a.version
        }));
    } catch (e: any) {
        // console.error("[Wazuh] Error getting agents:", e.message); // Silenced to avoid spamming logs when disconnected
        throw new Error("Wazuh Offline");
    }
}

export async function isolateHost(agentId: string) {
    try {
        const client = await getWazuhClient();
        // Assuming we're using Wazuh's Active Response API
        // E.g. firewall-drop or a custom quarantine script
        const res = await client.put('/active-response', {
            command: "firewall-drop0",
            custom: true,
            arguments: ["-"],
            agents_list: [agentId]
        });
        
        if (res.data?.error === 0) {
            return { status: 'SUCCESS', details: `Isolation command dispatched to agent ${agentId}` };
        } else {
            return { status: 'FAILED', details: `Isolation command failed: ${res.data?.message || 'Unknown error'}` };
        }
    } catch (e: any) {
        logger.warn("wazuh_isolate_failed", { error: e?.message || String(e) });
        return { status: 'UNVERIFIED', details: 'Isolation Unverified: Could not confirm execution' };
    }
}

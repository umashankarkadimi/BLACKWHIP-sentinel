import axios from 'axios';
import 'dotenv/config';

export async function lookupHash(hash: string) {
  try {
    const vtKey = process.env.VIRUSTOTAL_API_KEY;
    if (vtKey) {
      // VirusTotal Lookup (Files)
      const res = await axios.get(`https://www.virustotal.com/api/v3/files/${hash}`, {
        headers: {
          'x-apikey': vtKey
        }
      });
      const maliciousCount = res.data?.data?.attributes?.last_analysis_stats?.malicious || 0;
      return { 
        malicious: maliciousCount > 0, 
        source: 'VirusTotal',
        details: `Detected by ${maliciousCount} engines.`
      };
    }
    
    const otxKey = process.env.OTX_API_KEY;
    if (otxKey) {
       const res = await axios.get(`https://otx.alienvault.com/api/v1/indicators/file/${hash}/general`, {
           headers: { 'X-OTX-API-KEY': otxKey }
       });
       const pulseCount = res.data?.pulse_info?.count || 0;
       return {
           malicious: pulseCount > 0,
           source: 'AlienVault OTX',
           details: `Found in ${pulseCount} pulses.`
       };
    }
    
    return { malicious: false, source: 'UNKNOWN', details: 'Threat Intelligence APIs unavailable' };
  } catch (error) {
    console.error('[ThreatIntel] Error looking up IOC:', error);
    return { malicious: false, source: 'UNKNOWN', details: 'Error reaching Threat Intelligence' };
  }
}

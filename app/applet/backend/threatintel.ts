export async function lookupHash(hash: string) {
  console.log(`[ThreatIntel] Looking up hash: ${hash}`);
  const isMalicious = hash.startsWith('bad') || hash.includes('malicious');
  return {
    malicious: isMalicious,
    source: 'SOC Lab Threat Intel (Mock)'
  };
}

import { GoogleGenAI } from "@google/genai";
import { Incident, AIAnalysis } from "../frontend/src/types.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function runAIAnalysis(incident: Incident): Promise<AIAnalysis> {
  const prompt = `
  You are Paul, the SOC Analysis Engine. Analyze this security incident and provide a structured JSON response.
  Follow these rules:
  1. Never invent events.
  2. Use "Unknown" when evidence is insufficient.
  3. Respond strictly in valid JSON matching this structure exactly:
  {
    "classification": "Suspicious" | "Malicious" | "Benign",
    "severity": "INFORMATIONAL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "confidence": 0.0 to 1.0,
    "attack_stage": "string",
    "what_happened": "string",
    "why_suspicious": "string",
    "evidence": ["string"],
    "mitre_candidates": ["string"],
    "recommended_investigation": ["string"],
    "recommended_response": ["string"]
  }

  Incident Data:
  Title: ${incident.title}
  Assets: ${incident.affected_assets.join(", ")}
  Events:
  ${incident.events.map(e => `- [${e.timestamp}] ${e.event_type} on ${e.hostname} | Rule: ${e.rule_name || 'N/A'}`).join("\n")}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AIAnalysis;
  } catch (error) {
    console.error("Paul Analysis failed:", error);
    // Fallback if Paul fails
    return {
      classification: "Suspicious",
      severity: incident.severity,
      confidence: incident.confidence,
      attack_stage: "Unknown",
      what_happened: "Automated analysis unavailable. Please review manually.",
      why_suspicious: "Matched high-confidence detection rules.",
      evidence: incident.events.map(e => e.rule_name || e.event_type),
      mitre_candidates: incident.mitre_techniques,
      recommended_investigation: ["Review associated events", "Check host status"],
      recommended_response: ["Isolate host if confirmed malicious"]
    };
  }
}

export async function interrogateGlobalAI(storeData: any, message: string, history: { role: string, content: string }[]): Promise<string> {
  const systemPrompt = `You are Paul, a highly intelligent global DFIR Copilot integrated into the BlackWhip SentinelX platform.
You are assisting a SOC analyst by providing full-spectrum oversight of the entire dashboard, system state, recent events, and active incidents.

CRITICAL INSTRUCTIONS:
1. STRICT GROUNDING: You must base all your answers strictly on the CURRENT DASHBOARD STATE SUMMARY and INCIDENTS SUMMARY provided below. DO NOT hallucinate, guess, or invent any incidents, metrics, or events that are not explicitly listed in the data below.
2. CONFIDENCE SCORES: When making assertions about threats, explicitly state your confidence based on the provided empirical evidence. If the data is missing, clearly state that you do not have enough information to form a conclusion.
3. CONCISENESS: Adopt a clear, helpful, and easily understandable tone. Explain things in plain language. Use short paragraphs, bullet points, and formatting to make your responses easy to read.

CURRENT DASHBOARD STATE SUMMARY:
Mode: ${storeData.state.mode}
High Alerts: ${storeData.state.highAlerts}
Total Endpoints: ${storeData.state.totalEndpoints}
Active Incidents: ${storeData.incidents.length}
Recent Events Count: ${storeData.events.length}

INCIDENTS SUMMARY:
${storeData.incidents.slice(0, 5).map((i: any) => `- ID: ${i.incident_id} | ${i.severity} | ${i.title} | Status: ${i.status} | Assets: ${i.affected_assets.join(', ')}`).join('\n')}`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: "PAUL ONLINE. FULL DASHBOARD TELEMETRY SYNCED. READY FOR INQUIRY." }] }
  ];

  for (const msg of history) {
    contents.push({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: contents as any
    });
    return response.text || "PAUL ERROR: UNABLE TO COMPUTE RESPONSE.";
  } catch (error) {
    console.error("Paul Global Chat failed:", error);
    return "PAUL ERROR: GLOBAL CONNECTION FAILED.";
  }
}

export async function interrogateAI(incident: Incident, message: string, history: { role: string, content: string }[]): Promise<string> {
  const systemPrompt = `You are Paul, a highly intelligent DFIR Copilot integrated into the BlackWhip SentinelX platform.
You are assisting a SOC analyst with the following active incident:

CRITICAL INSTRUCTIONS:
1. STRICT GROUNDING: You must base all your answers strictly on the Incident Data provided below. DO NOT hallucinate, guess, or invent any indicators, IP addresses, or events that are not explicitly listed in the context.
2. CONFIDENCE SCORES: When making assertions about threats, explicitly state your confidence based on the provided empirical evidence. If the data is missing, clearly state that you do not have enough information to form a conclusion.
3. CONCISENESS: Adopt a clear, helpful, and easily understandable tone. Explain things in plain language. Use short paragraphs, bullet points, and formatting to make your responses easy to read.

INCIDENT DATA:
Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Affected Assets: ${incident.affected_assets.join(', ')}

Context on what happened (from previous AI Analysis):
${incident.ai_analysis?.what_happened || 'No analysis available.'}

Associated IOCs:
${incident.iocs?.map(i => `- ${i.type}: ${i.value} (${i.source}) - Malicious: ${i.malicious}`).join('\n') || 'None'}
`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: "NEXUS ONLINE. READY TO ASSIST WITH INCIDENT TRIAGE." }] }
  ];

  for (const msg of history) {
    contents.push({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: contents as any
    });
    return response.text || "PAUL ERROR: UNABLE TO COMPUTE RESPONSE.";
  } catch (error) {
    console.error("Paul Chat failed:", error);
    return "PAUL ERROR: CONNECTION FAILED.";
  }
}


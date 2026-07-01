import { generateText } from "ai";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { createAiGatewayProvider } from "./ai-gateway.server";

const CRITERIA_PATH = path.resolve(process.cwd(), "criteria-config.json");

export function readCriteriaConfig(): { id: string; name: string; maxScore: number; description: string }[] {
  try {
    if (fs.existsSync(CRITERIA_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CRITERIA_PATH, "utf-8"));
      if (Array.isArray(raw?.criteria) && raw.criteria.length > 0) return raw.criteria;
    }
  } catch {}
  return [
    { id: "F1",  name: "Innovation & Creativity",          maxScore: 10, description: "Originality, uniqueness, creativity." },
    { id: "F2",  name: "Problem Understanding & Relevance", maxScore: 10, description: "Clarity of problem and theme alignment." },
    { id: "F3",  name: "Feasibility & Practicality",        maxScore: 10, description: "Realistic implementation." },
    { id: "F4",  name: "Impact & Usefulness",               maxScore: 10, description: "Social/environmental/economic impact." },
    { id: "F5",  name: "User-Centric Approach",             maxScore: 10, description: "User needs, accessibility, inclusivity." },
    { id: "F6",  name: "Scalability & Future Scope",        maxScore: 10, description: "Expand, sustain, evolve." },
    { id: "F7",  name: "Sustainability & Ethics",           maxScore: 10, description: "Eco-friendly and ethical considerations." },
    { id: "F8",  name: "Presentation & Communication",      maxScore: 10, description: "Pitch clarity, structure, confidence." },
    { id: "F9",  name: "Teamwork & Collaboration",          maxScore: 10, description: "Coordination, participation, team dynamics." },
    { id: "F10", name: "Business Viability",                maxScore: 10, description: "Market potential, affordability, applicability." },
  ];
}

const CriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number(),
  evidence: z.string(),
  strengths: z.string(),
  weaknesses: z.string(),
  deductions: z.string(),
});

export const ResultSchema = z.object({
  executiveSummary: z.string(),
  problemStatement: z.string(),
  solution: z.string(),
  criteria: z.array(CriterionSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  risks: z.array(z.string()),
  suggestions: z.array(z.string()),
  totalScore: z.number(),
  overallRating: z.string(),
});

export type EvaluationResult = z.infer<typeof ResultSchema>;

function buildSystemPrompt(category?: string): string {
  const criteriaList = readCriteriaConfig();
  const maxTotal = criteriaList.reduce((s, c) => s + c.maxScore, 0);
  const criteriaText = criteriaList
    .map((c) => `${c.id}. ${c.name} (${c.maxScore}) — ${c.description}`)
    .join("\n");
  const count = criteriaList.length;
  return `You are the Official Evaluation Engine for Ideathon 2026.
${category ? `The team has selected the following topic/category: "${category}". Please evaluate their submission within the context of this category.` : ""}
Read the entire submission PDF. Score strictly using evidence from the document. Never score based on keywords or buzzwords. Every awarded mark must be supported by evidence; every deduction must be explained.

Bands per criterion (0-maxScore): 9-10 outstanding, 7-8 strong, 5-6 average, 3-4 weak, 0-2 missing (scale proportionally for non-10 maxScores).
Overall: Excellent 85-100; Strong 70-84; Promising with gaps 61-69; Major gaps 41-60; Weak/incomplete 0-40.

Criteria (${count} total, max total = ${maxTotal}):
${criteriaText}

Return all ${count} criteria in order. totalScore = sum of criterion scores (0-${maxTotal}).

Respond with ONLY a single JSON object (no markdown, no prose, no code fences) matching this TypeScript type:
{
  executiveSummary: string;
  problemStatement: string;
  solution: string;
  criteria: { id: string; name: string; score: number; evidence: string; strengths: string; weaknesses: string; deductions: string }[];
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  suggestions: string[];
  totalScore: number;
  overallRating: string;
}`;
}

function extractJson(text: string): unknown {
  let s = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.search(/[\{\[]/);
  const openCh = s[start];
  const closeCh = openCh === "[" ? "]" : "}";
  const end = s.lastIndexOf(closeCh);
  if (start === -1 || end === -1) throw new Error("No JSON found in model response");
  s = s.substring(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    s = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(s);
  }
}

export async function evaluatePdf(base64Pdf: string, fileName: string, category?: string): Promise<EvaluationResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY environment variable");

  const gatewayUrl = process.env.AI_GATEWAY_BASE_URL || "";
  const isDirectGemini = gatewayUrl.includes("googleapis.com");

  const SYSTEM = buildSystemPrompt(category);

  const runOnce = async (): Promise<EvaluationResult> => {
    if (isDirectGemini) {
      const model = process.env.AI_MODEL || "gemini-1.5-pro";
      // Google API expects the key as a query parameter
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${SYSTEM}\n\nEvaluate the attached submission PDF (${fileName}) per the rubric. Read every page. Cite concrete evidence (quote or paraphrase with page reference) for each criterion. Do not infer features that are not explicitly stated. Return ONLY the JSON object described in the system message.`,
                  },
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: base64Pdf,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const responseData = await res.json();
      const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini API");
      return ResultSchema.parse(extractJson(text));
    } else {
      const gateway = createAiGatewayProvider(key);
      const { text } = await generateText({
        model: gateway(process.env.AI_MODEL || "google/gemini-3-pro-preview"),
        temperature: 0,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Evaluate the attached submission PDF (${fileName}) per the rubric. Read every page. Cite concrete evidence (quote or paraphrase with page reference) for each criterion. Do not infer features that are not explicitly stated. Return ONLY the JSON object described in the system message.`,
              },
              { type: "file", mediaType: "application/pdf", data: base64Pdf },
            ],
          },
        ],
      });
      return ResultSchema.parse(extractJson(text));
    }
  };

  // retry once on parse error
  try {
    const result = await runOnce();
    result.totalScore = result.criteria.reduce((sum, c) => sum + (c.score || 0), 0);
    return result;
  } catch (e) {
    console.error("[evaluatePdf] attempt 1 failed:", e);
    const result = await runOnce();
    result.totalScore = result.criteria.reduce((sum, c) => sum + (c.score || 0), 0);
    return result;
  }
}
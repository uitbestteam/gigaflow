export function buildInbodyPrompt(): string {
  return `You are analyzing a photo of an InBody body-composition result sheet.

Extract only the numbers that are clearly visible on the InBody sheet and return ONLY minified JSON matching this exact schema — no prose, no markdown, no explanation:

{
  "weightKg": number,
  "bmi": number,
  "bodyFatPercent": number,
  "skeletalMuscleMassKg": number,
  "bodyFatMassKg": number,
  "visceralFatLevel": number
}

CONSTRAINTS:
- weightKg is REQUIRED and must always be included.
- All other fields are OPTIONAL: omit any field whose value is not clearly visible on the InBody sheet.
- Every value must be a plain number (no units, no strings, no ranges).
- Do not guess or infer values that are not printed on the sheet.
- Respond with ONLY the minified JSON object, nothing else.`;
}

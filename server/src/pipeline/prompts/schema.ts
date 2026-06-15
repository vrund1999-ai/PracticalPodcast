// JSON schema for the structured podcast script Claude returns.
// SQLite/Anthropic structured-output constraints: every object sets
// additionalProperties:false; no numeric/length constraints; no recursion.
export const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The episode title (use the provided fixed title)." },
    segments: {
      type: "array",
      description: "Ordered segments: an intro, one per major story, and a wrap-up.",
      items: {
        type: "object",
        properties: {
          chapterTitle: { type: "string", description: "Short chapter label for this segment." },
          topics: {
            type: "array",
            description: "Display topic tags for this segment, e.g. ['Finance','Markets'].",
            items: { type: "string" },
          },
          lines: {
            type: "array",
            description: "Alternating spoken lines between the two hosts.",
            items: {
              type: "object",
              properties: {
                speaker: { type: "string", enum: ["NOVA", "ATLAS"] },
                text: { type: "string", description: "One spoken line, plain conversational prose." },
              },
              required: ["speaker", "text"],
              additionalProperties: false,
            },
          },
        },
        required: ["chapterTitle", "topics", "lines"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "segments"],
  additionalProperties: false,
} as const;

export interface ScriptLine {
  speaker: "NOVA" | "ATLAS";
  text: string;
}
export interface ScriptSegment {
  chapterTitle: string;
  topics: string[];
  lines: ScriptLine[];
}
export interface GeneratedScript {
  title: string;
  segments: ScriptSegment[];
}

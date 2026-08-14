import { describe, it, expect } from "vitest";
import { AgentOutput, AgentOutputJsonSchema } from "../src/agents";

/**
 * Parity check: the derived JSON Schema must accept exactly what the Zod schema accepts.
 *
 * A full JSON-Schema validator (ajv) is not a dependency of this package, so we use a tiny
 * self-contained validator covering the draft-07 subset that `zod-to-json-schema` emits for
 * `AgentOutput` (type / enum / minimum / maximum / minLength / maxLength / required /
 * properties / additionalProperties + $ref into definitions). It is enough to prove parity.
 */

type JsonSchema = Record<string, any>;

function validate(schema: JsonSchema, root: JsonSchema, value: unknown): string[] {
  if (typeof schema.$ref === "string") {
    const key = schema.$ref.replace("#/definitions/", "");
    return validate(root.definitions[key], root, value);
  }

  const errors: string[] = [];
  const types = Array.isArray(schema.type)
    ? (schema.type as string[])
    : schema.type
      ? [schema.type as string]
      : [];

  const jsType =
    value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value === "number" && Number.isInteger(value)
          ? "number" // draft-07 treats integers as numbers here
          : typeof value;

  if (types.length && !types.includes(jsType === "object" && Array.isArray(value) ? "array" : jsType)) {
    errors.push(`type: expected ${types.join("|")}, got ${jsType}`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`enum: ${String(value)} not in [${schema.enum.join(", ")}]`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push("minimum");
    if (schema.maximum !== undefined && value > schema.maximum) errors.push("maximum");
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push("minLength");
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push("maxLength");
  }
  if (types.includes("object") && value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const req of schema.required ?? []) {
      if (!(req in obj)) errors.push(`required: ${req}`);
    }
    for (const [key, v] of Object.entries(obj)) {
      const propSchema = schema.properties?.[key];
      if (propSchema) {
        errors.push(...validate(propSchema, root, v));
      } else if (schema.additionalProperties === false) {
        errors.push(`additionalProperties: unexpected ${key}`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(...validate(schema.additionalProperties, root, v));
      }
    }
  }
  return errors;
}

const goodPayload = {
  agent: "technical",
  direction: "bearish",
  confidence: 0.4,
  rationale: "RSI rolling over below 50.",
  evidence: { rsi: 47.2, note: "MACD histogram negative", crossedDown: true },
};

describe("AgentOutputJsonSchema", () => {
  it("is a valid draft-07 JSON Schema shell", () => {
    expect(AgentOutputJsonSchema).toHaveProperty("$schema");
    expect(AgentOutputJsonSchema).toHaveProperty("$ref", "#/definitions/AgentOutput");
    expect((AgentOutputJsonSchema as JsonSchema).definitions.AgentOutput.type).toBe("object");
  });

  it("validates a known-good payload (parity with Zod accept)", () => {
    expect(() => AgentOutput.parse(goodPayload)).not.toThrow();
    expect(validate(AgentOutputJsonSchema as JsonSchema, AgentOutputJsonSchema as JsonSchema, goodPayload)).toEqual([]);
  });

  it("rejects the same payloads Zod rejects (parity with Zod reject)", () => {
    const root = AgentOutputJsonSchema as JsonSchema;
    const cases = [
      { ...goodPayload, confidence: 1.5 },
      { ...goodPayload, confidence: -1 },
      { ...goodPayload, rationale: "" },
      { ...goodPayload, direction: "sideways" },
      { ...goodPayload, agent: "macro" },
    ];
    for (const bad of cases) {
      expect(() => AgentOutput.parse(bad)).toThrow();
      expect(validate(root, root, bad).length).toBeGreaterThan(0);
    }
  });
});

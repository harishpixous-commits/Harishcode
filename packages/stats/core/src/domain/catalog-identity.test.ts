import { describe, expect, test } from "bun:test"
import { catalogIdentity } from "./catalog-identity"

describe("stats catalog identity", () => {
  test("resolves HarishCode offerings to canonical labs", () => {
    const identity = catalogIdentity({
      models: { "meituan/longcat-2.5-preview": {} },
      providers: {
        harishcode: { models: { "longcat-2.5-preview-free": { canonical_model_id: "meituan/longcat-2.5-preview" } } },
        "harishcode-go": {
          models: { "longcat-2.5-preview-free": { canonical_model_id: "meituan/longcat-2.5-preview" } },
        },
      },
    })

    expect(identity.offerings.get("harishcode/longcat-2.5-preview-free")).toBe("meituan")
    expect(identity.offerings.get("harishcode-go/longcat-2.5-preview-free")).toBe("meituan")
    expect(identity.models.get("longcat-2.5-preview")).toBe("meituan")
  })

  test("does not guess a lab for a name shared by different canonical models", () => {
    const identity = catalogIdentity({
      models: { "lab-a/model": {}, "lab-b/model": {} },
      providers: {
        harishcode: { models: { "model-free": { canonical_model_id: "lab-a/model" } } },
        "harishcode-go": { models: { model: { canonical_model_id: "lab-b/model" } } },
      },
    })

    expect(identity.offerings.get("harishcode/model-free")).toBe("lab-a")
    expect(identity.offerings.get("harishcode-go/model")).toBe("lab-b")
    expect(identity.models.has("model")).toBe(false)
  })

  test("accepts provider IDs that are already canonical catalog IDs", () => {
    const identity = catalogIdentity({
      models: { "harishcode/direct-model": {} },
      providers: { harishcode: { models: { "direct-model": {} } } },
    })

    expect(identity.offerings.get("harishcode/direct-model")).toBe("harishcode")
    expect(identity.models.get("direct-model")).toBe("harishcode")
  })

  test("rejects a catalog without published canonical identities", () => {
    expect(() => catalogIdentity({ models: {}, providers: { harishcode: { models: { model: {} } } } })).toThrow(
      "Model catalog has no canonical HarishCode offerings",
    )
  })
})

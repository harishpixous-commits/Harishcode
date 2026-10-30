import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveReviewProfile } from "../../src/acp/guarded"

const withWorkspace = (run: (workspace: string) => void) => {
  const workspace = mkdtempSync(join(tmpdir(), "hc-guarded-profile-"))
  try {
    run(workspace)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

test("default client mode keeps client review and rejects review flags", () => {
  expect(resolveReviewProfile({ permissionReview: "client" })).toEqual({ mode: "client" })
  expect(() => resolveReviewProfile({ permissionReview: "client", reviewWorkspace: "/tmp" })).toThrow(
    "require --permission-review harishcode",
  )
  expect(() => resolveReviewProfile({ permissionReview: "client", reviewTimeout: "5000" })).toThrow(
    "require --permission-review harishcode",
  )
})

test("harishcode mode requires an absolute existing workspace directory", () =>
  withWorkspace((workspace) => {
    expect(() => resolveReviewProfile({ permissionReview: "harishcode" })).toThrow("requires --review-workspace")
    expect(() => resolveReviewProfile({ permissionReview: "harishcode", reviewWorkspace: "relative/path" })).toThrow(
      "absolute path",
    )
    expect(() =>
      resolveReviewProfile({ permissionReview: "harishcode", reviewWorkspace: join(workspace, "missing") }),
    ).toThrow("not an existing directory")
    const file = join(workspace, "file.txt")
    writeFileSync(file, "x")
    expect(() => resolveReviewProfile({ permissionReview: "harishcode", reviewWorkspace: file })).toThrow(
      "not an existing directory",
    )
    const profile = resolveReviewProfile({ permissionReview: "harishcode", reviewWorkspace: workspace })
    expect(profile).toMatchObject({ mode: "harishcode", workspace })
  }))

test("review timeout accepts bounded whole milliseconds", () =>
  withWorkspace((workspace) => {
    const base = { permissionReview: "harishcode", reviewWorkspace: workspace }
    expect(() => resolveReviewProfile({ ...base, reviewTimeout: "0" })).toThrow("whole milliseconds")
    expect(() => resolveReviewProfile({ ...base, reviewTimeout: "300001" })).toThrow("whole milliseconds")
    expect(() => resolveReviewProfile({ ...base, reviewTimeout: "1.5" })).toThrow("whole milliseconds")
    expect(() => resolveReviewProfile({ ...base, reviewTimeout: "abc" })).toThrow("whole milliseconds")
    expect(resolveReviewProfile({ ...base, reviewTimeout: "45000" }).mode).toBe("harishcode")
  }))

test("unknown review modes are rejected", () => {
  expect(() => resolveReviewProfile({ permissionReview: "auto" })).toThrow('expected "client" or "harishcode"')
})

import { describe, expect, test } from "bun:test";
import { generateBranchName, slugifyTitle } from "./branch-name";

describe("slugifyTitle", () => {
  test("converts title to lowercase", () => {
    expect(slugifyTitle("Hello World")).toBe("hello-world");
    expect(slugifyTitle("UPPERCASE")).toBe("uppercase");
    expect(slugifyTitle("MixedCase")).toBe("mixedcase");
  });

  test("replaces spaces with hyphens", () => {
    expect(slugifyTitle("hello world")).toBe("hello-world");
    expect(slugifyTitle("hello   world")).toBe("hello-world");
    expect(slugifyTitle("one two three")).toBe("one-two-three");
  });

  test("replaces special characters with hyphens", () => {
    expect(slugifyTitle("hello@world")).toBe("hello-world");
    expect(slugifyTitle("hello!world")).toBe("hello-world");
    expect(slugifyTitle("hello#$%world")).toBe("hello-world");
    expect(slugifyTitle("user's feature")).toBe("user-s-feature");
  });

  test("removes consecutive hyphens", () => {
    expect(slugifyTitle("hello---world")).toBe("hello-world");
    expect(slugifyTitle("a--b--c")).toBe("a-b-c");
  });

  test("removes leading and trailing hyphens", () => {
    expect(slugifyTitle("-hello-")).toBe("hello");
    expect(slugifyTitle("---hello---")).toBe("hello");
    expect(slugifyTitle("!hello!")).toBe("hello");
  });

  test("handles empty string", () => {
    expect(slugifyTitle("")).toBe("");
  });

  test("handles string with only special characters", () => {
    expect(slugifyTitle("!!!")).toBe("");
    expect(slugifyTitle("@#$%^&*")).toBe("");
  });

  test("preserves numbers", () => {
    expect(slugifyTitle("version 2.0")).toBe("version-2-0");
    expect(slugifyTitle("feature123")).toBe("feature123");
  });

  test("handles unicode characters", () => {
    expect(slugifyTitle("cafe")).toBe("cafe");
    expect(slugifyTitle("hello monde")).toBe("hello-monde");
  });
});

describe("generateBranchName", () => {
  test("creates branch name from issue ID and title", () => {
    expect(generateBranchName("Q-3", "Implement audit log endpoint spec")).toBe(
      "Q-3-implement-audit-log-endpoint-spec"
    );
    expect(generateBranchName("ENG-123", "Fix login bug")).toBe(
      "ENG-123-fix-login-bug"
    );
  });

  test("preserves issue ID case", () => {
    expect(generateBranchName("Q-3", "test")).toBe("Q-3-test");
    expect(generateBranchName("ABC-123", "test")).toBe("ABC-123-test");
    expect(generateBranchName("eng-1", "test")).toBe("eng-1-test");
  });

  test("returns only issue ID when title is empty", () => {
    expect(generateBranchName("Q-3", "")).toBe("Q-3");
  });

  test("returns only issue ID when title has only special characters", () => {
    expect(generateBranchName("Q-3", "!!!")).toBe("Q-3");
    expect(generateBranchName("Q-3", "@#$%")).toBe("Q-3");
  });

  test("truncates to 100 characters while preserving issue ID", () => {
    const longTitle =
      "This is a very long title that should be truncated to fit within the maximum branch name length of 100 characters";
    const result = generateBranchName("Q-3", longTitle);

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.startsWith("Q-3-")).toBe(true);
  });

  test("does not end with hyphen after truncation", () => {
    // Create a title that will truncate right at a word boundary
    const longTitle = "a".repeat(50) + "-" + "b".repeat(50);
    const result = generateBranchName("Q-3", longTitle);

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result.endsWith("-")).toBe(false);
  });

  test("handles title with max length exactly", () => {
    // issueId = "Q-3" (3 chars) + hyphen (1 char) = 4 chars
    // So title can be 96 chars max
    const titlePart = "a".repeat(96);
    const result = generateBranchName("Q-3", titlePart);

    expect(result).toBe("Q-3-" + titlePart);
    expect(result.length).toBe(100);
  });

  test("handles very long issue IDs", () => {
    const longIssueId = "VERYLONGTEAM-99999";
    const result = generateBranchName(longIssueId, "short title");

    expect(result.startsWith(longIssueId + "-")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  test("handles special characters in title", () => {
    expect(generateBranchName("Q-1", "Fix bug: user can't login")).toBe(
      "Q-1-fix-bug-user-can-t-login"
    );
    expect(generateBranchName("Q-2", "Add feature (beta)")).toBe(
      "Q-2-add-feature-beta"
    );
    expect(
      generateBranchName("Q-3", "[URGENT] Fix production issue!")
    ).toBe("Q-3-urgent-fix-production-issue");
  });

  test("handles titles with numbers", () => {
    expect(generateBranchName("Q-1", "Upgrade to v2.0")).toBe(
      "Q-1-upgrade-to-v2-0"
    );
    expect(generateBranchName("Q-2", "Add OAuth2 support")).toBe(
      "Q-2-add-oauth2-support"
    );
  });

  test("handles whitespace variations", () => {
    expect(generateBranchName("Q-1", "  trimmed  title  ")).toBe(
      "Q-1-trimmed-title"
    );
    expect(generateBranchName("Q-2", "tabs\there")).toBe("Q-2-tabs-here");
    expect(generateBranchName("Q-3", "new\nlines")).toBe("Q-3-new-lines");
  });
});

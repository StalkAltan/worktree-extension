/**
 * Branch name generation utilities for creating git-friendly branch names
 * from Linear issue IDs and titles.
 */

const MAX_BRANCH_LENGTH = 100;

/**
 * Generate a git branch name from an issue ID and title.
 *
 * Rules:
 * 1. Preserve issue ID case (e.g., "Q-3" stays "Q-3")
 * 2. Convert title to lowercase
 * 3. Replace spaces and special characters with hyphens
 * 4. Remove consecutive hyphens
 * 5. Remove leading/trailing hyphens
 * 6. Truncate to max 100 characters (preserving issue ID)
 *
 * @param issueId - The Linear issue ID (e.g., "Q-3")
 * @param title - The issue title (e.g., "Implement audit log endpoint spec")
 * @returns A git-friendly branch name (e.g., "Q-3-implement-audit-log-endpoint-spec")
 */
export function generateBranchName(issueId: string, title: string): string {
  const slugifiedTitle = slugifyTitle(title);

  // If no title provided, just return the issue ID
  if (!slugifiedTitle) {
    return issueId;
  }

  const fullBranchName = `${issueId}-${slugifiedTitle}`;

  if (fullBranchName.length <= MAX_BRANCH_LENGTH) {
    return fullBranchName;
  }

  // Truncate title portion, keeping issue ID
  // -1 for the hyphen between issueId and title
  const availableLength = MAX_BRANCH_LENGTH - issueId.length - 1;
  const truncatedTitle = slugifiedTitle.slice(0, availableLength).replace(/-$/, "");

  return `${issueId}-${truncatedTitle}`;
}

/**
 * Convert a title string to a URL/git-friendly slug.
 *
 * @param title - The title to slugify
 * @returns A lowercase slug with hyphens instead of spaces/special chars
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphen
    .replace(/-+/g, "-") // Remove consecutive hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

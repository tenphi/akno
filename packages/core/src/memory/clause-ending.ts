/** A closed local clause cannot borrow an affirmation that the next correction retracts.
 * This checks only the immediate continuation; source verification still owns full discourse. */
export function hasUnretractedClauseEnd(text: string, offset: number): boolean {
  return /^[ \t]*(?:$|[.!;](?!\s*(?:but|however|yet|actually|(?:and\s+)?(?:this|that)\s+is\s+false|но|однако|на\s+самом\s+деле|(?:(?:и|а)\s+)?это\s+неверно)(?![\p{L}\p{N}])))/iu.test(
    text.slice(offset),
  );
}

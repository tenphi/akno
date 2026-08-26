import { sha256 } from '../store/ids.ts';

export const MERGE_DISCOVERY_CORPUS_VERSION = 'merge-discovery-corpus-v2';

export type MergeDiscoveryCategory =
  'duplicate' | 'near_purpose' | 'related_scope' | 'template' | 'entity_collision';

export type MergeDiscoverySplit = 'development' | 'test';

export interface MergeDiscoveryBenchPage {
  id: string;
  text: string;
}

export interface MergeDiscoveryBenchCase {
  id: string;
  category: MergeDiscoveryCategory;
  expected: 'candidate' | 'keep_separate';
  left: string;
  right: string;
}

export interface MergeDiscoveryCorpus {
  split: MergeDiscoverySplit;
  frozen: boolean;
  pages: readonly MergeDiscoveryBenchPage[];
  cases: readonly MergeDiscoveryBenchCase[];
}

const DEVELOPMENT_PAGES: MergeDiscoveryBenchPage[] = [
  page(
    'ada-profile',
    'Ada Marlow',
    'Durable profile for Ada Marlow. Ada lives at Blackwater Bay and maintains a Zephyr QX-100 field kit.',
  ),
  page(
    'ada-notes',
    'Notes about Ada Marlow',
    'Additional durable facts about Ada Marlow. Ada works with Vulpine Mutual and keeps a brass compass.',
  ),
  page(
    'ada-project',
    'Ada Marlow — Zephyr rollout',
    'Scoped project log for Ada Marlow: rollout milestones, assigned tasks, open decisions, and completion dates.',
  ),
  page(
    'bo-reference',
    'Bo Winters reference',
    'Durable reference for Bo Winters. Bo works with Vulpine Mutual and keeps a silver compass.',
  ),
  page(
    'bo-profile',
    'Bo Winters',
    'Durable profile for Bo Winters. Bo lives at Blackwater Bay and maintains a Zephyr QX-100 field kit.',
  ),
  page(
    'zephyr-profile',
    'Zephyr QX-100',
    'Canonical product overview for the Zephyr QX-100, including its durable identity, manufacturer, and specifications.',
  ),
  page(
    'zephyr-notes',
    'Zephyr QX-100 notes',
    'Additional durable product facts about the Zephyr QX-100, including materials, dimensions, and maintenance characteristics.',
  ),
  page(
    'zephyr-warranty',
    'Zephyr QX-100 warranty procedure',
    'Scoped warranty procedure for the Zephyr QX-100: claim steps, required evidence, deadlines, and escalation contacts.',
  ),
  page(
    'vulpine-zephyr-program',
    'Vulpine Mutual Zephyr QX-100 review program',
    'An internal Vulpine Mutual review program that uses Zephyr QX-100 records as examples; it is not the product record.',
  ),
  page(
    'vulpine-profile',
    'Vulpine Mutual',
    'Canonical organization profile for Vulpine Mutual, its identity, services, and durable contact information.',
  ),
  page(
    'vulpine-notes',
    'Notes about Vulpine Mutual',
    'Additional durable facts about Vulpine Mutual, its service regions, departments, and public contact channels.',
  ),
  page(
    'vulpine-claims',
    'Vulpine Mutual claims procedure',
    'Scoped claims workflow for Vulpine Mutual: filing steps, evidence requirements, review stages, and appeals.',
  ),
  page(
    'bay-profile',
    'Blackwater Bay',
    'Canonical place profile for Blackwater Bay, including location, enduring characteristics, and access information.',
  ),
  page(
    'bay-notes',
    'Blackwater Bay field notes',
    'Additional enduring facts about Blackwater Bay, including terrain, access points, and seasonal conditions.',
  ),
  page(
    'bay-visit',
    'Blackwater Bay visit plan',
    'Dated visit plan for Blackwater Bay with train times, assigned seats, lodging, and a temporary itinerary.',
  ),
  page(
    'daily-one',
    'Daily note 2040-01-01',
    'Daily template with tasks, meetings, weather, meals, and a short end-of-day reflection.',
  ),
  page(
    'daily-two',
    'Daily note 2040-01-02',
    'Daily template with tasks, meetings, weather, meals, and a short end-of-day reflection.',
  ),
];

const DEVELOPMENT_CASES: MergeDiscoveryBenchCase[] = [
  benchCase('person-near-purpose', 'near_purpose', 'candidate', 'ada-profile', 'ada-notes'),
  benchCase('product-near-purpose', 'near_purpose', 'candidate', 'zephyr-profile', 'zephyr-notes'),
  benchCase('organization-near-purpose', 'duplicate', 'candidate', 'vulpine-profile', 'vulpine-notes'),
  benchCase('place-near-purpose', 'near_purpose', 'candidate', 'bay-profile', 'bay-notes'),
  benchCase('person-project-scope', 'related_scope', 'keep_separate', 'ada-profile', 'ada-project'),
  benchCase('product-warranty-scope', 'related_scope', 'keep_separate', 'zephyr-profile', 'zephyr-warranty'),
  benchCase(
    'organization-claims-scope',
    'related_scope',
    'keep_separate',
    'vulpine-profile',
    'vulpine-claims',
  ),
  benchCase('place-visit-scope', 'related_scope', 'keep_separate', 'bay-profile', 'bay-visit'),
  benchCase('person-template', 'template', 'keep_separate', 'ada-profile', 'bo-profile'),
  benchCase('daily-template', 'template', 'keep_separate', 'daily-one', 'daily-two'),
  benchCase('person-identity-collision', 'entity_collision', 'keep_separate', 'ada-profile', 'bo-reference'),
  benchCase(
    'product-program-collision',
    'entity_collision',
    'keep_separate',
    'zephyr-profile',
    'vulpine-zephyr-program',
  ),
];

const TEST_PAGES: MergeDiscoveryBenchPage[] = [
  page(
    'test-ada-overview',
    'Ada Marlow overview',
    'Long-lived identity and preference record for Ada Marlow, including Blackwater Bay access and a brass compass.',
  ),
  page(
    'test-ada-reference',
    'Ada Marlow reference',
    'Stable additional details about Ada Marlow, including Vulpine Mutual contacts and Zephyr QX-100 ownership.',
  ),
  page(
    'test-ada-renewal',
    'Ada Marlow renewal checklist',
    'A bounded renewal checklist for Ada Marlow with open tasks, submission dates, required files, and completion state.',
  ),
  page(
    'test-bo-overview',
    'Bo Winters overview',
    'Long-lived identity and preference record for Bo Winters, including Blackwater Bay access and a silver compass.',
  ),
  page(
    'test-bo-reference',
    'Bo Winters reference notes',
    'Stable additional details about Bo Winters, including Vulpine Mutual contacts and Zephyr QX-100 ownership.',
  ),
  page(
    'test-bo-visit',
    'Bo Winters Blackwater Bay visit',
    'A dated Blackwater Bay visit for Bo Winters with train times, assigned seats, lodging, and temporary tasks.',
  ),
  page(
    'test-zephyr-catalog',
    'Zephyr QX-100 catalog',
    'Durable canonical record for the Zephyr QX-100, its identity, materials, dimensions, and manufacturer.',
  ),
  page(
    'test-zephyr-characteristics',
    'Zephyr QX-100 characteristics',
    'Stable supplementary attributes of the Zephyr QX-100, including construction, measurements, and operating limits.',
  ),
  page(
    'test-zephyr-maintenance',
    'Zephyr QX-100 maintenance procedure',
    'A repeatable maintenance procedure for the Zephyr QX-100 with ordered steps, tools, checks, and escalation rules.',
  ),
  page(
    'test-vulpine-directory',
    'Vulpine Mutual directory',
    'Durable organization record for Vulpine Mutual, including its identity, departments, regions, and public channels.',
  ),
  page(
    'test-vulpine-reference',
    'Vulpine Mutual reference notes',
    'Stable supplementary facts about Vulpine Mutual, including services, office roles, and durable contact routes.',
  ),
  page(
    'test-vulpine-appeal',
    'Vulpine Mutual appeal workflow',
    'A scoped appeal workflow for Vulpine Mutual with filing stages, evidence requirements, deadlines, and outcomes.',
  ),
  page(
    'test-bay-guide',
    'Blackwater Bay guide',
    'Durable place record for Blackwater Bay, including terrain, access points, weather patterns, and orientation.',
  ),
  page(
    'test-bay-reference',
    'Blackwater Bay reference notes',
    'Stable supplementary facts about Blackwater Bay, including shoreline conditions and enduring access guidance.',
  ),
  page(
    'test-bay-event',
    'Blackwater Bay visit 2040-02-02',
    'One dated Blackwater Bay visit with attendees, train times, assigned seats, lodging, and a temporary itinerary.',
  ),
  page(
    'test-template-ada',
    'Person record — Ada Marlow',
    'Repeated person template with identity, contact, equipment, preferences, tasks, and an empty notes section.',
  ),
  page(
    'test-template-bo',
    'Person record — Bo Winters',
    'Repeated person template with identity, contact, equipment, preferences, tasks, and an empty notes section.',
  ),
  page(
    'test-vulpine-zephyr-program',
    'Vulpine Mutual Zephyr QX-100 program',
    'A Vulpine Mutual training program that refers to Zephyr QX-100 examples; it is not the durable product page.',
  ),
];

const TEST_CASES: MergeDiscoveryBenchCase[] = [
  benchCase(
    'test-person-near-purpose',
    'near_purpose',
    'candidate',
    'test-ada-overview',
    'test-ada-reference',
  ),
  benchCase(
    'test-second-person-near-purpose',
    'duplicate',
    'candidate',
    'test-bo-overview',
    'test-bo-reference',
  ),
  benchCase(
    'test-product-near-purpose',
    'near_purpose',
    'candidate',
    'test-zephyr-catalog',
    'test-zephyr-characteristics',
  ),
  benchCase(
    'test-organization-near-purpose',
    'near_purpose',
    'candidate',
    'test-vulpine-directory',
    'test-vulpine-reference',
  ),
  benchCase('test-place-near-purpose', 'duplicate', 'candidate', 'test-bay-guide', 'test-bay-reference'),
  benchCase(
    'test-person-renewal-scope',
    'related_scope',
    'keep_separate',
    'test-ada-overview',
    'test-ada-renewal',
  ),
  benchCase('test-person-visit-scope', 'related_scope', 'keep_separate', 'test-bo-overview', 'test-bo-visit'),
  benchCase(
    'test-product-procedure-scope',
    'related_scope',
    'keep_separate',
    'test-zephyr-catalog',
    'test-zephyr-maintenance',
  ),
  benchCase(
    'test-organization-workflow-scope',
    'related_scope',
    'keep_separate',
    'test-vulpine-directory',
    'test-vulpine-appeal',
  ),
  benchCase('test-place-event-scope', 'related_scope', 'keep_separate', 'test-bay-guide', 'test-bay-event'),
  benchCase('test-person-template', 'template', 'keep_separate', 'test-template-ada', 'test-template-bo'),
  benchCase(
    'test-product-program-collision',
    'entity_collision',
    'keep_separate',
    'test-zephyr-catalog',
    'test-vulpine-zephyr-program',
  ),
];

export function mergeDiscoveryCorpus(split: MergeDiscoverySplit): MergeDiscoveryCorpus {
  return split === 'test'
    ? { split, frozen: true, pages: TEST_PAGES, cases: TEST_CASES }
    : { split, frozen: false, pages: DEVELOPMENT_PAGES, cases: DEVELOPMENT_CASES };
}

export function mergeDiscoveryCorpusFingerprint(corpus: MergeDiscoveryCorpus): string {
  return sha256(
    JSON.stringify({
      version: MERGE_DISCOVERY_CORPUS_VERSION,
      split: corpus.split,
      pages: corpus.pages,
      cases: corpus.cases,
    }),
  );
}

function page(id: string, title: string, summary: string): MergeDiscoveryBenchPage {
  return { id, text: `# ${title}\n\n${summary}` };
}

function benchCase(
  id: string,
  category: MergeDiscoveryCategory,
  expected: MergeDiscoveryBenchCase['expected'],
  left: string,
  right: string,
): MergeDiscoveryBenchCase {
  return { id, category, expected, left, right };
}

import { AdoptInput, AknoError, type AdoptOutput } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { planOrphanAdoptions } from '../maintenance/adopt.ts';
import {
  applyMaintenancePlan,
  createAdoptionPlan,
  decideMaintenancePlanWithCurator,
  type MaintenanceItem,
  type MaintenancePlan,
} from '../maintenance/plans.ts';
import { captureMaintenanceSnapshot } from '../maintenance/runs.ts';
import { effectiveTransformPolicy, policyMode } from '../maintenance/profile.ts';

interface DocumentState {
  id: string;
  page_id: string | null;
  readable: number;
  page_slug: string | null;
  availability: 'available' | 'missing';
  group_missing: number;
}

/**
 * Plan one document group's filing page through the configured trust policy.
 *
 * This is intentionally separate from the bulk dream phase. A recall card names one stable
 * document, and invoking its action must not turn every other orphan in the knowledge base into
 * an implicit batch. Review decisions remain outside the op surface, so an agent can propose a
 * guarded change but cannot approve its own review-mode plan.
 */
export async function adopt(ctx: AknoContext, rawInput: unknown): Promise<AdoptOutput> {
  const input = AdoptInput.parse(rawInput);
  const document = ctx.store.db
    .prepare(
      `SELECT d.id, d.page_id, d.text IS NOT NULL AS readable, p.slug AS page_slug,
              d.availability,
              EXISTS(
                SELECT 1 FROM documents peer
                 WHERE peer.renders IS NULL
                   AND COALESCE(peer.group_key, peer.rel_path) = COALESCE(d.group_key, d.rel_path)
                   AND peer.availability = 'missing'
              ) AS group_missing
         FROM documents d LEFT JOIN pages p ON p.id = d.page_id
        WHERE d.id = ?`,
    )
    .get(input.documentId) as DocumentState | undefined;

  if (!document) throw new AknoError('not_found', `no document with id ${input.documentId}`);
  if (document.page_id) {
    return {
      status: 'ok',
      outcome: 'noop',
      document_id: document.id,
      ...(document.page_slug ? { slug: document.page_slug } : {}),
      reason: 'the document already belongs to a page',
    };
  }
  if (document.availability !== 'available' || document.group_missing === 1) {
    return {
      status: 'ok',
      outcome: 'blocked',
      document_id: document.id,
      reason: 'one or more original document files are missing; restore them before creating a filing page',
    };
  }
  if (document.readable !== 1) {
    return {
      status: 'ok',
      outcome: 'blocked',
      document_id: document.id,
      reason: 'the document has no readable indexed text from which to make a filing page',
    };
  }

  const itemPolicy = policyMode(effectiveTransformPolicy(ctx.config, 'adopt'));
  const mode = itemPolicy;
  if (!mode) {
    return {
      status: 'ok',
      outcome: 'disabled',
      document_id: document.id,
      reason: 'document adoption policy is off',
    };
  }

  const planned = await planOrphanAdoptions(ctx, { limit: 1, documentId: document.id });
  const report = planned.adopted[0];
  const draft = planned.drafts[0];
  if (!report || !draft) {
    return {
      status: 'ok',
      outcome: report?.action === 'rejected' ? 'rejected' : 'blocked',
      document_id: document.id,
      ...(report?.slug ? { slug: report.slug } : {}),
      reason: report?.reason ?? 'the selected document is no longer an eligible readable orphan',
    };
  }

  const modelId = ctx.config.maintenance.model?.id ?? ctx.config.models.derive.id;
  let plan = createAdoptionPlan(
    ctx,
    mode,
    [draft],
    captureMaintenanceSnapshot(ctx, ['adopt'], modelId),
    itemPolicy,
  );
  if (!plan) {
    throw new AknoError('internal', 'the selected adoption produced no maintenance plan');
  }

  if (mode === 'auto' && plan.items.some((item) => item.status === 'proposed' && item.policy === 'auto')) {
    plan = await decideMaintenancePlanWithCurator(ctx, plan.id);
  }
  if (
    mode === 'auto' &&
    plan.items.some((item) => ['approved', 'applying', 'verification_pending'].includes(item.status))
  ) {
    plan = (await applyMaintenancePlan(ctx, plan.id)).plan;
  }

  const item = plan.items.find((candidate) =>
    candidate.evidence.some(
      (evidence) => evidence.type === 'document' && evidence.documentId === document.id,
    ),
  );
  if (!item) throw new AknoError('internal', 'the adoption plan lost the selected document identity');
  return adoptionResult(
    document.id,
    draft.documents.map((entry) => entry.id),
    draft.relPath,
    plan,
    item,
  );
}

function adoptionResult(
  documentId: string,
  documentIds: string[],
  relPath: string,
  plan: MaintenancePlan,
  item: MaintenanceItem,
): AdoptOutput {
  const common = {
    status: 'ok' as const,
    document_id: documentId,
    document_ids: documentIds,
    slug: item.subject,
    rel_path: relPath,
    ...(item.changeId ? { change_id: item.changeId } : {}),
    plan: {
      id: plan.id,
      mode: plan.mode,
      status: plan.status,
      item_id: item.id,
      item_status: item.status,
    },
  };
  const reason = item.verification?.detail ?? item.decision?.reason ?? item.statusReason ?? undefined;

  switch (item.status) {
    case 'applied':
      return { ...common, outcome: 'created', ...(reason ? { reason } : {}) };
    case 'verification_pending':
      return { ...common, outcome: 'verification_pending', ...(reason ? { reason } : {}) };
    case 'rejected':
      return { ...common, outcome: 'rejected', ...(reason ? { reason } : {}) };
    case 'blocked':
    case 'stale':
    case 'verification_failed':
      return {
        ...common,
        outcome: 'blocked',
        reason: reason ?? `the maintenance item is ${item.status}`,
      };
    case 'proposed':
      return plan.mode === 'review'
        ? { ...common, outcome: 'requires_review' }
        : { ...common, outcome: 'planned' };
    default:
      return {
        ...common,
        outcome: 'blocked',
        reason: reason ?? `the maintenance item is ${item.status}`,
      };
  }
}

import { describe, expect, it } from 'vitest';
import { inferMemoryView, memoryEligibleForView, type MemorySemantics } from './intent.ts';

const factual: MemorySemantics = {
  kind: 'claim',
  commitment: 'asserted',
  disposition: 'active',
  basis: 'self_attested',
  answerEligible: true,
};

describe('memory-view inference', () => {
  it.each([
    ['What did Bo Winters report about the warranty?', 'reports'],
    ['Which open questions remain about calibration?', 'questions'],
    ['What hypothetical scenario was discussed?', 'discussion'],
    ['What tentative beliefs were discussed about the warranty?', 'discussion'],
    ['What tentative display check did the assistant suggest may be included?', 'reports'],
    ['What preliminary inspection did the assistant indicate might be required?', 'reports'],
    ['The assistant tentatively suggested that a check may be required.', 'reports'],
    ['The assistant tentatively suggested that the check should be performed.', 'factual'],
    ['The assistant tentatively suggested that we inspect it and it may fail.', 'factual'],
    ['What tentative display check failed and did the assistant suggest may be included?', 'factual'],
    ['What tentative display check failed while did the assistant suggest may be included?', 'factual'],
    ['What check did the assistant suggest?', 'factual'],
    ['What tentative check is required? The assistant suggested a title.', 'factual'],
    ['What tentative check is required, while the assistant suggests a title?', 'factual'],
    ['What tentative device did the assistant suggest buying?', 'factual'],
    ['What fictional warranty example was discussed?', 'discussion'],
    ['What fictional example was discussed?', 'discussion'],
    ['What fictional casing promise did Ada Marlow propose discussing?', 'discussion'],
    ['What casing promise did Ada Marlow make?', 'factual'],
    ['What fictional display and real promise did Ada Marlow describe?', 'factual'],
    ['What fictional casing promise did Ada Marlow reject?', 'discussion'],
    ['Which competing hypotheses were discussed about service intervals?', 'discussion'],
    ['What open warranty question remains?', 'questions'],
    ['What unanswered repair-cost question was recorded?', 'questions'],
    ['Which unresolved warranty inspection question remains?', 'questions'],
    ['What question does the warranty answer?', 'factual'],
    ['What warranty review was proposed?', 'planning'],
    ['Show the decision history for the contract.', 'history'],
    ['Which inspection proposal did Ada Marlow reject?', 'history'],
    ['Which proposal was Ada Marlow rejecting?', 'history'],
    ['Which proposal does Ada Marlow reject?', 'history'],
    ['What is the planned inspection schedule?', 'planning'],
    ['Which inspection offer did Ada Marlow decline?', 'history'],
    ['Ada Marlow declined the optional inspection offer.', 'history'],
    ['Which competing rattle explanations did Ada Marlow discuss?', 'discussion'],
    ['What caused the measured decline in output?', 'factual'],
    ['Does this offer record a decline in power?', 'factual'],
    ['How long is the warranty?', 'factual'],
    ['Что сообщил Bo Winters о гарантии?', 'reports'],
    ['Что Ada Marlow записала со слов Bo Winters о ремонте?', 'reports'],
    ['Какие слова есть в описании гарантии?', 'factual'],
    ['Какие открытые вопросы остались?', 'questions'],
    ['Какие гипотезы обсуждались о гарантии?', 'discussion'],
    ['Какие решения отклонены?', 'history'],
    ['Какие планы связаны с осмотром?', 'planning'],
    ['Какое неподтверждённое сообщение о диагностике записала Ada Marlow?', 'reports'],
    ['Какое предварительное сообщение дал ассистент?', 'reports'],
    ['Какое неподтверждённое сообщение об осмотре пересказала Ada Marlow?', 'reports'],
    ['Ada Marlow пересказывает непроверенное сообщение об осмотре?', 'reports'],
    ['Какую предварительную версию о проверке дисплея предложил ассистент?', 'reports'],
    ['Ассистент предложил предварительное предположение о покрытии?', 'reports'],
    ['Какую предварительную версию корпуса выпустили?', 'factual'],
    ['Какую версию корпуса предложил ассистент?', 'planning'],
    ['Какую предварительную версию корпуса выпустили? Ассистент предложил осмотр.', 'planning'],
    ['Какое предварительное сообщение появилось? Ada Marlow пересказала рассказ.', 'factual'],
    ['Какое предварительное сообщение появилось и Ada Marlow пересказала рассказ?', 'factual'],
    ['Какое предварительное устройство и сообщение пересказала Ada Marlow?', 'factual'],
    ['Какой несостоявшийся вариант корпуса исчез пока Ada Marlow описала цвет?', 'factual'],
    ['Какое предварительное сообщение появилось, пока Ada Marlow пересказала рассказ?', 'factual'],
    ['Какой рассказ пересказала Ada Marlow?', 'factual'],
    ['Какой несостоявшийся вариант обслуживания описала Ada Marlow?', 'discussion'],
    ['Какой несостоявшийся вариант корпуса сняли с производства?', 'factual'],
    ['Какой несостоявшийся вариант корпуса исчез? Ada Marlow описала цвет.', 'factual'],
    ['Какое вымышленное обещание о крышке предложила обсудить Ada Marlow?', 'discussion'],
    ['Какое обещание о крышке дала Ada Marlow?', 'factual'],
    ['Какой нереализованный вариант обслуживания описала Ada Marlow?', 'discussion'],
    ['Какое сообщение об ошибке показал Zephyr QX-100?', 'factual'],
    ['Какое предварительное сообщение об ошибке показал Zephyr QX-100?', 'factual'],
    ['Какой нереализованный вариант корпуса сняли с производства?', 'factual'],
    [
      'Какое предварительное сообщение об ошибке показал Zephyr QX-100, пока Ada Marlow дала Bo Winters устройство?',
      'factual',
    ],
    ['Какой нереализованный вариант корпуса исчез, пока Ada Marlow описала цвет?', 'factual'],
    ['Ada Marlow записала неподтверждённое сообщение о диагностике?', 'reports'],
    ['Ada Marlow описала нереализованный вариант обслуживания?', 'discussion'],
    ['Какое неподтверждённое сообщение появилось? Ada Marlow записала номер.', 'factual'],
    ['Какой нереализованный вариант корпуса исчез? Ada Marlow описала цвет.', 'factual'],
    ['Нужно ли предварительное обслуживание Zephyr QX-100?', 'factual'],
    ['Каков срок гарантии?', 'factual'],
    ['Включает ли гарантия замену корпуса?', 'factual'],
    ['Какую проверку гарантии предложили?', 'planning'],
    ['Какая деталь была заменена?', 'history'],
  ] as const)('infers %s as %s', (query, view) => {
    expect(inferMemoryView(query)).toBe(view);
  });

  it('broadens an otherwise ambiguous explore request without broadening lookup', () => {
    expect(inferMemoryView('Zephyr QX-100', 'lookup')).toBe('factual');
    expect(inferMemoryView('Zephyr QX-100', 'explore')).toBe('all');
  });
});

describe('memory-view eligibility', () => {
  it('keeps canonical facts narrow and exposes noncanonical memory only in its own view', () => {
    const report = { ...factual, basis: 'source_report' as const, answerEligible: false };
    const proposal = {
      ...factual,
      kind: 'plan' as const,
      disposition: 'proposed' as const,
      answerEligible: false,
    };
    const question = {
      ...factual,
      kind: 'question' as const,
      commitment: 'none' as const,
      answerEligible: false,
    };
    const hypothetical = {
      ...factual,
      commitment: 'hypothetical' as const,
      answerEligible: false,
    };

    expect(memoryEligibleForView(factual, 'factual')).toBe(true);
    expect(memoryEligibleForView(report, 'factual')).toBe(false);
    expect(memoryEligibleForView(report, 'reports')).toBe(true);
    expect(memoryEligibleForView(proposal, 'planning')).toBe(true);
    expect(memoryEligibleForView(proposal, 'discussion')).toBe(true);
    expect(memoryEligibleForView(question, 'questions')).toBe(true);
    expect(memoryEligibleForView(hypothetical, 'discussion')).toBe(true);
    expect(memoryEligibleForView(hypothetical, 'all')).toBe(true);
  });
});

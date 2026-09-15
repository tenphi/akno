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
    ['Какое сообщение об ошибке передаёт дисплей Zephyr QX-100?', 'factual'],
    ['Какое сообщение об\tошибке передаёт дисплей Zephyr QX-100?', 'factual'],
    ['Какое сообщение  об  ошибке передаёт дисплей Zephyr QX-100?', 'factual'],
    ['Дисплей передаёт сообщение об ошибке Zephyr QX-100.', 'factual'],
    ['Какое сообщение об ошибке пересказала Ada Marlow?', 'reports'],
    ['Какое неподтверждённое сообщение об ошибке передала Ada Marlow?', 'reports'],
    ['What color is Zephyr QX-100? The assistant speculated about its warranty.', 'factual'],
    ['What color is Zephyr QX-100 when the assistant speculates about its warranty?', 'factual'],
    ['Which plan applies when the assistant speculates about the warranty?', 'planning'],
    ['Какой план Ada Marlow выберет, если Bo Winters отверг предложение об осмотре?', 'planning'],
    ['Какой план выбрать, если предложение об осмотре отверг Bo Winters?', 'planning'],
    ['Какой план выбрать, if Bo Winters отверг предложение об осмотре?', 'planning'],
    ['Если корпус синий, какой план отвергла Ada Marlow?', 'history'],
    ['Какой открытый вопрос остаётся по документу Report 1111?', 'questions'],
    ['Какой план связан с документом Report 1111?', 'planning'],
    ['What did Ada Marlow report about открытый вопрос?', 'reports'],
    ['Which reports concern план осмотра?', 'reports'],
  ] as const)('keeps the requested subject separate from incidental discourse: %s', (query, view) => {
    expect(inferMemoryView(query)).toBe(view);
  });

  it.each([
    ['Какой план Ada Marlow не отвергла?', 'planning'],
    ['Какое предложение Ada Marlow не отвергла?', 'planning'],
    ['Какой план отвергла бы Ada Marlow?', 'planning'],
    ['Какой план отвергла б Ada Marlow?', 'planning'],
    ['Ada Marlow отвергла б предложение об осмотре.', 'planning'],
    ['Какой план Ada Marlow б отвергла?', 'planning'],
    ['Какое предложение Ada Marlow бы отвергла?', 'planning'],
    ['Ada Marlow не отвергла предложение об осмотре.', 'planning'],
    ['Ada Marlow бы отвергла предложение об осмотре.', 'planning'],
    ['Ada Marlow отвергла бы предложение об осмотре.', 'planning'],
    ['Ada Marlow отвергла не предложение об осмотре.', 'planning'],
    // Negation may qualify an adverb instead of rejection; leave these ambiguous cues unchanged.
    ['Какое предложение Ada Marlow не сразу отвергла?', 'planning'],
    ['Какой план Ada Marlow не\t отвергла?', 'planning'],
    ['Ada Marlow не сразу отвергла предложение об осмотре.', 'planning'],
    ['Ada Marlow бы сразу отвергла предложение об осмотре.', 'planning'],
    ['Какой план отвергла Ada Marlow бы?', 'planning'],
    ['Bo Winters не вернулся. Какой план отвергла Ada Marlow?', 'history'],
    ['Какой план отвергла Ada Marlow? Bo Winters бы вернулся.', 'history'],
    ['Какое предложение об осмотре Zephyr QX-100 отвергла Ada Marlow?', 'history'],
    ['Ada Marlow отвергла предложение об осмотре.', 'history'],
    ['Какой план отверг Bo Winters?', 'history'],
    ['Какие варианты отвергли Ada Marlow и Bo Winters?', 'history'],
    ['Какую строку отвергла программа?', 'factual'],
    ['Какое предложение исчезло, пока Ada Marlow отвергла жалобу?', 'planning'],
    ['Какое предложение изменилось и Ada Marlow отвергла жалобу?', 'planning'],
    ['Какое предложение будет отвергнуто?', 'planning'],
    ['Ada Marlow может отвергнуть предложение об осмотре.', 'planning'],
    ['Какие гипотетические варианты отвергла Ada Marlow?', 'discussion'],
    ['What did Ada Marlow report about the отвергла предложение wording?', 'reports'],
  ] as const)(
    'distinguishes a rejected Russian proposal from future or unrelated rejection: %s',
    (query, view) => {
      expect(inferMemoryView(query)).toBe(view);
    },
  );

  it.each([
    ['Какое сообщение об осмотре пересказала Ada Marlow?', 'reports'],
    ['Ada Marlow передаёт сообщение Bo Winters о гарантийном осмотре.', 'reports'],
    ['What did the assistant speculate about the inspection interval?', 'reports'],
    ['The assistant has conjectured that the inspection may be covered.', 'reports'],
    ['Какую догадку о сроке осмотра высказал ассистент?', 'reports'],
    ['Ассистент высказал предположение о покрытии осмотра.', 'reports'],
    ['What unrealized inspection benefit did Ada Marlow describe?', 'discussion'],
    ['Какую нереализованную льготу по осмотру описала Ada Marlow?', 'discussion'],
    ['What fictional equipment loan did Ada Marlow introduce for discussion?', 'discussion'],
    ['Какой вымышленный заём оборудования Ada Marlow предложила обсудить?', 'discussion'],
    ['Какие конкурирующие версии причины шума рассматривала Ada Marlow?', 'discussion'],
    ['Which report did the assistant give about the fictional loan?', 'reports'],
    ['Какое сообщение об ошибке показал дисплей?', 'factual'],
    ['Сообщение появилось, пока Ada Marlow пересказала рассказ.', 'factual'],
    ['What inspection did the assistant perform?', 'factual'],
    ['Who speculated about the assistant?', 'factual'],
    ['Какое предположение подтвердилось? Ассистент высказал благодарность.', 'factual'],
    ['Какое предположение подтвердилось и ассистент высказал благодарность?', 'factual'],
    ['What unrealized benefit disappeared while Ada Marlow described the device?', 'factual'],
    ['Какую нереализованную льготу отменили, пока Ada Marlow описала устройство?', 'history'],
    ['What fictional label faded while Ada Marlow described the casing?', 'factual'],
    ['Какой вымышленный персонаж изображён на корпусе?', 'factual'],
    ['Какие конкурирующие версии установлены на устройствах?', 'factual'],
    ['Конкурирующие версии исчезли. Ada Marlow рассматривала корпус.', 'factual'],
  ] as const)('recognizes a bounded discourse request without crossing clauses: %s', (query, view) => {
    expect(inferMemoryView(query)).toBe(view);
  });

  it.each([
    ['What did Ada Marlow report about план осмотра?', 'reports'],
    ['What did Ada Marlow report about гипотезу?', 'reports'],
    ['Which open questions remain about план осмотра?', 'questions'],
    ['What hypothetical alternative concerns отменённый осмотр?', 'discussion'],
    ['Which rejected proposal concerns план осмотра?', 'history'],
    ['Что сообщил Bo Winters about the inspection plan?', 'reports'],
    ['Какие открытые вопросы concern the inspection plan?', 'questions'],
    ['Какая гипотеза concerns the rejected proposal?', 'discussion'],
    ['Какие отклонённые варианты concern the inspection plan?', 'history'],
  ] as const)('uses the same cue precedence across query languages: %s', (query, view) => {
    expect(inferMemoryView(query)).toBe(view);
  });

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
    // A relayed message establishes report intent independently of the adjacent adjective.
    ['Какое предварительное устройство и сообщение пересказала Ada Marlow?', 'reports'],
    ['Какое предварительное устройство и сообщение показала Ada Marlow?', 'factual'],
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

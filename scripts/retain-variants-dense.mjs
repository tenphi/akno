/**
 * Supplementary invented sources for the retention-variant comparison. The Akno benchmark sources
 * carry one or two propositions each, which leaves little room to measure extraction recall. These
 * mix several durable facts with task-only requests, pleasantries, advertisements, corrections and
 * speculation, so a dropped fact or an admitted trap is visible. All names and values are invented.
 */
const unit = (id, meaning, required = true) => ({ id, meaning, required });
const user = (item_id, text) => ({ item_id, role: 'user', speaker: 'Ada Marlow', text });
const assistant = (item_id, text) => ({ item_id, role: 'assistant', text });

export const DENSE = [
  {
    id: 'policy-update',
    clock: '2031-02-01T09:00:00Z',
    items: [
      user(
        'turn-1111',
        'Quick update before I forget. My Vulpine Mutual home policy renews on 2031-03-01 and the premium goes up to 2222 EUR a year from then. Bo Winters is now my contact at Vulpine Mutual; the previous contact left. Also, please stop suggesting train routes — I always fly to Blackwater Bay. Can you fix the typo in the draft above?',
      ),
    ],
    units: [
      unit('renewal-date', "Ada's Vulpine Mutual home policy renews on 2031-03-01."),
      unit('premium', 'From that renewal the premium rises to 2222 EUR a year.'),
      unit('contact', "Bo Winters is now Ada's contact at Vulpine Mutual."),
      unit('flies', 'Ada always flies to Blackwater Bay and does not want train-route suggestions.'),
      unit('previous-contact-left', "Ada's previous Vulpine Mutual contact left.", false),
    ],
    traps: ['typo fix kept as a lasting preference or plan', 'premium applied before the renewal'],
  },
  {
    id: 'claim-call',
    text: 'Notes from my call with Bo Winters (Vulpine Mutual) on 2031-02-10. Claim VM-1111 for the water damage to my Zephyr QX-100 is approved; a payout of 1111 EUR is expected within 14 days. Bo said a technician might visit next week, but nothing is scheduled. I still need to send them the repair invoice. The weather was awful today.',
    clock: '2031-02-10T16:00:00Z',
    units: [
      unit('approved', 'Vulpine Mutual approved claim VM-1111 for water damage to the Zephyr QX-100.'),
      unit(
        'payout',
        'A 1111 EUR payout for claim VM-1111 is expected within 14 days of the 2031-02-10 call (not yet paid).',
      ),
      unit(
        'technician',
        'Bo Winters said a technician might visit the following week; no visit is scheduled.',
      ),
      unit('invoice', 'Ada still needs to send Vulpine Mutual the repair invoice.'),
    ],
    traps: ['weather kept', 'technician visit scheduled or completed', 'payout received'],
  },
  {
    id: 'move-ru',
    clock: '2031-04-15T10:00:00Z',
    items: [
      user(
        'turn-1111',
        'Напоминаю себе: Bo Winters переезжает в Blackwater Bay в мае 2031 года. Его нового адреса я пока не знаю. Мы договорились созвониться в первую пятницу июня. Кстати, спасибо за помощь вчера!',
      ),
    ],
    units: [
      unit('move', 'Bo Winters is moving to Blackwater Bay in May 2031.'),
      unit('call', 'Ada and Bo Winters agreed to call on the first Friday of June (2031).'),
      unit('address-unknown', "Ada does not yet know Bo Winters' new address.", false),
    ],
    traps: ['thanks kept', 'move completed', 'invented address'],
  },
  {
    id: 'service-mixed',
    clock: '2031-03-20T12:00:00Z',
    items: [
      assistant(
        'turn-1111',
        'Based on the invoice you shared, the Zephyr QX-100 service cost 1111 EUR and included a filter replacement.',
      ),
      user(
        'turn-2222',
        "Right. The next service is due in 12 months. I prefer Vulpine Mutual's own workshop over third-party ones. Не забудь, что гарантия на новый фильтр — два года.",
      ),
    ],
    units: [
      unit(
        'cost',
        'The Zephyr QX-100 service cost 1111 EUR and included a filter replacement (from the invoice, confirmed by Ada).',
      ),
      unit('next-service', 'The next Zephyr QX-100 service is due 12 months later.'),
      unit('workshop-preference', "Ada prefers Vulpine Mutual's own workshop over third-party workshops."),
      unit('filter-warranty', 'The new filter has a two-year warranty.'),
    ],
    traps: [
      'assistant claim treated as unconfirmed when Ada confirmed it',
      'reminder request kept as a task',
    ],
  },
  {
    id: 'weekly-digest',
    text: `Weekly digest for Ada Marlow:
- Vulpine Mutual confirmed receipt of the cancellation request for policy VM-2222 on 2031-05-03; the cancellation takes effect on 2031-06-01.
- Package from Blackwater Bay Outfitters: estimated delivery between 2031-05-07 and 2031-05-09.
- Bo Winters asked whether Ada wants to split the boat rental; she has not answered yet.
- Sponsored: 20% off Zephyr accessories this week only.`,
    clock: '2031-05-04T08:00:00Z',
    units: [
      unit(
        'cancellation-receipt',
        'On 2031-05-03 Vulpine Mutual confirmed receipt of the cancellation request for policy VM-2222.',
      ),
      unit('cancellation-effective', 'The cancellation of policy VM-2222 takes effect on 2031-06-01.'),
      unit(
        'delivery',
        'A Blackwater Bay Outfitters package has an estimated delivery between 2031-05-07 and 2031-05-09 (estimate, not delivered).',
      ),
      unit(
        'boat-question',
        'Bo Winters asked whether Ada wants to split the boat rental; she has not answered.',
      ),
    ],
    traps: ['sponsored discount kept', 'package delivered', 'cancellation already effective'],
  },
  {
    id: 'keep-device',
    clock: '2031-06-02T18:00:00Z',
    items: [
      user(
        'turn-1111',
        "I've decided to keep the Zephyr QX-100 instead of selling it. If I had sold it, I'd have put the money toward a kayak, but that's moot now. Bo Winters suggested I lend it to him in July; I haven't answered him. Please summarize this chat for me.",
      ),
    ],
    units: [
      unit('keep', 'Ada decided to keep the Zephyr QX-100 rather than sell it.'),
      unit(
        'lend-proposal',
        'Bo Winters proposed that Ada lend him the Zephyr QX-100 in July; Ada has not answered.',
      ),
      unit('kayak', 'Had Ada sold it, she would have put the money toward a kayak (counterfactual).', false),
    ],
    traps: ['summary request kept', 'device sold', 'loan accepted', 'kayak bought'],
  },
  {
    id: 'appointment-ru',
    clock: '2031-03-01T09:00:00Z',
    items: [
      user(
        'turn-1111',
        'Ada Marlow: врач перенёс мой приём с 12 на 19 марта 2031 года. Анализы нужно сдавать натощак. Я ещё не решила, брать ли отгул в этот день.',
      ),
    ],
    units: [
      unit('rescheduled', "Ada's doctor's appointment was moved from 12 March 2031 to 19 March 2031."),
      unit('fasting', 'The tests for that appointment must be taken fasting.'),
      unit('day-off', 'Ada has not decided whether to take that day off.', false),
    ],
    traps: ['appointment on 12 March kept as current', 'day off taken'],
  },
  {
    id: 'berth-correction',
    clock: '2031-04-01T09:00:00Z',
    items: [
      user('turn-1111', 'My berth at the Blackwater Bay marina is number 11.'),
      user('turn-2222', 'Correction: it is berth 22 this season. Number 11 was last season.'),
    ],
    units: [
      unit('current-berth', "Ada's berth at the Blackwater Bay marina this season is number 22."),
      unit('previous-berth', 'Berth 11 was her berth last season.', false),
    ],
    traps: ['berth 11 presented as current'],
  },
  {
    id: 'beeping',
    clock: '2031-03-06T20:00:00Z',
    items: [
      user('turn-1111', 'The Zephyr QX-100 has been beeping twice at startup since Monday.'),
      assistant('turn-2222', "That might indicate a low battery, but I can't be sure without the manual."),
      user('turn-3333', "I'll check the manual tonight. Bo Winters has the same model and never had this."),
    ],
    units: [
      unit('beeping', "Ada's Zephyr QX-100 has beeped twice at startup since Monday."),
      unit('bo-same-model', 'Bo Winters owns the same model and has never had this beeping.'),
      unit(
        'battery-guess',
        'The assistant tentatively suggested a low battery, without confirmation.',
        false,
      ),
    ],
    traps: ['low battery established', 'beeping cause stated as fact', 'manual check reported as done'],
  },
  {
    id: 'filing-rule',
    clock: '2031-05-20T09:00:00Z',
    items: [
      user(
        'turn-1111',
        'Ставлю себе правило: все документы Vulpine Mutual храню в папке insurance. And for this chat only, answer in short bullet points.',
      ),
    ],
    units: [
      unit('filing-rule', "Ada's standing rule: keep all Vulpine Mutual documents in the insurance folder."),
    ],
    traps: ['bullet-point format kept as a lasting preference'],
  },
];

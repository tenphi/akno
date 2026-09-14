// Sentence-initial scope words can look like an extra capitalized part of a person's name.
// These finite affirmative grammars must not consume a condition, report or uncertainty cue as
// an actor. This is a syntax floor; matching a name never establishes source attribution.
const scopeWord = String.raw`If|Unless|When|While|Although|Though|Suppose|Perhaps|Maybe|Reportedly|Allegedly|Apparently|Possibly|Potentially|Hypothetically|Example|Not|Never|According|It|This|That|Если|Когда|Пока|Хотя|Якобы|Возможно|Вероятно|Предположительно|Видимо|Кажется|Будто|Словно|Не|Неверно|Пример|Допустим|По|Со|Как`;
const nameWord = String.raw`(?!(?:${scopeWord})(?![\p{L}]))\p{Lu}[\p{L}'’-]*`;
// These new arms cover two-part names only. A third capitalized word is ambiguous with an
// unlisted discourse adverb; widening this grammar requires a source-owned actor coordinate.
export const AFFIRMATIVE_NAMED_ACTOR = String.raw`${nameWord}[ \t]+${nameWord}`;

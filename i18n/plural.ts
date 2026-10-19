/**
 * Russian plurals have three forms (1 файл, 2 файла, 5 файлов) where English
 * has two, so Russian messages carry one more form than English:
 *   one | few | many            (English: one | other)
 *   zero | one | few | many     (English: zero | one | other)
 */
export function russianPlural(choice: number, choicesLength: number): number {
  const n = Math.abs(choice);
  if (choicesLength >= 4 && n === 0) return 0;
  const offset = choicesLength >= 4 ? 1 : 0;
  // Fewer forms than expected: behave like the default (one | other)
  if (choicesLength - offset < 3) return Math.min(n === 1 ? offset : offset + 1, choicesLength - 1);

  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return offset;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return offset + 1;
  return offset + 2;
}

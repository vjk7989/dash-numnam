export interface RecipeInput {
  title: string;
  summary: string;
  ingredients: string[];
  steps: string[];
  minimumAgeMonths: number;
}

export interface RecipeValidationError {
  field: keyof RecipeInput | 'input';
  message: string;
}

export type RecipeValidationResult =
  | { ok: true; value: RecipeInput }
  | { ok: false; errors: RecipeValidationError[] };

const recipeKeys = new Set<keyof RecipeInput>([
  'title',
  'summary',
  'ingredients',
  'steps',
  'minimumAgeMonths',
]);

export function validateRecipe(input: unknown): RecipeValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: [{ field: 'input', message: 'Recipe must be an object.' }] };
  }

  const record = input as Record<string, unknown>;
  const errors: RecipeValidationError[] = [];
  if (Object.keys(record).some((key) => !recipeKeys.has(key as keyof RecipeInput))) {
    errors.push({ field: 'input', message: 'Recipe contains unknown fields.' });
  }

  const trimText = (field: 'title' | 'summary') => {
    const value = record[field];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push({ field, message: `${field} is required.` });
      return '';
    }
    return value.trim();
  };
  const trimList = (field: 'ingredients' | 'steps') => {
    const value = record[field];
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
      errors.push({ field, message: `${field} must contain non-empty text.` });
      return [];
    }
    return value.map((item) => (item as string).trim());
  };

  const title = trimText('title');
  const summary = trimText('summary');
  const ingredients = trimList('ingredients');
  const steps = trimList('steps');
  const minimumAgeMonths = record.minimumAgeMonths;
  if (typeof minimumAgeMonths !== 'number' || !Number.isInteger(minimumAgeMonths) || minimumAgeMonths < 0) {
    errors.push({ field: 'minimumAgeMonths', message: 'minimumAgeMonths must be a non-negative integer.' });
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { title, summary, ingredients, steps, minimumAgeMonths: minimumAgeMonths as number },
  };
}

export class RecipeVersionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`Recipe version conflict: expected ${expected}, received ${actual}.`);
    this.name = 'RecipeVersionConflictError';
  }
}

export function assertRecipeVersion(expected: number, actual: number): void {
  if (expected !== actual) throw new RecipeVersionConflictError(expected, actual);
}


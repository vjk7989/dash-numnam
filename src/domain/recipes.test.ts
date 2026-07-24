import { describe, expect, it } from 'vitest';
import { RecipeVersionConflictError, assertRecipeVersion, validateRecipe } from './recipes';

const validRecipe = {
  title: 'Carrot Lentil Bowl',
  summary: 'A soft lentil meal for established eaters.',
  ingredients: ['red lentils', 'carrot', 'water'],
  steps: ['Rinse ingredients.', 'Cook until soft.', 'Mash to an age-appropriate texture.'],
  minimumAgeMonths: 8,
};

describe('recipe validation', () => {
  it('accepts a complete recipe and trims user-entered strings', () => {
    expect(validateRecipe({ ...validRecipe, title: `  ${validRecipe.title}  ` })).toEqual({
      ok: true,
      value: validRecipe,
    });
  });

  it.each([
    ['blank title', { ...validRecipe, title: '   ' }, 'title'],
    ['missing ingredients', { ...validRecipe, ingredients: [] }, 'ingredients'],
    ['blank ingredient', { ...validRecipe, ingredients: ['carrot', ' '] }, 'ingredients'],
    ['missing steps', { ...validRecipe, steps: [] }, 'steps'],
    ['negative minimum age', { ...validRecipe, minimumAgeMonths: -1 }, 'minimumAgeMonths'],
    ['fractional minimum age', { ...validRecipe, minimumAgeMonths: 7.5 }, 'minimumAgeMonths'],
  ])('rejects %s', (_name, input, field) => {
    const result = validateRecipe(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.field === field)).toBe(true);
    }
  });

  it('rejects unknown fields instead of silently persisting them', () => {
    const result = validateRecipe({ ...validRecipe, serviceRoleKey: 'must-not-be-stored' });
    expect(result.ok).toBe(false);
  });
});

describe('recipe optimistic concurrency', () => {
  it('accepts a matching expected version', () => {
    expect(() => assertRecipeVersion(3, 3)).not.toThrow();
  });

  it('raises a typed conflict when another writer changed the recipe', () => {
    expect(() => assertRecipeVersion(3, 4)).toThrow(RecipeVersionConflictError);
  });
});

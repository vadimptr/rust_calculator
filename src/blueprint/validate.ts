/**
 * Разбор и проверка документа: JSON → схема (ajv) → структурные правила и геометрия.
 */
import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import schema from '../../docs/blueprint/schema/blueprint.schema.json';
import { resolveBlueprint } from './geometry.ts';
import type { Blueprint, Issue, Resolved } from './types.ts';

const ajv = new Ajv2020({ strict: true, strictRequired: false, validateFormats: false, allErrors: true });
const validateSchema = ajv.compile<Blueprint>(schema);

export interface LoadResult {
  blueprint: Blueprint | null;
  resolved: Resolved | null;
  issues: Issue[];
}

function schemaIssue(e: ErrorObject): Issue {
  const path = e.instancePath || '/';
  return { code: 'SCHEMA', level: 'error', message: `${path}: ${e.message ?? 'неверное значение'}` };
}

/** Проверить уже разобранный объект. */
export function loadBlueprint(data: unknown): LoadResult {
  if (!validateSchema(data)) {
    const issues = (validateSchema.errors ?? []).slice(0, 20).map(schemaIssue);
    return { blueprint: null, resolved: null, issues };
  }
  const { resolved, issues } = resolveBlueprint(data);
  const hasErrors = issues.some(i => i.level === 'error');
  return { blueprint: data, resolved: hasErrors ? null : resolved, issues };
}

/** Разобрать текст файла. */
export function parseBlueprint(text: string): LoadResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return {
      blueprint: null, resolved: null,
      issues: [{ code: 'JSON', level: 'error', message: `Файл не является корректным JSON: ${(e as Error).message}` }],
    };
  }
  return loadBlueprint(data);
}

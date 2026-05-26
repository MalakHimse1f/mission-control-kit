/**
 * v5 decisions.json schema (canonical — per §3.4 and §9.3 of REFACTOR-REQUIREMENTS.md).
 *
 * Hand-rolled validator (no ajv dependency) because the schema is small and
 * we want zero external deps.
 */

export const PHASE_KEYS = ['ux', 'ui', 'architecture'];
export const PHASE_STATUSES = ['complete', 'in-progress', 'not-started'];

/**
 * Plain-object description of the schema. Consumers (and humans) can introspect
 * this to know required keys and allowed values without re-reading the validator.
 */
export const DECISIONS_SCHEMA = {
  type: 'object',
  required: ['feature', 'phases', 'deferred', 'updatedAt'],
  properties: {
    feature: { type: 'string', description: 'Slug identifying the feature' },
    phases: {
      type: 'object',
      required: PHASE_KEYS,
      properties: Object.fromEntries(
        PHASE_KEYS.map((key) => [
          key,
          {
            type: 'object',
            required: ['status', 'decisions', 'pending'],
            properties: {
              status: { type: 'string', enum: PHASE_STATUSES },
              decisions: { type: 'array', items: { $ref: '#/definitions/decision' } },
              pending: { type: 'array', items: { type: 'string' } },
            },
          },
        ]),
      ),
    },
    deferred: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'raisedDuring', 'raisedAt'],
        properties: {
          question: { type: 'string' },
          raisedDuring: { type: 'string', enum: PHASE_KEYS },
          raisedAt: { type: 'string', description: 'ISO-8601 timestamp' },
        },
      },
    },
    updatedAt: { type: 'string', description: 'ISO-8601 timestamp' },
  },
  definitions: {
    decision: {
      type: 'object',
      required: ['id', 'category', 'question', 'options', 'selected', 'decidedAt'],
      properties: {
        id: { type: 'string' },
        category: { type: 'string', description: 'Free string; conventional: ui|ux|engineering' },
        question: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } },
        selected: { type: 'string' },
        decidedAt: { type: 'string', description: 'ISO-8601 timestamp' },
      },
    },
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateDecision(decision, errors, pathPrefix) {
  if (!isPlainObject(decision)) {
    errors.push(`${pathPrefix}: expected object, got ${typeof decision}`);
    return;
  }
  for (const key of ['id', 'category', 'question', 'selected', 'decidedAt']) {
    if (typeof decision[key] !== 'string' || decision[key].length === 0) {
      errors.push(`${pathPrefix}.${key}: expected non-empty string`);
    }
  }
  if (!Array.isArray(decision.options)) {
    errors.push(`${pathPrefix}.options: expected array`);
  } else {
    decision.options.forEach((opt, i) => {
      if (typeof opt !== 'string') {
        errors.push(`${pathPrefix}.options[${i}]: expected string`);
      }
    });
  }
}

function validatePhase(phase, key, errors) {
  const prefix = `phases.${key}`;
  if (!isPlainObject(phase)) {
    errors.push(`${prefix}: expected object`);
    return;
  }
  if (!PHASE_STATUSES.includes(phase.status)) {
    errors.push(
      `${prefix}.status: invalid status "${phase.status}"; expected one of ${PHASE_STATUSES.join('|')}`,
    );
  }
  if (!Array.isArray(phase.decisions)) {
    errors.push(`${prefix}.decisions: expected array`);
  } else {
    phase.decisions.forEach((d, i) => validateDecision(d, errors, `${prefix}.decisions[${i}]`));
  }
  if (!Array.isArray(phase.pending)) {
    errors.push(`${prefix}.pending: expected array`);
  } else {
    phase.pending.forEach((p, i) => {
      if (typeof p !== 'string') {
        errors.push(`${prefix}.pending[${i}]: expected string`);
      }
    });
  }
}

function validateDeferredEntry(entry, errors, pathPrefix) {
  if (!isPlainObject(entry)) {
    errors.push(`${pathPrefix}: expected object`);
    return;
  }
  if (typeof entry.question !== 'string' || entry.question.length === 0) {
    errors.push(`${pathPrefix}.question: expected non-empty string`);
  }
  if (!PHASE_KEYS.includes(entry.raisedDuring)) {
    errors.push(
      `${pathPrefix}.raisedDuring: invalid value "${entry.raisedDuring}"; expected one of ${PHASE_KEYS.join('|')}`,
    );
  }
  if (typeof entry.raisedAt !== 'string' || entry.raisedAt.length === 0) {
    errors.push(`${pathPrefix}.raisedAt: expected non-empty ISO-8601 string`);
  }
}

/**
 * Validates a decisions.json payload against the canonical schema.
 *
 * @param {unknown} obj - parsed JSON object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDecisions(obj) {
  const errors = [];
  if (!isPlainObject(obj)) {
    return { valid: false, errors: ['root: expected object'] };
  }

  if (typeof obj.feature !== 'string' || obj.feature.length === 0) {
    errors.push('feature: missing or not a non-empty string');
  }

  if (!isPlainObject(obj.phases)) {
    errors.push('phases: expected object with ux, ui, architecture keys');
  } else {
    for (const key of PHASE_KEYS) {
      if (!(key in obj.phases)) {
        errors.push(`phases.${key}: missing required phase`);
        continue;
      }
      validatePhase(obj.phases[key], key, errors);
    }
  }

  if (!Array.isArray(obj.deferred)) {
    errors.push('deferred: expected array');
  } else {
    obj.deferred.forEach((entry, i) => validateDeferredEntry(entry, errors, `deferred[${i}]`));
  }

  if (typeof obj.updatedAt !== 'string' || obj.updatedAt.length === 0) {
    errors.push('updatedAt: expected non-empty ISO-8601 string');
  }

  return { valid: errors.length === 0, errors };
}

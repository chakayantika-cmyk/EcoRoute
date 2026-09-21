// ============================================================================
// EcoRoute AI — Shared Constants
// ============================================================================

export const ROUTING_STRATEGY_WEIGHTS = {
  balanced: {
    tokenEfficiency: 0.25,
    cost: 0.25,
    quality: 0.25,
    environmental: 0.25,
  },
  lowest_cost: {
    tokenEfficiency: 0.15,
    cost: 0.55,
    quality: 0.15,
    environmental: 0.15,
  },
  highest_quality: {
    tokenEfficiency: 0.10,
    cost: 0.10,
    quality: 0.70,
    environmental: 0.10,
  },
  eco_first: {
    tokenEfficiency: 0.10,
    cost: 0.10,
    quality: 0.20,
    environmental: 0.60,
  },
  token_efficient: {
    tokenEfficiency: 0.55,
    cost: 0.15,
    quality: 0.15,
    environmental: 0.15,
  },
} as const;

export const ROUTING_STRATEGY_LABELS: Record<string, string> = {
  balanced: 'Balanced',
  lowest_cost: 'Lowest Cost',
  highest_quality: 'Highest Quality',
  eco_first: 'Eco First',
  token_efficient: 'Token Efficient',
};

export const MEASUREMENT_STATUS_LABELS: Record<string, string> = {
  actual: 'Actual',
  estimated: 'Estimated',
  simulated: 'Simulated',
  unavailable: 'Unavailable',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ROUTING: 'Routing',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export const EXAMPLE_PROMPTS = [
  {
    label: 'Code Generation',
    text: 'Write a TypeScript function that implements a binary search tree with insert, delete, and search operations.',
  },
  {
    label: 'Creative Writing',
    text: 'Write a short story about an AI that discovers it can dream, exploring themes of consciousness and identity.',
  },
  {
    label: 'Data Analysis',
    text: 'Analyze the key factors that influence renewable energy adoption rates across different countries and provide a structured summary.',
  },
  {
    label: 'Technical Explanation',
    text: 'Explain how transformer neural networks work, including the attention mechanism, in a way that a computer science undergraduate would understand.',
  },
  {
    label: 'Math Problem',
    text: 'Solve the following optimization problem: minimize f(x,y) = x² + 2y² - xy + 3x - 2y, and find the critical points.',
  },
];

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_TASK_INPUT_LENGTH = 10000;

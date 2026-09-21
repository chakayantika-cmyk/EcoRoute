// ============================================================================
// Task Analysis Service — Deterministic Rule-Based Task Classifier
// Does NOT call an LLM to classify prompts. Lightweight, explainable, <100ms.
// ============================================================================

import { TokenEstimator } from './token-estimator.service';
import { TaskAnalysisProfile } from './task-analysis.types';

export class TaskAnalysisService {
  /**
   * Performs deterministic, explainable task profiling without calling an LLM
   */
  static analyze(prompt: string): TaskAnalysisProfile {
    const raw = (prompt || '').trim();
    const lower = raw.toLowerCase();
    const words = raw.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Token estimation
    const inputTokens = TokenEstimator.estimateInputTokens(raw);

    // Lexical diversity (Type-Token Ratio)
    const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const lexicalDiversity = wordCount > 0 ? Math.min(1.0, uniqueWords.size / wordCount) : 0.5;

    // Syntax & Keyword Patterns
    const codePatterns = [
      /\b(function|def|class|interface|type|const|let|var|return|async|await)\b/,
      /[{}();=>]/,
      /```[\s\S]*?```/,
      /\b(import|export|from|require)\b/,
      /\b(sql|select|insert|update|delete|join|table)\b/i,
      /\b(binary search|bst|algorithm|sorting|pointer|recursion|tree|graph|hashmap)\b/i,
      /\b(python|typescript|javascript|golang|rust|c\+\+|java)\b/i,
    ];
    const codeMatches = codePatterns.filter((p) => p.test(raw)).length;

    const mathPatterns = [
      /\b(derivative|integral|matrix|eigenvalue|vector|polynomial|logarithm|proof|prove|theorem)\b/i,
      /[∑∫√πθλσ±×÷^]/,
      /\b(calculate|compute|solve|equation|formula|probability|variance|differential equation)\b/i,
      /\b(math|algebra|calculus|geometry|trigonometry|square root|irrational|rational|contradiction)\b/i,
      /dy\/dx/,
    ];
    const mathMatches = mathPatterns.filter((p) => p.test(raw)).length;

    const archPatterns = [
      /\b(architecture|microservices|distributed|system design|kubernetes|docker|cloud|scalability|kafka|redis)\b/i,
      /\b(database schema|entity relationship|event-driven|cqrs|load balancer)\b/i,
    ];
    const archMatches = archPatterns.filter((p) => p.test(raw)).length;

    const reasoningPatterns = [
      /\b(why|explain|reason|compare|analyze|evaluate|pros and cons|trade-off|cause|effect)\b/i,
      /\b(critique|justify|implications|consequences|hypothesize)\b/i,
    ];
    const reasoningMatches = reasoningPatterns.filter((p) => p.test(raw)).length;

    const constraintPatterns = [
      /\b(must|should|strict|exact|limit|maximum|minimum|format|json|only|without|exclude)\b/i,
      /\b(step-by-step|concise|detailed|bullet points|table)\b/i,
    ];
    const constraintDensity = Math.min(1.0, (constraintPatterns.filter((p) => p.test(raw)).length * 2) / 10);

    const translatePatterns = [
      /\b(translate|in french|in spanish|in german|in japanese|in chinese|in italian|in russian)\b/i,
      /\b(traduis|traduzca|übersetze)\b/i,
    ];
    const translateMatches = translatePatterns.filter((p) => p.test(raw)).length;

    const summaryPatterns = [
      /\b(summarize|summary|tldr|brief|condense|abstract|key takeaways|bullet points)\b/i,
    ];
    const summaryMatches = summaryPatterns.filter((p) => p.test(raw)).length;

    const creativePatterns = [
      /\b(story|poem|essay|creative|write a tale|fiction|dialogue|script|roleplay)\b/i,
    ];
    const creativeMatches = creativePatterns.filter((p) => p.test(raw)).length;

    const factualPatterns = [
      /\b(who is|what is|when was|where is|capital of|how many|height of|date of)\b/i,
    ];
    const factualMatches = factualPatterns.filter((p) => p.test(raw)).length;

    const casualPatterns = [
      /\b(hello|hi|hey|how are you|good morning|thanks|thank you|who are you)\b/i,
    ];
    const casualMatches = casualPatterns.filter((p) => p.test(raw)).length;

    // Classification Decision Tree
    let domain = 'general';
    let domainLabel = 'General Knowledge & Discourse';
    let domainWeight = 0.50;
    let expansionRatio = 2.5;
    let minOutputTokens = 100;
    let maxOutputTokens = 600;
    const detectedFeatures: string[] = [];

    if (mathMatches >= 2 || (mathMatches >= 1 && (reasoningMatches >= 1 || raw.includes('dy/dx') || raw.includes('=')))) {
      domain = 'mathematical_derivation';
      domainLabel = 'Mathematical Derivation & Formal Logic';
      domainWeight = 0.90;
      expansionRatio = 3.5;
      minOutputTokens = 250;
      maxOutputTokens = 1200;
      detectedFeatures.push('Symbolic Math', 'Step-by-Step Proof', 'Formal Logic');
    } else if (archMatches >= 2 || (archMatches >= 1 && codeMatches >= 1)) {
      domain = 'code_architecture';
      domainLabel = 'Full-Stack Software Architecture';
      domainWeight = 0.94;
      expansionRatio = 6.0;
      minOutputTokens = 600;
      maxOutputTokens = 2500;
      detectedFeatures.push('System Architecture', 'High-Scale Blueprint', 'Distributed Topology');
    } else if (codeMatches >= 1 || lower.includes('python') || lower.includes('typescript') || lower.includes('sql') || lower.includes('code') || lower.includes('binary search tree')) {
      domain = 'code_implementation';
      domainLabel = 'Code Synthesis & Implementation';
      domainWeight = 0.84;
      expansionRatio = 4.0;
      minOutputTokens = 250;
      maxOutputTokens = 1500;
      detectedFeatures.push('Code Synthesis', 'Type Safety', 'Algorithmic Logic');
    } else if (translateMatches >= 1) {
      domain = 'cross_lingual';
      domainLabel = 'Cross-Lingual Translation';
      domainWeight = 0.45;
      expansionRatio = 1.2;
      minOutputTokens = 40;
      maxOutputTokens = 800;
      detectedFeatures.push('Linguistic Localization', 'Polyglot Translation');
    } else if (summaryMatches >= 1) {
      domain = 'summarization';
      domainLabel = 'Text Summarization';
      domainWeight = 0.38;
      expansionRatio = 0.35;
      minOutputTokens = 50;
      maxOutputTokens = 350;
      detectedFeatures.push('Information Condensation', 'Salient Extraction');
    } else if (creativeMatches >= 1 && (wordCount > 10 || lower.includes('story') || lower.includes('poem'))) {
      domain = 'creative_composition';
      domainLabel = 'Creative Narrative & Composition';
      domainWeight = 0.72;
      expansionRatio = 5.0;
      minOutputTokens = 350;
      maxOutputTokens = 1800;
      detectedFeatures.push('Creative Expression', 'Narrative Fluency', 'Stylistic Nuance');
    } else if (reasoningMatches >= 1 && (wordCount > 10 || lower.includes('pros and cons') || lower.includes('compare'))) {
      domain = 'analytical_reasoning';
      domainLabel = 'Analytical & Strategic Reasoning';
      domainWeight = 0.78;
      expansionRatio = 3.5;
      minOutputTokens = 300;
      maxOutputTokens = 1400;
      detectedFeatures.push('Multi-Factor Analysis', 'Cognitive Synthesis', 'Trade-off Evaluation');
    } else if (casualMatches >= 1 && wordCount < 15) {
      domain = 'casual_conversational';
      domainLabel = 'Conversational Interaction';
      domainWeight = 0.12;
      expansionRatio = 0.8;
      minOutputTokens = 20;
      maxOutputTokens = 100;
      detectedFeatures.push('Conversational Polish');
    } else if (factualMatches >= 1 || (wordCount < 12 && raw.endsWith('?'))) {
      domain = 'factual_lookup';
      domainLabel = 'Factual Knowledge Retrieval';
      domainWeight = 0.22;
      expansionRatio = 1.0;
      minOutputTokens = 30;
      maxOutputTokens = 150;
      detectedFeatures.push('Direct Fact Retrieval', 'High Precision Q&A');
    }

    let reasoningDepth = Math.min(1.0, 0.10 + reasoningMatches * 0.25 + (wordCount > 30 ? 0.20 : 0));
    if (domain === 'mathematical_derivation') reasoningDepth = Math.max(0.88, reasoningDepth);
    if (domain === 'code_architecture') reasoningDepth = Math.max(0.82, reasoningDepth);
    if (domain === 'code_implementation' && (lower.includes('algorithm') || lower.includes('tree') || lower.includes('bst'))) {
      reasoningDepth = Math.max(0.70, reasoningDepth);
    }

    let complexityIndex =
      domainWeight * 0.55 +
      reasoningDepth * 0.25 +
      constraintDensity * 0.10 +
      lexicalDiversity * 0.10;

    if (wordCount > 40) complexityIndex = Math.min(0.99, complexityIndex + 0.08);
    else if (wordCount < 8 && domain === 'general') complexityIndex = Math.max(0.08, complexityIndex - 0.12);

    complexityIndex = Math.round(complexityIndex * 100) / 100;

    let complexityTier: 'Low' | 'Moderate' | 'High' | 'Very High' = 'Moderate';
    if (complexityIndex < 0.35) complexityTier = 'Low';
    else if (complexityIndex < 0.65) complexityTier = 'Moderate';
    else if (complexityIndex < 0.82) complexityTier = 'High';
    else complexityTier = 'Very High';

    const predictedOutputTokens = TokenEstimator.estimateOutputTokens(
      inputTokens,
      expansionRatio,
      minOutputTokens,
      maxOutputTokens,
    );
    const totalEstimatedTokens = inputTokens + predictedOutputTokens;

    return {
      domain,
      domainLabel,
      complexityIndex,
      complexityTier,
      reasoningDepth: Math.round(reasoningDepth * 100) / 100,
      constraintDensity: Math.round(constraintDensity * 100) / 100,
      lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
      wordCount,
      inputTokens,
      predictedOutputTokens,
      expansionRatio: Math.round(expansionRatio * 10) / 10,
      totalEstimatedTokens,
      detectedFeatures,
      classificationMethod: 'rule-based-heuristics-v2',
      methodologyVersion: '2.0',
      confidence: wordCount > 8 ? 'high' : 'medium',
    };
  }
}

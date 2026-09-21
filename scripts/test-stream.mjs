import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test-admin@ecoroute.local',
        passwordHash: 'dummy',
        displayName: 'Test Admin',
        role: 'ADMIN',
      },
    });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    'ecoroute-dev-access-secret-key-change-in-production-64chars',
    { expiresIn: '1h', issuer: 'ecoroute-ai' }
  );

  console.log(`Generated token for user ${user.email} (${user.id})`);

  const streamRes = await fetch('http://localhost:3001/api/v1/tasks/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ inputText: 'Explain what photosynthesis is in one clear sentence.', routingStrategy: 'balanced' }),
  });

  const text = await streamRes.text();
  const chunks = text.split('\n\n').filter(Boolean);
  console.log(`Total events received: ${chunks.length}`);

  let fullAnswer = '';

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const event = lines.find((l) => l.startsWith('event: '))?.replace('event: ', '');
    const dataStr = lines.find((l) => l.startsWith('data: '))?.replace('data: ', '');

    if (event === 'evaluations' && dataStr) {
      const evaluations = JSON.parse(dataStr);
      console.log(`\n=== CANDIDATE EVALUATIONS (Count: ${evaluations.length}) ===`);
      const eligible = evaluations.filter((e) => e.eligible);
      const ineligible = evaluations.filter((e) => !e.eligible);
      console.log(`Eligible models (${eligible.length}):`);
      for (const e of eligible) {
        console.log(`  ✓ ${e.modelName} [${e.providerName}]: routingScore=${e.routingScore}%, tier=${e.pricingTier}`);
      }
      console.log(`Ineligible models (${ineligible.length}):`);
      for (const e of ineligible.slice(0, 10)) {
        console.log(`  ✗ ${e.modelName} [${e.providerName}]: ${e.disqualifyReason}`);
      }
      if (ineligible.length > 10) {
        console.log(`  ... and ${ineligible.length - 10} more excluded models.`);
      }
    }

    if (event === 'selectedModel' && dataStr) {
      const selected = JSON.parse(dataStr);
      console.log(`\n=== WINNING MODEL SELECTED ===`);
      console.log(`Model: ${selected.displayName} (${selected.provider})`);
      console.log(`Routing Score: ${selected.routingScore}%`);
      console.log(`Quality Score: ${selected.qualityScore}/100`);
      console.log(`Estimated Cost: $${selected.estimatedCost}`);
      console.log(`Estimated Carbon: ${selected.estimatedCarbon}g CO2e`);
    }

    if (event === 'chunk' && dataStr) {
      const parsed = JSON.parse(dataStr);
      fullAnswer = parsed.fullText || (fullAnswer + parsed.chunk);
    }

    if (event === 'sustainability' && dataStr) {
      const s = JSON.parse(dataStr);
      console.log(`\n=== SUSTAINABILITY ACCOUNTING ===`);
      console.log(`Counterfactual Baseline Model: ${s.baselineModel.name} (${s.baselineModel.costUsd != null ? '$' + s.baselineModel.costUsd : 'N/A'})`);
      console.log(`Net Energy Savings: ${s.netSavings.energyWh?.toFixed(4)} Wh (${s.netSavings.energyPercent?.toFixed(1)}%)`);
      console.log(`Net Carbon Savings: ${s.netSavings.carbonGramsCo2e?.toFixed(4)} g CO2e`);
      console.log(`Net Cost Savings: $${s.netSavings.costUsd?.toFixed(6)}`);
      console.log(`Router Overhead: ${s.overhead.routerEnergyWh?.toFixed(6)} Wh (${s.overhead.routerLatencyMs} ms)`);
    }

    if (event === 'completed' && dataStr) {
      const comp = JSON.parse(dataStr);
      console.log('\n=== TASK COMPLETED SUCCESSFULLY ===');
      console.log(`Answer Text:\n${fullAnswer || comp.explanation || 'No tokens'}`);
      console.log(`Actual Tokens: ${comp.actualUsage?.totalTokens}`);
      console.log(`Execution Latency: ${comp.actualUsage?.latencyMs} ms`);
    }

    if (event === 'error' && dataStr) {
      console.log('\n=== TASK STREAM RETURNED ERROR ===', dataStr);
    }
  }

  await prisma.$disconnect();
}

test().catch(console.error);

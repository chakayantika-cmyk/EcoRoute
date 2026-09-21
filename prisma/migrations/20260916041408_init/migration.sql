-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "input_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "input_token_count" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "error_info" TEXT,
    CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "routing_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "selected_model_id" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "estimated_tokens" INTEGER NOT NULL,
    "actual_tokens" INTEGER,
    "estimated_cost_value" REAL,
    "estimated_cost_currency" TEXT NOT NULL DEFAULT 'USD',
    "actual_cost_value" REAL,
    "energy_wh" REAL,
    "carbon_grams" REAL,
    "environmental_status" TEXT NOT NULL DEFAULT 'ESTIMATED',
    "methodology_version" TEXT NOT NULL DEFAULT 'v1',
    "quality_score" INTEGER,
    "quality_score_type" TEXT NOT NULL DEFAULT 'SIMULATED',
    "explanation" TEXT NOT NULL,
    "candidate_scores_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "routing_results_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "routing_results_selected_model_id_fkey" FOREIGN KEY ("selected_model_id") REFERENCES "ai_models" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "generated_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "answer_text" TEXT NOT NULL,
    "provider_request_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_answers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "config_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "model_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "capabilities_json" TEXT NOT NULL,
    "context_window" INTEGER NOT NULL,
    "pricing_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "routing_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_efficiency_weight" REAL NOT NULL DEFAULT 0.25,
    "cost_weight" REAL NOT NULL DEFAULT 0.25,
    "quality_weight" REAL NOT NULL DEFAULT 0.25,
    "environmental_weight" REAL NOT NULL DEFAULT 0.25,
    "default_strategy" TEXT NOT NULL DEFAULT 'balanced',
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "routing_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routing_result_id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "value" REAL,
    "unit" TEXT NOT NULL,
    "measurement_type" TEXT NOT NULL,
    "methodology_version" TEXT NOT NULL DEFAULT 'v1',
    "data_source" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_snapshots_routing_result_id_fkey" FOREIGN KEY ("routing_result_id") REFERENCES "routing_results" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "tasks_created_at_idx" ON "tasks"("created_at");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "routing_results_task_id_key" ON "routing_results"("task_id");

-- CreateIndex
CREATE INDEX "routing_results_task_id_idx" ON "routing_results"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "generated_answers_task_id_key" ON "generated_answers"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_provider_key_key" ON "ai_providers"("provider_key");

-- CreateIndex
CREATE INDEX "ai_models_status_idx" ON "ai_models"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_provider_id_model_key_key" ON "ai_models"("provider_id", "model_key");

-- CreateIndex
CREATE UNIQUE INDEX "routing_preferences_user_id_key" ON "routing_preferences"("user_id");

-- CreateIndex
CREATE INDEX "metric_snapshots_routing_result_id_idx" ON "metric_snapshots"("routing_result_id");

-- CreateIndex
CREATE INDEX "audit_events_user_id_idx" ON "audit_events"("user_id");

-- CreateIndex
CREATE INDEX "audit_events_event_type_idx" ON "audit_events"("event_type");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

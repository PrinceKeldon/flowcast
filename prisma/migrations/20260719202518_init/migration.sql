-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('trope', 'mood', 'cast_type', 'monetization_type');

-- CreateEnum
CREATE TYPE "Pacing" AS ENUM ('fast', 'medium', 'slow');

-- CreateEnum
CREATE TYPE "TitleStatus" AS ENUM ('ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PriceModel" AS ENUM ('free', 'pay_per_unlock', 'subscription', 'ad_supported');

-- CreateEnum
CREATE TYPE "InteractionAction" AS ENUM ('viewed_listing', 'viewed_detail', 'clicked_out', 'saved', 'searched');

-- CreateTable
CREATE TABLE "tag_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" "TagCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "tag_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "contact_email" TEXT,
    "website" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "producers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "producer_id" UUID,
    "name" TEXT NOT NULL,
    "synopsis" TEXT,
    "language" TEXT NOT NULL,
    "country_of_origin" TEXT,
    "trope_tags" TEXT[],
    "mood_tags" TEXT[],
    "pacing" "Pacing",
    "cast_type" TEXT,
    "episode_count" INTEGER,
    "avg_episode_seconds" INTEGER,
    "release_date" DATE,
    "status" "TitleStatus" NOT NULL DEFAULT 'ongoing',
    "cover_image_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "deep_link_url" TEXT NOT NULL,
    "price_model" "PriceModel" NOT NULL,
    "price_amount_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "region_availability" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "title_reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title_id" UUID NOT NULL,
    "emoji" TEXT NOT NULL,
    "quote_text" TEXT NOT NULL,
    "author_handle" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "title_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "session_id" TEXT NOT NULL,
    "title_id" UUID NOT NULL,
    "availability_id" UUID,
    "action" "InteractionAction" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "result_count" INTEGER,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_definitions_category_value_key" ON "tag_definitions"("category", "value");

-- CreateIndex
CREATE INDEX "titles_language_idx" ON "titles"("language");

-- CreateIndex
CREATE INDEX "titles_pacing_idx" ON "titles"("pacing");

-- CreateIndex
CREATE INDEX "titles_is_published_idx" ON "titles"("is_published");

-- CreateIndex
CREATE INDEX "availability_title_id_idx" ON "availability"("title_id");

-- CreateIndex
CREATE INDEX "availability_platform_idx" ON "availability"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "availability_title_id_platform_deep_link_url_key" ON "availability"("title_id", "platform", "deep_link_url");

-- CreateIndex
CREATE INDEX "title_reactions_title_id_idx" ON "title_reactions"("title_id");

-- CreateIndex
CREATE INDEX "user_interactions_title_id_idx" ON "user_interactions"("title_id");

-- CreateIndex
CREATE INDEX "user_interactions_action_idx" ON "user_interactions"("action");

-- CreateIndex
CREATE INDEX "user_interactions_created_at_idx" ON "user_interactions"("created_at");

-- CreateIndex
CREATE INDEX "search_logs_created_at_idx" ON "search_logs"("created_at");

-- CreateIndex
CREATE INDEX "search_logs_query_idx" ON "search_logs"("query");

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_reactions" ADD CONSTRAINT "title_reactions_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "availability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

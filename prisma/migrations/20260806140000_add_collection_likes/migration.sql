-- CreateTable
CREATE TABLE "collection_likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "curator_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "collection_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_item_likes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "curator_id" UUID NOT NULL,
    "collection_item_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "collection_item_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_likes_collection_id_idx" ON "collection_likes"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_likes_curator_id_collection_id_key" ON "collection_likes"("curator_id", "collection_id");

-- CreateIndex
CREATE INDEX "collection_item_likes_collection_item_id_idx" ON "collection_item_likes"("collection_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_item_likes_curator_id_collection_item_id_key" ON "collection_item_likes"("curator_id", "collection_item_id");

-- AddForeignKey
ALTER TABLE "collection_likes" ADD CONSTRAINT "collection_likes_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "curators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_likes" ADD CONSTRAINT "collection_likes_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_item_likes" ADD CONSTRAINT "collection_item_likes_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "curators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_item_likes" ADD CONSTRAINT "collection_item_likes_collection_item_id_fkey" FOREIGN KEY ("collection_item_id") REFERENCES "collection_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

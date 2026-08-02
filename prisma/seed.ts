import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Base taxonomy — this is a real, useful starting vocabulary (not
// mock/placeholder content), so it stays seeded even after the
// fictional example titles were removed. New tags beyond this list
// get auto-registered as admins tag real titles — see
// normalizeAndRegisterTags() in lib/actions.ts.
const TAG_DEFINITIONS: Array<{ category: "trope" | "mood" | "cast_type" | "monetization_type"; value: string; label: string }> = [
  { category: "trope", value: "revenge", label: "Revenge" },
  { category: "trope", value: "billionaire", label: "Billionaire" },
  { category: "trope", value: "fake_marriage", label: "Fake Marriage" },
  { category: "trope", value: "secret_identity", label: "Secret Identity" },
  { category: "trope", value: "second_chance_love", label: "Second Chance Love" },
  { category: "trope", value: "love_triangle", label: "Love Triangle" },
  { category: "trope", value: "mafia", label: "Mafia / Crime Family" },
  { category: "trope", value: "diaspora_homecoming", label: "Diaspora Homecoming" },
  { category: "trope", value: "enemies_to_lovers", label: "Enemies to Lovers" },
  { category: "trope", value: "secret_baby", label: "Secret Baby" },
  { category: "trope", value: "forbidden_love", label: "Forbidden Love" },
  { category: "trope", value: "artist_muse", label: "Artist / Muse" },

  { category: "mood", value: "slow_burn", label: "Slow Burn" },
  { category: "mood", value: "high_drama", label: "High Drama" },
  { category: "mood", value: "comedic", label: "Comedic" },
  { category: "mood", value: "heartwarming", label: "Heartwarming" },
  { category: "mood", value: "dark_gritty", label: "Dark & Gritty" },
  { category: "mood", value: "feel_good", label: "Feel Good" },
  { category: "mood", value: "longing", label: "Longing" },
  { category: "mood", value: "butterflies", label: "Butterflies" },
  { category: "mood", value: "heartbreak", label: "Heartbreak" },
  { category: "mood", value: "guilty_pleasure", label: "Guilty Pleasure" },
  { category: "mood", value: "melancholic", label: "Melancholic" },

  { category: "cast_type", value: "unknown_cast", label: "Unknown Cast" },
  { category: "cast_type", value: "influencer_lead", label: "Influencer Lead" },
  { category: "cast_type", value: "established_actor", label: "Established Actor" },

  { category: "monetization_type", value: "free", label: "Free" },
  { category: "monetization_type", value: "pay_per_unlock", label: "Pay Per Unlock" },
  { category: "monetization_type", value: "subscription", label: "Subscription" },
];

async function main() {
  console.log("Seeding tag definitions...");
  for (const tag of TAG_DEFINITIONS) {
    await prisma.tagDefinition.upsert({
      where: { category_value: { category: tag.category, value: tag.value } },
      update: {},
      create: tag,
    });
  }
  console.log(`Seeded ${TAG_DEFINITIONS.length} tag definitions. No mock titles seeded — add real ones via /admin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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

const TITLES = [
  {
    name: "The Light Between Oceans",
    synopsis: "A lighthouse keeper and his wife face an impossible choice after finding a baby adrift at sea.",
    language: "en",
    tropeTags: ["forbidden_love"],
    moodTags: ["longing", "slow_burn"],
    pacing: "slow" as const,
    episodeCount: 24,
    reactions: [
      { emoji: "❤️", quoteText: "The slow burn is absolutely perfect.", authorHandle: "@filmlover" },
      { emoji: "🔥", quoteText: "Every glance hurts so good.", authorHandle: "@dramaaddict" },
    ],
    availability: [{ platform: "ReelShort", deepLinkUrl: "https://example.com/reelshort/light-between-oceans", priceModel: "free" as const }],
  },
  {
    name: "Portrait of a Lady on Fire",
    synopsis: "A painter is hired to secretly portray a young woman in 18th-century France, and an unexpected bond forms.",
    language: "fr",
    tropeTags: ["forbidden_love", "artist_muse"],
    moodTags: ["longing", "melancholic"],
    pacing: "slow" as const,
    episodeCount: 18,
    reactions: [{ emoji: "😭", quoteText: "I cried for two days.", authorHandle: "@sobbingdaily" }],
    availability: [{ platform: "DramaBox", deepLinkUrl: "https://example.com/dramabox/portrait-lady-fire", priceModel: "pay_per_unlock" as const, priceAmountCents: 199 }],
  },
  {
    name: "His Secret Baby",
    synopsis: "A billionaire CEO discovers he has a son he never knew about, and the mother he can't forget.",
    language: "en",
    tropeTags: ["secret_baby", "billionaire"],
    moodTags: ["guilty_pleasure", "high_drama"],
    pacing: "fast" as const,
    episodeCount: 32,
    reactions: [{ emoji: "🔥", quoteText: "The most ridiculous, most addictive thing.", authorHandle: "@bingewatcher" }],
    availability: [{ platform: "ReelShort", deepLinkUrl: "https://example.com/reelshort/his-secret-baby", priceModel: "free" as const }],
  },
  {
    name: "Revenge After Betrayal",
    synopsis: "Betrayed and left for dead, she returns years later to take back everything that was stolen from her.",
    language: "en",
    tropeTags: ["revenge", "mafia"],
    moodTags: ["high_drama", "guilty_pleasure"],
    pacing: "fast" as const,
    episodeCount: 40,
    reactions: [{ emoji: "🔥", quoteText: "She ate and left no crumbs.", authorHandle: "@revengearc" }],
    availability: [{ platform: "DramaBox", deepLinkUrl: "https://example.com/dramabox/revenge-after-betrayal", priceModel: "pay_per_unlock" as const, priceAmountCents: 149 }],
  },
  {
    name: "The CEO's Contract Wife",
    synopsis: "A marriage of convenience between a ruthless CEO and a woman with nothing left to lose slowly turns real.",
    language: "en",
    tropeTags: ["fake_marriage", "billionaire"],
    moodTags: ["butterflies", "guilty_pleasure"],
    pacing: "fast" as const,
    episodeCount: 36,
    reactions: [{ emoji: "❤️", quoteText: "The fake dating trope done right.", authorHandle: "@tropetrope" }],
    availability: [{ platform: "ReelShort", deepLinkUrl: "https://example.com/reelshort/ceo-contract-wife", priceModel: "free" as const }],
  },
  {
    name: "Surrender to Love",
    synopsis: "Years after a painful breakup, two former lovers are forced back into each other's orbit.",
    language: "en",
    tropeTags: ["second_chance_love"],
    moodTags: ["butterflies", "heartwarming"],
    pacing: "medium" as const,
    episodeCount: 28,
    reactions: [{ emoji: "❤️", quoteText: "Butterflies from episode one.", authorHandle: "@romcomfan" }],
    availability: [{ platform: "YouTube", deepLinkUrl: "https://example.com/youtube/surrender-to-love", priceModel: "ad_supported" as const }],
  },
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

  console.log("Seeding titles...");
  for (const t of TITLES) {
    const { reactions, availability, ...titleData } = t;
    const title = await prisma.title.create({
      data: { ...titleData, isPublished: true },
    });
    for (const r of reactions) {
      await prisma.titleReaction.create({ data: { titleId: title.id, ...r } });
    }
    for (const a of availability) {
      await prisma.availability.create({ data: { titleId: title.id, ...a } });
    }
  }

  console.log(`Seeded ${TITLES.length} titles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

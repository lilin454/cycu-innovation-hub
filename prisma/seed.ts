// 初始化預設分類（可重複執行，不會覆蓋已存在的資料）
// 加上 --demo 會另外建立幾則「示範公告」，方便第一次看版面：npm run db:seed -- --demo
import "dotenv/config";
import { PrismaClient, type CategoryKind } from "@prisma/client";

const db = new PrismaClient();

const NAVY = "#0E3A66";
const FLAME = "#D9501E";
const TEAL = "#16898A";
const SUN = "#C98A06";
const SLATE = "#55657A";

const SOURCES: [string, string, string][] = [
  ["青年局活動", "youth-bureau", FLAME],
  ["校外活動", "off-campus", TEAL],
  ["校內活動", "on-campus", NAVY],
  ["創發中心活動", "ciec", SUN],
  ["社團自辦活動", "club", NAVY],
  ["合作單位活動", "partner", TEAL],
  ["中原大學台北校友會活動", "alumni-taipei", SUN],
  ["其他", "other-source", SLATE],
];

const TYPES: [string, string, string][] = [
  ["競賽", "competition", FLAME],
  ["論壇", "forum", NAVY],
  ["講座", "talk", NAVY],
  ["工作坊", "workshop", TEAL],
  ["說明會", "briefing", SLATE],
  ["培訓課程", "training", TEAL],
  ["研習營", "camp", TEAL],
  ["展覽", "exhibition", SUN],
  ["交流活動", "networking", SUN],
  ["參訪", "visit", SLATE],
  ["志工服務", "volunteer", TEAL],
  ["實習與職涯", "career", NAVY],
  ["徵件活動", "open-call", FLAME],
  ["補助與計畫", "grant", FLAME],
  ["實習機會", "internship", NAVY],
  ["企業參訪", "company-visit", SLATE],
  ["其他", "other-type", SLATE],
];

async function seedCategories(kind: CategoryKind, rows: [string, string, string][]) {
  for (const [i, [name, slug, color]] of rows.entries()) {
    const exists = await db.category.findFirst({ where: { OR: [{ kind, name }, { slug }] } });
    if (!exists) await db.category.create({ data: { kind, name, slug, color, sortOrder: i + 1 } });
  }
}

async function seedDemo() {
  if ((await db.announcement.count()) > 0) {
    console.log("資料庫已有公告，略過示範資料。");
    return;
  }
  const cat = async (slug: string) => ({ id: (await db.category.findUniqueOrThrow({ where: { slug } })).id });
  const day = (offset: number, hour: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(hour - 8, 0, 0, 0);
    return d;
  };
  const note = "<blockquote><p>這是系統內建的示範公告，用來展示版面。正式使用前請到後台刪除。</p></blockquote>";
  const demos = [
    {
      slug: "demo-talk",
      title: "【示範公告】創業第一步：從想法到提案",
      subtitle: "示範用的講座公告",
      summary: "示範內容：一場談如何把模糊的點子整理成可以對外說明的提案的講座。",
      feeType: "FREE" as const,
      startAt: day(14, 14),
      endAt: day(14, 16),
      registrationDeadline: day(12, 23),
      location: "中原大學（示範地點）",
      organizer: "中原大學創新創業發展社",
      targetAudience: "全校學生",
      registrationMethod: "線上報名",
      isFeatured: true,
      isPinned: true,
      cats: ["club", "on-campus", "talk"],
      content: `${note}<h2>活動內容</h2><p>這裡是活動的完整介紹，可以使用<strong>粗體</strong>、清單、表格與圖片。</p><ul><li>提案架構怎麼搭</li><li>如何找到第一位使用者</li></ul>`,
    },
    {
      slug: "demo-contest",
      title: "【示範公告】青年創意提案競賽",
      subtitle: "示範用的競賽公告",
      summary: "示範內容：以城市議題為題目的提案競賽，展示保證金與報名截止的呈現方式。",
      feeType: "DEPOSIT" as const,
      feeAmount: 1000,
      feeDescription: "全程參與後退還",
      startAt: day(30, 9),
      endAt: day(31, 17),
      registrationDeadline: day(20, 23),
      location: "桃園市（示範地點）",
      organizer: "示範主辦單位",
      targetAudience: "全國大專院校學生",
      registrationMethod: "線上報名並繳交提案摘要",
      isFeatured: true,
      cats: ["youth-bureau", "off-campus", "competition"],
      content: `${note}<h2>競賽辦法</h2><ol><li>組隊報名</li><li>繳交提案摘要</li><li>決賽簡報</li></ol>`,
    },
    {
      slug: "demo-workshop",
      title: "【示範公告】設計思考一日工作坊",
      summary: "示範內容：動手做的一日工作坊，展示付費活動的呈現方式。",
      feeType: "PAID" as const,
      feeAmount: 500,
      feeDescription: "含材料與午餐",
      startAt: day(21, 10),
      endAt: day(21, 17),
      location: "創新創業發展中心（示範地點）",
      organizer: "示範主辦單位",
      targetAudience: "對設計思考有興趣的學生",
      cats: ["ciec", "on-campus", "workshop"],
      content: `${note}<p>工作坊流程與注意事項會寫在這裡。</p>`,
    },
  ];
  for (const [i, { cats, ...d }] of demos.entries()) {
    await db.announcement.create({
      data: {
        ...d,
        contentText: d.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        status: "PUBLISHED",
        publishedAt: new Date(Date.now() - i * 3600_000),
        categories: { connect: await Promise.all(cats.map(cat)) },
      },
    });
  }
  console.log(`已建立 ${demos.length} 則示範公告。`);
}

async function main() {
  await seedCategories("SOURCE", SOURCES);
  await seedCategories("EVENT_TYPE", TYPES);
  console.log("預設分類已就緒。");
  if (process.argv.includes("--demo")) await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

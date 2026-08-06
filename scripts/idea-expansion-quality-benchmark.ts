/**
 * Fikir genişletme panosu kalite ölçümü.
 *
 * Bu bir CI kapısı DEĞİLDİR: canlı bir sağlayıcı (varsayılan Ollama) gerektirir
 * ve `npm run verify` içine alınmaz. Planın "Uygulama sonrası ölçüm" bölümünün
 * karşılığıdır ve elle çalıştırılır.
 *
 *   npm run benchmark:idea-expansion
 *
 * Ölçtüğü şey, panonun teknik olarak çalışması değil, ürettiği kartların
 * kullanılabilir olmasıdır. Şema kurtarması (partitionExpansionCards) bozuk
 * kartları sessizce eleyebildiği için, ham model çıktısı şema doğrulamasından
 * ÖNCE yakalanır; aksi hâlde "10 kart geldi" raporu, 4'ünün atıldığını gizler.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createProvider, type StructuredProvider } from '../src/v4/ai/provider-adapters.js';
import { generateExpansionCards } from '../src/v4/application/idea-expansion-service.js';
import { getExpansionCategories } from '../src/v4/idea-expansion/categories.js';
import { MINIMUM_EXPANSION_CARDS, partitionExpansionCards } from '../src/v4/ai/schemas/schemas.js';
import { createProjectDocument } from '../src/v4/project-document.js';

const MODE_THRESHOLD = 0.75;
const AVERAGE_CARD_THRESHOLD = 5;

const providerId = process.env.EXPANSION_BENCH_PROVIDER || 'ollama';
const model = process.env.EXPANSION_BENCH_MODEL || 'qwen2.5:7b';
const baseUrl = process.env.EXPANSION_BENCH_BASE_URL || 'http://127.0.0.1:11434';

const reportPath = resolve('benchmarks', 'idea-expansion', 'latest-report.json');
const markdownPath = resolve('docs', 'product', 'IDEA_EXPANSION_QUALITY_REPORT.md');

/**
 * Üç fikir bilerek farklı domain'lere düşer: kategori omurgası domain'e göre
 * değiştiği için tek bir domain'de ölçmek panoyu olduğundan iyi gösterir.
 */
const IDEAS = [
  {
    key: 'web',
    name: 'Ekip içi karar defteri',
    idea: 'Küçük yazılım ekipleri için aldıkları teknik kararları ve gerekçelerini kaydeden bir web uygulaması yapmak istiyorum.'
  },
  {
    key: 'mobile',
    name: 'Yürüyüş günlüğü',
    idea: 'Telefonda çalışan, günlük yürüyüşleri kaydedip haftalık özet çıkaran bir mobil uygulama istiyorum.'
  },
  {
    key: 'ai',
    name: 'Belge özetleyici',
    idea: 'Uzun PDF raporları okuyup soru sorulabilen yerel bir yapay zeka asistanı yapmak istiyorum.'
  }
] as const;

/** İki çekirdek kategori her fikirde ortak; üçüncüsü domain'e özel olanı test eder. */
const SHARED_CATEGORY_IDS = ['core-depth', 'narrow'] as const;

interface RunRecord {
  ideaKey: string;
  ideaName: string;
  categoryId: string;
  categoryLabel: string;
  mode: string;
  cards: number;
  rawCards: number;
  dropped: number;
  attempts: number;
  durationMs: number;
  fallbackReason: string | null;
}

/**
 * Sağlayıcıyı sarmalar ve şema `parse` çağrısını araya alır. Üretim kodu
 * değişmez: yalnız doğrulamadan önceki ham değer okunur, sonra gerçek şemaya
 * olduğu gibi devredilir. Onarım turları da ayrı birer parse çağrısı olduğu
 * için deneme sayısı buradan sayılır.
 */
function instrument(provider: StructuredProvider) {
  const seen: { raw: number; dropped: number }[] = [];
  const wrapped: StructuredProvider = {
    model: provider.model,
    structured(input) {
      const { schema } = input;
      return provider.structured({
        ...input,
        schema: {
          parse(value: unknown) {
            const cards = (value as { cards?: unknown })?.cards;
            const { usable, dropped } = partitionExpansionCards(cards);
            seen.push({
              raw: Array.isArray(cards) ? cards.length : 0,
              // Kurtarma eşiği tutmadığında hiçbir kart "atılmaz": ham dizi
              // olduğu gibi şemaya gider ve tur dürüstçe düşer.
              dropped: usable.length >= MINIMUM_EXPANSION_CARDS ? dropped.length : 0
            });
            return schema.parse(value);
          }
        }
      });
    }
  };
  return { wrapped, seen };
}

async function main(): Promise<void> {
  const runs: RunRecord[] = [];

  for (const entry of IDEAS) {
    const project = createProjectDocument({ idea: entry.idea, name: entry.name });
    const categories = getExpansionCategories(project);
    const domainOnly = categories.filter(
      category => !SHARED_CATEGORY_IDS.includes(category.id as (typeof SHARED_CATEGORY_IDS)[number])
    );
    const selected = [
      ...SHARED_CATEGORY_IDS.map(id => categories.find(category => category.id === id)!),
      // Domain paketi olmayan fikirlerde (general) çekirdekten üçüncü bir kategori seçilir.
      domainOnly[domainOnly.length - 1]
    ].filter(Boolean);

    for (const category of selected) {
      const provider = createProvider(providerId, { model, baseUrl, credential: '' });
      const { wrapped, seen } = instrument(provider);
      const started = process.hrtime.bigint();
      const result = await generateExpansionCards(project, category.id, {
        settings: {
          providerId,
          model,
          baseUrl,
          useAiWhenAvailable: true,
          useLocalMemory: false
        },
        provider: wrapped,
        refresh: true
      });
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const last = seen[seen.length - 1];
      const record: RunRecord = {
        ideaKey: entry.key,
        ideaName: entry.name,
        categoryId: category.id,
        categoryLabel: category.label,
        mode: result.mode,
        cards: result.mode === 'fallback' ? 0 : result.cards.length,
        rawCards: last?.raw ?? 0,
        dropped: last?.dropped ?? 0,
        attempts: seen.length,
        durationMs: Math.round(durationMs),
        fallbackReason: result.fallbackReason
      };
      runs.push(record);
      const status = record.mode === 'fallback' ? 'FALLBACK' : record.mode.toUpperCase();
      console.log(
        `${entry.key.padEnd(7)} ${category.id.padEnd(14)} ${status.padEnd(9)} ` +
          `kart=${String(record.cards).padStart(2)} ham=${String(record.rawCards).padStart(2)} ` +
          `atılan=${record.dropped} deneme=${record.attempts} ${record.durationMs}ms` +
          (record.fallbackReason ? ` — ${record.fallbackReason}` : '')
      );
    }
  }

  const aiRuns = runs.filter(run => run.mode === 'local-ai' || run.mode === 'cloud-ai');
  const aiRatio = runs.length ? aiRuns.length / runs.length : 0;
  // Ortalama, fallback turlarını 0 kart sayarak hesaplanır: bir tur AI'ya
  // bağlanamadıysa o turda kullanıcı kullanılabilir kart görmemiştir.
  const averageCards = runs.length ? runs.reduce((total, run) => total + run.cards, 0) / runs.length : 0;
  const modePassed = aiRatio >= MODE_THRESHOLD;
  const cardsPassed = averageCards >= AVERAGE_CARD_THRESHOLD;
  const passed = modePassed && cardsPassed;

  const summary = {
    providerId,
    model,
    totalRuns: runs.length,
    aiRuns: aiRuns.length,
    aiRatio: Number(aiRatio.toFixed(3)),
    averageCards: Number(averageCards.toFixed(2)),
    averageDurationMs: runs.length
      ? Math.round(runs.reduce((total, run) => total + run.durationMs, 0) / runs.length)
      : 0,
    totalDropped: runs.reduce((total, run) => total + run.dropped, 0),
    thresholds: { aiRatio: MODE_THRESHOLD, averageCards: AVERAGE_CARD_THRESHOLD },
    modePassed,
    cardsPassed,
    passed
  };

  console.log('');
  console.log(`AI oranı        : ${(aiRatio * 100).toFixed(1)}% (eşik ${MODE_THRESHOLD * 100}%) → ${modePassed ? 'GEÇTİ' : 'KALDI'}`);
  console.log(`Ortalama kart   : ${averageCards.toFixed(2)} (eşik ${AVERAGE_CARD_THRESHOLD}) → ${cardsPassed ? 'GEÇTİ' : 'KALDI'}`);
  console.log(`Toplam atılan   : ${summary.totalDropped}`);
  console.log(`Sonuç           : ${passed ? 'KABUL' : 'RET'}`);

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({ summary, runs }, null, 2)}\n`, 'utf8');

  const rows = runs
    .map(
      run =>
        `| ${run.ideaName} | ${run.categoryLabel} | ${run.mode} | ${run.cards} | ${run.rawCards} | ${run.dropped} | ${run.attempts} | ${run.durationMs} |`
    )
    .join('\n');
  const markdown = `# Fikir Genişletme Kalite Raporu

Sağlayıcı: \`${providerId}\` · Model: \`${model}\`

Bu rapor \`npm run benchmark:idea-expansion\` ile canlı sağlayıcıya karşı üretilir.
CI'da çalışmaz; sağlayıcı olmadan ölçülemeyen tek kalite sorusunu yanıtlar:
kategori başına üretilen kartların kaçı gerçekten kullanılabilir?

## Özet

| Ölçüt | Değer | Eşik | Sonuç |
| --- | --- | --- | --- |
| AI modunda tamamlanan tur oranı | ${(aiRatio * 100).toFixed(1)}% | ${MODE_THRESHOLD * 100}% | ${modePassed ? 'GEÇTİ' : 'KALDI'} |
| Tur başına ortalama kullanılabilir kart | ${averageCards.toFixed(2)} | ${AVERAGE_CARD_THRESHOLD} | ${cardsPassed ? 'GEÇTİ' : 'KALDI'} |

Şema kurtarmasının attığı toplam kart: **${summary.totalDropped}**.
Tur başına ortalama süre: **${summary.averageDurationMs} ms**.

## Turlar

| Fikir | Kategori | Mod | Kullanılabilir | Ham | Atılan | Deneme | Süre (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

Eşik tutmazsa istem gözden geçirilir; şema veya kurtarma gevşetilmez.
`;
  writeFileSync(markdownPath, markdown, 'utf8');
  console.log(`\nRapor: ${reportPath}\n       ${markdownPath}`);

  if (!passed) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

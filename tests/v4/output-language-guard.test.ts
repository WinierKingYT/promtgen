import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { containsNonLatinScript, findNonLatinScriptPaths } from '../../src/v4/ai/schemas/language-guard.js';
import { runAITask } from '../../src/v4/ai/orchestrator.js';
import { ideaExpansionTask } from '../../src/v4/ai/tasks/idea-expansion.js';
import { ideaLabTask } from '../../src/v4/ai/tasks/idea-lab.js';
import { createProjectDocument } from '../../src/v4/project-document.js';

/**
 * CANLI ÖLÇÜMDEN GELEN GERÇEK BAŞLIKLAR (Ollama qwen2.5:7b, fikir =
 * "unityde bir at sistemi yapmak istiyorum multiplayer olucak").
 * İstemde "Türkçe yanıt ver." satırı VARDI; model uymadı.
 */
const MEASURED_CHINESE_TITLES = [
  '同步跳跃机制',
  '实时伤害反馈',
  '共享资源系统',
  '多人竞技场',
  '社交互动',
  '同步赛马赛',
  '实时排行榜',
  '语音聊天功能',
  '同步任务系统',
  '动态事件'
];

describe('containsNonLatinScript', () => {
  it('ölçümden gelen gerçek Çince başlıkların TAMAMINI reddeder', () => {
    for (const title of MEASURED_CHINESE_TITLES) {
      assert.equal(containsNonLatinScript(title), true, `reddedilmeliydi: ${title}`);
    }
  });

  it('Türkçe + Latin harfli teknik terim karışımını KABUL eder', () => {
    // EN KRİTİK REGRESYON: İngilizce KELİME avlanmaz, yalnız YAZI SİSTEMİNE bakılır.
    const legitimate = [
      "Unity'de multiplayer at sistemi, WebSocket ile senkronize edilecek.",
      'API üzerinden MVP kapsamını daralt.',
      'Photon PUN2 ile client-server mimarisi kur; RPC çağrılarını batch et.',
      'Realtime Database yerine Firestore kullan, offline-first cache aç.',
      'Netcode for GameObjects: NetworkTransform ve ClientNetworkTransform ayrımı.'
    ];
    for (const text of legitimate) {
      assert.equal(containsNonLatinScript(text), false, `kabul edilmeliydi: ${text}`);
    }
  });

  it('Türkçe özel harfleri Latin sayar', () => {
    const turkish = 'Çığır açan şu öğütücü İTİCİ güç: ıslak zemin, ĞÜŞÖÇ, İstanbul.';
    assert.equal(containsNonLatinScript(turkish), false);
  });

  it('Kiril, Arap, Hangul, Hiragana, Katakana, Yunan, İbrani ve Devanagari örneklerini yakalar', () => {
    const samples = [
      'Синхронизация лошадей в сети',
      'نظام الخيول متعدد اللاعبين',
      '멀티플레이어 말 시스템',
      'うまのしすてむをつくります',
      'マルチプレイヤーシステム',
      'Σύστημα αλόγων πολλαπλών παικτών',
      'מערכת סוסים לרב משתתפים',
      'बहुखिलाड़ी घोड़ा प्रणाली'
    ];
    for (const text of samples) {
      assert.equal(containsNonLatinScript(text), true, `yakalanmalıydı: ${text}`);
    }
  });

  it('emoji, rakam ve noktalama içeren Türkçe metni KABUL eder', () => {
    const noisy = [
      'At sistemi hazır 🐎🚀 — 3 aşamada, %80 kapsam!',
      '1) Ağ katmanı 2) Girdi 3) Animasyon… (v2.1, ~120ms)',
      '✅ MVP · ❌ sonraya — "at hızı" 12.5 m/s'
    ];
    for (const text of noisy) {
      assert.equal(containsNonLatinScript(text), false, `kabul edilmeliydi: ${text}`);
    }
  });

  it('kullanıcının meşru olarak yazabileceği KISA Latin dışı özel adı KABUL eder', () => {
    // Eşiğin varlık nedeni: "tek karakter yeter" kuralı bu vakayı KALICI
    // olarak reddeder ve tur her seferinde yedeğe düşerdi.
    assert.equal(containsNonLatinScript('小米 entegrasyonu için ağ katmanı'), false);
    assert.equal(containsNonLatinScript('原神 tarzı bir kamera kontrolü ekle'), false);
  });

  it('boş, boşluk ve harfsiz girdide KABUL eder', () => {
    assert.equal(containsNonLatinScript(''), false);
    assert.equal(containsNonLatinScript('   '), false);
    assert.equal(containsNonLatinScript('123 456 !?.,'), false);
  });

  it('SAF: aynı girdi aynı sonucu verir ve girdi değişmez', () => {
    const input = '同步跳跃机制';
    const first = containsNonLatinScript(input);
    const second = containsNonLatinScript(input);
    assert.equal(first, second);
    assert.equal(input, '同步跳跃机制');
  });
});

describe('findNonLatinScriptPaths', () => {
  it('iç içe çıktıda sapmış alanların yolunu verir', () => {
    const output = {
      cards: [
        { title: 'Ağ senkronizasyonu', description: 'Unity NetworkTransform ile konum eşitle.' },
        { title: '同步跳跃机制', description: 'Zıplama senkronizasyonu.' }
      ]
    };
    assert.deepEqual(findNonLatinScriptPaths(output), ['cards.1.title']);
  });

  it('temiz çıktıda boş dizi verir ve girdiyi değiştirmez', () => {
    const output = { cards: [{ title: 'Ağ katmanı', description: "Unity'de WebSocket." }] };
    const snapshot = JSON.stringify(output);
    assert.deepEqual(findNonLatinScriptPaths(output), []);
    assert.equal(JSON.stringify(output), snapshot);
  });
});

const cleanExpansionOutput = {
  cards: [1, 2, 3].map(index => ({
    id: `card-${index}`,
    title: `Ağ katmanı kararı ${index}`,
    description: `Unity içinde ${index}. ağ kararı: WebSocket ile at konumu eşitlenir.`,
    kind: 'feature',
    effort: 'medium',
    impact: 'high',
    deliveryHorizon: 'core'
  }))
};

const deviantExpansionOutput = {
  cards: MEASURED_CHINESE_TITLES.slice(0, 3).map((title, index) => ({
    id: `card-${index}`,
    title,
    description: '实时同步机制与共享资源系统的实现细节说明。',
    kind: 'feature',
    effort: 'medium',
    impact: 'high',
    deliveryHorizon: 'core'
  }))
};

function expansionProject() {
  return createProjectDocument({
    idea: 'unityde bir at sistemi yapmak istiyorum multiplayer olucak',
    name: 'Dil sapması'
  });
}

describe('Orchestrator dil sapması koruması', () => {
  it('sapmış çıktıyı reddeder ve onarım döngüsünü YENİDEN DENETİR', async () => {
    let calls = 0;
    const systems: string[] = [];
    const provider = {
      model: 'mock-model',
      async structured({ system }: { system: string }) {
        calls += 1;
        systems.push(system);
        if (calls === 1) return ideaExpansionTask.schema.parse(deviantExpansionOutput);
        return ideaExpansionTask.schema.parse(cleanExpansionOutput);
      }
    };

    const result = await runAITask({
      task: ideaExpansionTask,
      project: expansionProject(),
      provider,
      providerId: 'ollama',
      model: 'mock-model'
    });

    assert.equal(calls, 2, 'sapma tespit edilince yeniden denenmeliydi');
    assert.equal(result.provenance.retryCount, 1, 'sapma provenance.retryCount ile izlenebilmeli');
    assert.match(systems[1], /Latin harfleriyle/, 'onarım isteminde dil düzeltmesi olmalı');
    assert.match(systems[1], /cards\.0\.title/, 'onarım istemi sapan alanı göstermeli');
  });

  it('temiz çıktıda hiç yeniden deneme yapmaz', async () => {
    let calls = 0;
    const provider = {
      model: 'mock-model',
      async structured() {
        calls += 1;
        return ideaExpansionTask.schema.parse(cleanExpansionOutput);
      }
    };
    const result = await runAITask({
      task: ideaExpansionTask,
      project: expansionProject(),
      provider,
      providerId: 'ollama',
      model: 'mock-model'
    });
    assert.equal(calls, 1);
    assert.equal(result.provenance.retryCount, 0);
  });

  it('denemeler tükenince hata fırlatır; çağıran mevcut yedek yola düşer', async () => {
    let calls = 0;
    const provider = {
      model: 'mock-model',
      async structured() {
        calls += 1;
        return ideaExpansionTask.schema.parse(deviantExpansionOutput);
      }
    };

    await assert.rejects(
      runAITask({
        task: ideaExpansionTask,
        project: expansionProject(),
        provider,
        providerId: 'ollama',
        model: 'mock-model'
      }),
      (error: Error) => {
        assert.match(error.message, /Latin dışı/);
        return true;
      }
    );
    assert.equal(calls, ideaExpansionTask.maxRepairAttempts + 1, 'tüm onarım denemeleri harcanmalı');
  });

  it('korumasız görevde çıktıya dokunmaz', () => {
    // Kapsam kararı testle sabitlenir: `idea-lab` istemi bir çıktı dili
    // BELİRTMEZ, bu yüzden koruma kapsamı dışındadır.
    assert.equal(
      (ideaLabTask as { guardsOutputLanguage?: boolean }).guardsOutputLanguage,
      undefined
    );
  });
});

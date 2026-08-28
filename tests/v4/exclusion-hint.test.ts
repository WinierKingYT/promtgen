import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerLooksLikeExclusion as ideaAnswerLooksLikeExclusion } from '../../src/react/components/IdeaStagePanel.js';
import { answerLooksLikeExclusion as solutionAnswerLooksLikeExclusion } from '../../src/react/components/SolutionStagePanel.js';

/**
 * Kalan boşluk: kullanıcı karışık bir cümleyi TAMAMEN pozitif "Kararın"
 * kutusuna yazıp negatif kutuyu boş bırakabiliyor. O zaman "SMS yok" yine
 * `must` gereksinimine dönüşüyor — ama bu sefer kullanıcının kendi görünür
 * eylemiyle, sessiz bir kuralla değil. Bu test, panellerin bunu SEZDİĞİNİ
 * (asla düzeltmediğini, yalnız sezdiğini) doğruluyor.
 *
 * Kasıtlı olarak GENİŞ kalıp (`OUT_OF_SCOPE_PATTERN`,
 * discovery-answer-service.ts) kullanılıyor — `conversion-v2.ts`'teki dar
 * `EXPLICIT_EXCLUSION_PATTERN` DEĞİL. "daha sonra" örneği bunu kanıtlıyor:
 * dar kalıpta hiç yok, geniş kalıpta var.
 */
describe('Pozitif kutuya karışmış dışlama ipucu — kalıp tespiti', () => {
  const detectors = [
    ['IdeaStagePanel', ideaAnswerLooksLikeExclusion],
    ['SolutionStagePanel', solutionAnswerLooksLikeExclusion]
  ] as const;

  for (const [label, detect] of detectors) {
    it(`${label}: "Hatırlatma e-posta ile; SMS yok." dışlama içerir`, () => {
      assert.equal(detect('Hatırlatma e-posta ile; SMS yok.'), true);
    });

    it(`${label}: "Ödeme tahsilatı kapsam dışı." dışlama içerir`, () => {
      assert.equal(detect('Ödeme tahsilatı kapsam dışı.'), true);
    });

    it(`${label}: "Bu özellik daha sonra eklenecek." dışlama içerir (yalnız GENİŞ kalıpta yakalanır)`, () => {
      assert.equal(detect('Bu özellik daha sonra eklenecek.'), true);
    });

    it(`${label}: "Hatırlatma e-posta ile." temiz cevapta dışlama SEZİLMEZ`, () => {
      assert.equal(detect('Hatırlatma e-posta ile.'), false);
    });

    it(`${label}: boş cevapta dışlama SEZİLMEZ`, () => {
      assert.equal(detect(''), false);
    });
  }
});

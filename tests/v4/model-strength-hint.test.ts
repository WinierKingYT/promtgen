import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getModelStrengthHint,
  isLocalProvider,
  parseModelParamBillions
} from '../../src/v4/application/model-strength-hint.js';

describe('isLocalProvider', () => {
  it('offline ve ollama YEREL sayılır (bkz. provider-settings.ts)', () => {
    assert.equal(isLocalProvider('offline'), true);
    assert.equal(isLocalProvider('ollama'), true);
  });

  it('nvidia/openai/gemini yerel SAYILMAZ', () => {
    assert.equal(isLocalProvider('nvidia'), false);
    assert.equal(isLocalProvider('openai'), false);
    assert.equal(isLocalProvider('gemini'), false);
  });
});

describe('parseModelParamBillions', () => {
  it('"qwen2.5:7b" gibi etiketten parametre sayısını çıkarır', () => {
    assert.equal(parseModelParamBillions('qwen2.5:7b'), 7);
  });

  it('"llama3.2" gibi sayı taşımayan etikette null döner (sessizce başarısız olur, hata fırlatmaz)', () => {
    assert.equal(parseModelParamBillions('llama3.2'), null);
  });

  it('ondalıklı parametre sayısını da çözer', () => {
    assert.equal(parseModelParamBillions('phi3.5:3.8b'), 3.8);
  });

  it('boş/undefined girdide null döner', () => {
    assert.equal(parseModelParamBillions(''), null);
  });
});

describe('getModelStrengthHint', () => {
  const abstractCategory = { isAbstract: true as const };
  const concreteCategory = {};

  it('yerel sağlayıcı + soyut kategori: ipucu döner', () => {
    const hint = getModelStrengthHint({ providerId: 'ollama', model: 'llama3.2' }, abstractCategory);
    assert.ok(hint && hint.length > 0);
  });

  it('uzak sağlayıcı + AYNI soyut kategori: ipucu YOKTUR (local olmayan sağlayıcıda gösterilmez)', () => {
    const hint = getModelStrengthHint({ providerId: 'nvidia', model: 'z-ai/glm-5.2' }, abstractCategory);
    assert.equal(hint, null);
  });

  it('yerel sağlayıcı + İŞARETLENMEMİŞ kategori: ipucu YOKTUR (yokluk bir iddia değildir)', () => {
    const hint = getModelStrengthHint({ providerId: 'ollama', model: 'qwen2.5:7b' }, concreteCategory);
    assert.equal(hint, null);
  });

  it('boyutu ayrıştırılamayan model etiketinde bile ipucu SESSİZCE devre dışı KALMAZ', () => {
    const hint = getModelStrengthHint({ providerId: 'ollama', model: 'llama3.2' }, abstractCategory);
    assert.ok(hint && hint.length > 0, 'boyut bilinmese de yerel+soyut kombinasyonu uyarı vermeli');
  });

  it('boyut ayrıştırılabildiğinde ipucu metni ZENGİNLEŞİR (parametre sayısı geçer)', () => {
    const hint = getModelStrengthHint({ providerId: 'ollama', model: 'qwen2.5:7b' }, abstractCategory);
    assert.ok(hint && hint.includes('7B'), 'ipucu ayrıştırılan boyutu içermeli');
  });

  it('offline sağlayıcıda da (ollama olmasa bile) local kabul edilir', () => {
    const hint = getModelStrengthHint({ providerId: 'offline', model: 'promtgen-local' }, abstractCategory);
    assert.ok(hint && hint.length > 0);
  });
});

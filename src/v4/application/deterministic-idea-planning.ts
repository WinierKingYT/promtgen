import type {
  ExpansionDimension,
  GenerationProvenance,
  ProjectDocumentV5,
  SuggestionBundle,
  SuggestionItem
} from '../contracts.js';
import type {
  DiscoveryOutput,
  IdeaLabOutput
} from '../ai/schemas/schemas.js';
import { DISCOVERY_SCHEMA_ID } from '../ai/schemas/schemas.js';
import { getTaskDefinition } from '../ai/registry.js';
import { classifyProjectDomain, type ProjectDomain } from '../ai/domain-classifier.js';
import { proposeNextOptions } from '../planning-engine.js';
import { createInitialConceptInterpretation } from './idea-discussion-service.js';
import type { DiscoverySuggestionBundle } from './discovery-generation-service.js';

const discoveryTask = getTaskDefinition('discovery');
const VALID_SECTIONS = new Set([
  'vision', 'objectives', 'scope', 'requirements', 'decisions', 'architecture',
  'security', 'tasks', 'risks', 'testing', 'deployment', 'operations'
]);
const VALID_KINDS = new Set(['feature', 'decision', 'risk', 'question', 'architecture']);

function createId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function fingerprint(value: string): string {
  return String(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getSeenSuggestionFingerprints(project: ProjectDocumentV5): Set<string> {
  return new Set([
    ...project.proposalStore.bundles
      .flatMap(bundle => bundle.items)
      .filter(item => item.status !== 'deferred')
      .map(item => item.fingerprint),
    ...(project.ideaDiscussion?.records || [])
      .filter(record => record.status !== 'deferred')
      .map(record => fingerprint(record.text))
  ]);
}

interface ExpansionProfile {
  problems: string[];
  users: string[];
  differentiators: string[];
  models?: string[];
}

const EXPANSION_PROFILES: Record<ProjectDomain, ExpansionProfile> = {
  game: {
    problems: ['Eğlenceli ve tekrar oynanabilir deneyim', 'Rekabetçi veya ortak çok oyunculu ortam', 'Yaratıcılık ve dünya inşası'],
    users: ['Casual oyuncular', 'Rekabetçi oyuncular', 'Mod ve içerik üreticileri'],
    differentiators: ['Özgün mekanik', 'Güçlü görsel/ses kimliği', 'Topluluk ve mod desteği'],
    models: ['Ücretsiz temel + ücretli içerik', 'Tek seferlik satın alma', 'Abonelik tabanlı erişim']
  },
  web: {
    problems: ['Tekrarlayan işleri hızlandırma', 'Kullanıcı ve müşterilere kolay erişim', 'Veri takibi ve karar desteği'],
    users: ['Bireysel kullanıcılar', 'Küçük işletmeler', 'Kurumsal ekipler'],
    differentiators: ['Hızlı ve sade arayüz', 'Entegrasyon ve özelleştirme', 'Kontrollü AI önerileri']
  },
  mobile: {
    problems: ['Her yerden erişilebilir araç', 'Günlük işleri hızlandırma', 'Bildirim ve kişisel takip'],
    users: ['Bireysel mobil kullanıcılar', 'Çalışan profesyoneller', 'Aile ve eğitim kullanıcıları'],
    differentiators: ['Çevrimdışı çalışma', 'Çok platformlu deneyim', 'Cihaz donanımı entegrasyonu']
  },
  ai: {
    problems: ['Manuel analiz işlerini azaltma', 'Veriden hızlı içgörü üretme', 'Kişiselleştirilmiş yardım'],
    users: ['Geliştiriciler', 'İçerik üreticileri', 'Analist ve araştırmacılar'],
    differentiators: ['Çoklu model desteği', 'Kaynaklı RAG hafızası', 'Gizlilik odaklı yerel çalışma']
  },
  general: {
    problems: ['Bir iş sürecini kolaylaştırma', 'Zaman veya maliyet azaltma', 'Bilgiye erişimi iyileştirme'],
    users: ['Bireysel kullanıcılar', 'Niş sektör profesyonelleri', 'Küçük ekipler'],
    differentiators: ['Düşük öğrenme eğrisi', 'Local-first gizlilik', 'Genişletilebilir yapı']
  }
};

export function generateExpansionDimensions(idea: string): ExpansionDimension[] {
  const domain = classifyProjectDomain(String(idea || '').toLowerCase());
  const profile = EXPANSION_PROFILES[domain];
  return [
    { id: 'problem', icon: '🎯', label: 'Problem', question: 'Bu proje hangi sorunu çözüyor veya ne sunuyor?', options: profile.problems },
    { id: 'user', icon: '👥', label: 'Hedef Kullanıcı', question: 'Kimler kullanacak?', options: profile.users },
    { id: 'unique', icon: '✨', label: 'Farkı Ne?', question: 'Sizi öne çıkaran en önemli özellik nedir?', options: profile.differentiators },
    { id: 'scale', icon: '📈', label: 'Ölçek', question: 'Ne büyüklükte bir proje hayal ediyorsunuz?', options: ['Kişisel veya hobi projesi', 'Erken aşama ürün', 'Büyük platform veya kurumsal çözüm'] },
    { id: 'model', icon: '💰', label: 'Çalışma Modeli', question: 'Proje nasıl çalışacak veya sürdürülecek?', options: profile.models || ['Ücretsiz ve açık kaynak', 'SaaS aboneliği', 'Tek seferlik lisans'] }
  ];
}

export function buildDiscoverySystemPrompt(project: ProjectDocumentV5): string {
  return discoveryTask.buildPrompt(project);
}

export function mapDiscoveryOutput(
  project: ProjectDocumentV5,
  response: DiscoveryOutput,
  providerId: string,
  provenance: GenerationProvenance
): DiscoverySuggestionBundle | null {
  const seen = getSeenSuggestionFingerprints(project);
  const items: SuggestionItem[] = [];
  for (const option of response.options) {
    const optionFingerprint = fingerprint(option.title);
    if (!optionFingerprint || seen.has(optionFingerprint) || items.some(item => item.fingerprint === optionFingerprint)) continue;
    const affectedSections = option.affectedSections.filter(section => VALID_SECTIONS.has(section));
    items.push({
      id: createId('suggestion'),
      fingerprint: optionFingerprint,
      kind: VALID_KINDS.has(option.kind) ? option.kind : 'feature',
      title: option.title.trim(),
      description: option.description.trim(),
      pros: option.pros,
      cons: option.cons,
      effort: option.effort,
      impact: option.impact,
      recommended: option.recommended,
      recommendationReason: option.recommended
        ? 'AI, mevcut canonical plan ve açık belirsizliklere göre bu seçeneği öne çıkardı.'
        : '',
      affectedSections: affectedSections.length ? affectedSections : ['scope'],
      dependencies: [],
      status: 'pending'
    });
  }
  if (items.length < 3) return null;
  return {
    id: createId('bundle'),
    title: response.summary || 'AI ile üretilen sıradaki kararlar',
    phase: project.lifecycle.activePhase,
    status: 'open',
    createdAt: new Date().toISOString(),
    items: items.slice(0, 5),
    replyMessage: response.reply || response.summary,
    analysisNote: response.analysisNote || 'Mimari etki ve belirsizlik skoru güncellendi.',
    openQuestions: response.openQuestions.slice(0, 3),
    uncertainty: response.uncertainty,
    optionalPaths: response.optionalPaths,
    nextQuestionText: response.nextQuestionText,
    source: { type: 'ai', providerId },
    provenance
  };
}

const DISCOVERY_QUESTIONS: Record<ProjectDomain, [string, string, string]> = {
  game: ['Tek oyunculu prototip mi, sunucu yetkili çok oyunculu yapı mı?', 'Arcade fizik mi, simülasyon mu?', 'Mod desteği planlanıyor mu?'],
  web: ['Yetkilendirme ve veri gizliliği nasıl kurulacak?', 'Monolitik MVP mi, API-first modüler yapı mı?', 'Öncelikli performans hedefi nedir?'],
  mobile: ['Offline-first çalışma gerekli mi?', 'Cihaz içi veri ve arka plan senkronizasyonu gerekli mi?', 'Bildirim ve cihaz izinleri MVP içinde mi?'],
  ai: ['Bulut modeli mi, yerel model mi kullanılacak?', 'Kaynaklı RAG hafızası gerekli mi?', 'Şema doğrulama ve fallback zorunlu mu?'],
  general: ['MVP’nin çözeceği tek kritik sorun nedir?', 'Yerel veri mi, bulut senkronizasyonu mu öncelikli?', 'Gelecekteki genişleme için hangi sınırlar konmalı?']
};

export function createDiscoveryFallback(
  project: ProjectDocumentV5,
  direction: string,
  reason = ''
): DiscoverySuggestionBundle {
  const fallback = proposeNextOptions(project, { direction }) as unknown as SuggestionBundle;
  const rawIdea = String(project.identity.originalIdea || 'Proje').trim();
  const questions = DISCOVERY_QUESTIONS[classifyProjectDomain(rawIdea)];
  const now = new Date().toISOString();
  return {
    ...fallback,
    replyMessage: direction
      ? `"${direction.slice(0, 80)}" yönlendirmenizi inceledim. Sıradaki üç karar: ${questions.join(' ')}`
      : `"${rawIdea.slice(0, 40)}" fikrinin kapsam ve mimari kararlarını inceleyebilirsiniz.`,
    analysisNote: direction
      ? 'Kullanıcı yönlendirmesine göre kapsam, risk ve uygulama etkisi değerlendirildi.'
      : 'Başlangıç fikri deterministik planlama kurallarıyla değerlendirildi.',
    source: { type: 'local', providerId: 'offline', fallbackReason: reason },
    openQuestions: questions,
    provenance: {
      runId: createId('fallback-run'),
      mode: reason ? 'fallback' : 'rule-engine',
      providerId: 'offline',
      model: null,
      promptVersion: discoveryTask.promptVersion,
      requestedAt: now,
      completedAt: now,
      latencyMs: 0,
      retryCount: 0,
      fallbackReason: reason || null,
      schemaId: DISCOVERY_SCHEMA_ID,
      schemaVersion: 1,
      inputHash: 'not-sent-to-provider'
    }
  };
}

interface ApproachProfile {
  simple: [string, string, string];
  modular: [string, string, string];
  advanced: [string, string, string];
  risks: [string, string];
}

const APPROACH_PROFILES: Record<ProjectDomain, ApproachProfile> = {
  game: {
    simple: ['Sade Arcade Prototip', 'Mekanikleri sade tutan hızlı oynanabilir prototip.', 'Hızlı Prototip'],
    modular: ['Modüler ve Senkronize Oyun Mimarisi', 'Varlıkları ayrıştıran ve server-authority yaklaşımına hazır yapı.', 'Modüler Server-Authority'],
    advanced: ['Gelişmiş Fizik, IK ve Otonom Sistem', 'Derin fizik, IK ve davranış bileşenleri.', 'Simülasyon ve IK'],
    risks: ['Ağ senkronizasyon gecikmesi', 'Fizik ve animasyonun FPS etkisi']
  },
  web: {
    simple: ['Sade Monolitik Web MVP', 'Tek dağıtım biriminde hızlı ürün doğrulama.', 'Sade Web MVP'],
    modular: ['Modüler API-First Web Mimarisi', 'Arayüz, iş mantığı ve veri katmanını sözleşmelerle ayırır.', 'Modüler API-First'],
    advanced: ['Dağıtık Servis Mimarisi', 'Bağımsız ölçeklenen servisler ve event tabanlı akış.', 'Dağıtık Servisler'],
    risks: ['Veritabanı darboğazı', 'Yetkilendirme açığı']
  },
  mobile: {
    simple: ['Çevrimiçi Mobil MVP', 'Uzak API’ye bağlı sade mobil istemci.', 'Online Mobil MVP'],
    modular: ['Local-First Mobil Mimarisi', 'Cihaz içi veri ve kontrollü arka plan senkronizasyonu.', 'Local-First Mobil'],
    advanced: ['Gelişmiş Cihaz İçi Orkestrasyon', 'Şifreleme, arka plan görevleri ve bildirim motoru.', 'Cihaz İçi Orkestrasyon'],
    risks: ['Senkronizasyon çakışması', 'İşletim sistemi arka plan kısıtları']
  },
  ai: {
    simple: ['Doğrudan LLM Adaptörü', 'Tek sağlayıcıyla sınırlı ve hızlı AI entegrasyonu.', 'Doğrudan LLM'],
    modular: ['Çoklu Sağlayıcı ve Şemalı AI Mimarisi', 'Provider adaptörleri, doğrulama ve açık fallback.', 'Şemalı AI Runtime'],
    advanced: ['Yerel Model ve Kaynaklı RAG', 'Yerel model ile kaynaklı doküman bağlamı.', 'Yerel RAG'],
    risks: ['Yanıt formatı değişikliği', 'Token veya donanım maliyeti']
  },
  general: {
    simple: ['Odaklı ve Sade MVP', 'Çekirdek kullanıcı değerini en az bileşenle doğrular.', 'Odaklı MVP'],
    modular: ['Modüler ve Katmanlı Mimari', 'İş mantığı, veri ve arayüzü sürdürülebilir sınırlarla ayırır.', 'Modüler Yapı'],
    advanced: ['Yüksek Ölçekli Sistem', 'Büyük yükler için dağıtık bileşenler ve izleme.', 'Yüksek Ölçek'],
    risks: ['Kapsam kayması', 'Erken karmaşıklaştırma']
  }
};

function buildApproach(
  id: string,
  profile: [string, string, string],
  effort: 'low' | 'medium' | 'high',
  recommended: boolean,
  scores: [number, number, number, number]
): IdeaLabOutput['approaches'][number] {
  return {
    id,
    title: profile[0],
    description: profile[1],
    pros: [effort === 'low' ? 'Hızlı doğrulama' : 'Sürdürülebilir genişleme'],
    cons: [effort === 'high' ? 'Yüksek ilk efor' : 'Gelecekte yeniden düzenleme gerekebilir'],
    risks: [effort === 'high' ? 'Erken karmaşıklaştırma' : 'Kapsamın yanlış seçilmesi'],
    effort,
    impact: effort === 'low' ? 'medium' : 'high',
    recommended,
    metrics: {
      effortScore: scores[0],
      networkLoad: scores[1],
      fpsImpact: scores[2],
      maintainability: scores[3]
    },
    presetAnswers: [`[${profile[2]}]`]
  };
}

export function generateLocalIdeaLabOutput(project: ProjectDocumentV5): IdeaLabOutput {
  const profile = APPROACH_PROFILES[classifyProjectDomain(project.identity.originalIdea)];
  return {
    approaches: [
      buildApproach('approach-simple', profile.simple, 'low', false, [1, 1, 1, 4]),
      buildApproach('approach-modular', profile.modular, 'medium', true, [3, 2, 2, 5]),
      buildApproach('approach-advanced', profile.advanced, 'high', false, [5, 4, 4, 2])
    ],
    ideaNotes: ['Çekirdek kullanıcı değeri', 'MVP kapsam sınırları', 'Sürdürülebilirlik kısıtları'],
    candidateDecisions: ['Önerilen modüler yaklaşım', 'İkincil özelliklerin MVP dışında tutulması'],
    candidateRisks: profile.risks
  };
}

interface ConceptProfile {
  features: [string, string];
  outOfScope: [string, string];
  question: string;
  risk: string;
}

const CONCEPT_PROFILES: Record<ProjectDomain, ConceptProfile> = {
  game: { features: ['Oyuncu kontrolü ve temel mekanikler', 'Sahne ve oyun döngüsü'], outOfScope: ['Derin NPC davranışı', 'İleri shader optimizasyonu'], question: 'Çok oyunculu senkronizasyon stratejisi ne olmalı?', risk: 'Ağ senkronizasyon gecikmesi' },
  web: { features: ['Temel sayfa ve kullanıcı akışları', 'Veri modeli ve API katmanı'], outOfScope: ['Gelişmiş analitik', 'Mikroservis ayrıştırması'], question: 'Yetkilendirme ve oturum modeli nasıl kurulacak?', risk: 'Veritabanı darboğazı' },
  mobile: { features: ['Temel ekran navigasyonu', 'Yerel veri ve API entegrasyonu'], outOfScope: ['Gelişmiş çakışma çözümü', 'Cihaz içi ML'], question: 'Offline veri çakışmaları nasıl çözülecek?', risk: 'Çevrimdışı veri çakışması' },
  ai: { features: ['Model çağrı ve prompt yönetimi', 'Yanıt doğrulama ve hata yönetimi'], outOfScope: ['Özel model eğitimi', 'Çok modlu giriş'], question: 'Model fallback ve maliyet kontrolü nasıl yapılacak?', risk: 'Model yanıt uyumsuzluğu' },
  general: { features: ['Çekirdek kullanıcı akışı', 'Temel veri ve entegrasyon katmanı'], outOfScope: ['İleri ölçekleme', 'Gelişmiş raporlama'], question: 'MVP’nin en kritik özelliği nedir?', risk: 'Kapsam kayması' }
};

export function generateConceptSummaryProject(
  project: ProjectDocumentV5,
  selectedApproachId = ''
): ProjectDocumentV5 {
  const localOutput = generateLocalIdeaLabOutput(project);
  const approaches = project.ideaLabSession?.approaches?.length
    ? project.ideaLabSession.approaches
    : localOutput.approaches;
  const selectedApproach = approaches.find(item => item.id === selectedApproachId)
    || approaches.find(item => item.recommended)
    || approaches[0];
  const rawIdea = String(project.identity.originalIdea || 'Proje').trim();
  const profile = CONCEPT_PROFILES[classifyProjectDomain(rawIdea)];
  const initial = project.ideaLabSession?.conceptSummary || createInitialConceptInterpretation(project);
  const approachTitle = selectedApproach?.title || 'Seçilen yaklaşım';
  const approachDescription = selectedApproach?.description || 'Projeye özel modüler mimari';
  const generatedFeatures = [`Temel mimari: ${approachTitle}`, ...profile.features];
  const next = structuredClone(project);
  next.ideaLabSession = {
    ...(next.ideaLabSession || {
      status: 'active',
      approaches,
      ideaNotes: localOutput.ideaNotes,
      candidateDecisions: localOutput.candidateDecisions,
      candidateRisks: localOutput.candidateRisks
    }),
    selectedApproachId: selectedApproach?.id,
    conceptSummary: {
      ...initial,
      summary: initial.summary || `"${rawIdea.slice(0, 60)}" için ${approachDescription} yaklaşımına dayanan konsept.`,
      confirmedFeatures: [...new Set([...initial.confirmedFeatures, ...generatedFeatures])],
      outOfScope: initial.outOfScope.length ? initial.outOfScope : profile.outOfScope,
      technicalApproaches: [approachDescription],
      openQuestions: initial.openQuestions.length ? initial.openQuestions : [profile.question],
      knownRisks: [...new Set([...initial.knownRisks, ...(selectedApproach?.risks || [profile.risk])])],
      mvpTarget: initial.mvpTarget || `"${rawIdea.slice(0, 40)}" için temel fonksiyonel prototip`,
      userConfirmed: false
    }
  };
  next.lifecycle.activePhase = 'CONCEPT_CONFIRMATION';
  return next;
}

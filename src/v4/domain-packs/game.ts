import type {
  DomainPackContribution,
  DomainPackDiscoveryQuestion,
  ModuleManifest,
  ProjectDocumentV5,
  Requirement,
  TaskContractV2,
  TestCase
} from '../contracts.js';

/**
 * Genel oyun sinyali. `classifyProjectDomain` (ai/domain-classifier.ts) ile
 * kasıtlı olarak birebir aynı değildir: orada bulunan 'engine' ve 'entity'
 * jenerik tokenlerini burada kullanmıyoruz çünkü bu paketin applicable=true
 * çıktısı, alan (domain) sınıflandırmasından bağımsız olarak tüm projelerde
 * genişletme ekseni ve alan sorusu görünürlüğünü etkileyebilir (bkz.
 * registry.collectExpansionAxes). Daha dar bir desen, oyunla ilgisiz
 * projelere yanlışlıkla oyun rehberliği sızmasını azaltır.
 */
const GAME_PATTERN = /oyun|game|unity|godot|unreal|s&box|multiplayer|platformer|arcade|\bnpc\b/i;
const MULTIPLAYER_PATTERN = /multiplayer|çok oyuncu|çok oyunculu|pvp|co-?op\b|matchmaking|lobi|lobby|dedicated server|sunucu yetkili|server authoritative|p2p|peer.to.peer|lockstep|senkron|netcode|lag compensation|client prediction|reconciliation/i;
const ASSET_PATTERN = /\b3d\b|3 boyutlu|karakter modeli|iskelet|\brig\b|animasyon|animation|texture|doku|shader|\blod\b|\bmesh\b|poligon|polygon|hazır varlık|asset store|özel üretim|sprite/i;

const DOMAIN_PACK: DomainPackContribution = {
  id: 'game',
  maturity: 'experimental',
  projectTypes: ['game-2d', 'game-3d', 'multiplayer-game'],
  limitations: [
    'Bu paket henüz benchmark veya gerçek kullanıcı kanıtı içermez; deneysel (experimental) aşamadadır.',
    'Oyun motoru, render pipeline veya ağ kütüphanesi seçimini otomatik yapmaz; teknoloji kararı kullanıcıya aittir.',
    'Performans, determinism ve ağ senkron kontrolleri planlama rehberidir; profil ölçümü, yük testi veya kare hızı garantisi değildir.'
  ],
  discoveryQuestions: [
    {
      id: 'game.core-loop',
      prompt: 'Oyuncu saniye saniye hangi tek fiili tekrarlıyor ve bu fiile bağlı geçişler nerede sürtünme yaratıyor?',
      rationale: 'Sistem listesinden önce çekirdek oyun döngüsünü ve oyuncunun elindeki ana eylemi sınırlar.',
      affectedSectionId: 'scope',
      appliesWhen: 'always'
    },
    {
      id: 'game.frame-budget',
      prompt: 'Hedef donanımda hedeflenen kare hızı nedir ve bu hıza ulaşılamazsa oyun ne yapar?',
      rationale: 'Performans bütçesini belirsiz bir "akıcı olsun" hedefinden gözlenebilir bir davranışa dönüştürür.',
      affectedSectionId: 'architecture',
      appliesWhen: 'always'
    },
    {
      id: 'game.input-latency',
      prompt: 'Girdi ile ekrandaki tepki arasındaki gecikme hedefi nedir; girdi arabelleğe alma (buffering) veya tolerans penceresi kullanılacak mı?',
      rationale: 'Kontrol hissini kod yazılmadan önce test edilebilir bir sınıra bağlar.',
      affectedSectionId: 'requirements',
      appliesWhen: 'always'
    },
    {
      id: 'game.network-authority',
      prompt: 'Bir varlığın konumuna ve durumuna kim karar veriyor: sunucu mu istemci mi; istemciye asla güvenilmeyecek olan nedir?',
      rationale: 'Ağ yetkisini ve hile yüzeyini sistem tasarımından önce açık bir karara bağlar.',
      affectedSectionId: 'architecture',
      appliesWhen: 'multiplayer'
    },
    {
      id: 'game.determinism-replay',
      prompt: 'Aynı girdi dizisi her zaman aynı sonucu üretiyor mu (determinism) ve bu replay veya resync ile nasıl doğrulanacak?',
      rationale: 'Senkron kaybını (desync) ve tekrar oynatılabilirliği tasarımın parçası yapar.',
      affectedSectionId: 'architecture',
      appliesWhen: 'multiplayer'
    },
    {
      id: 'game.asset-pipeline',
      prompt: 'Bir varlığı oyuna katmanın gerçek maliyeti nedir: iskelet/animasyon sayısı, poligon bütçesi, hazır varlık mı özel üretim mi?',
      rationale: 'Sanat ve içerik hattının maliyetini kapsam kararından önce görünür kılar.',
      affectedSectionId: 'requirements',
      appliesWhen: 'asset_pipeline'
    }
  ],
  /**
   * BY_DOMAIN.game (idea-expansion/categories.ts) ile kasıtlı olarak BİREBİR
   * aynı 5 kimlik ve içerik: eksen birleştirme kimliğe göre tekilleştirir ve
   * CORE + BY_DOMAIN her zaman pack eksenlerinden önce gelir (ilk kazanır).
   * Bu nedenle bu liste, oyun fikirlerinde panoya YENİ bir eksen eklemez;
   * yalnız pack aktivasyonundan bağımsız (fikir aşaması) görünürlüğü kanıtlanabilir
   * biçimde no-op yapar. BY_DOMAIN.game'i SİLME veya bu listeyi ondan
   * farklılaştırma — ikisi birbirinin yedeği değil, aynı ekseni iki kaynaktan
   * kasıtlı olarak tekrarlıyor.
   */
  expansionAxes: [
    {
      id: 'game-loop',
      label: 'Oyuncunun elindeki fiil',
      hint: 'Oyuncu saniye saniye ne yapıyor? Ana fiil ile ona bağlı geçişler arasında sürtünme nerede?',
      seedTitles: ['Ana fiili tek bir girdiye indir', 'Fiiller arası geçişi kesintisiz yap', 'Boşta geçen saniyeleri azalt']
    },
    {
      id: 'simulated-state',
      label: 'Simüle edilen durum',
      hint: 'Zamanla ne azalır, onu ne geri doldurur? Azalma hızı, geri kazanım yolu ve sıfıra inince ne olduğu oyuncuya nasıl görünür?',
      seedTitles: ['Azalan değeri sürekli görünür kıl', 'Sıfıra inince cezayı net tanımla', 'Geri kazanım için oyuncuya seçenek sun']
    },
    {
      id: 'network-authority',
      label: 'Ağ yetkisi ve senkron',
      hint: 'Bir varlığın konumuna ve durumuna kim karar verir: sunucu mu istemci mi? Hangi veri diğer oyunculara yayılır, sahiplik nasıl el değiştirir, istemciye asla güvenilmeyecek olan nedir?',
      seedTitles: ['Konumu sunucu yetkili yap, istemci yalnız tahmin etsin', 'Sahiplik devrini tek bir olayla tanımla', 'Hileye açık kararları istemciden çıkar']
    },
    {
      id: 'input-and-feel',
      label: 'Girdi ve his',
      hint: 'Kamera, kontrol şeması ve animasyon geçişleri birlikte nasıl hissettiriyor? Oyuncu bir eylemi yarıda kesip başka bir eyleme geçebiliyor mu?',
      seedTitles: ['Kamerayı tek bir referans noktasına bağla', 'Eylemi yarıda kesmeye izin ver', 'Kontrol şemasını tek bir cihazda ilk test et']
    },
    {
      id: 'content-pipeline',
      label: 'Sanat ve içerik hattı',
      hint: 'Bir varlığı oyuna katmanın gerçek maliyeti nedir: iskelet, animasyon sayısı, uzak mesafe görünümü, hazır varlık mı özel üretim mi?',
      seedTitles: ['İlk sürümde hazır varlık kullan', 'Animasyon sayısını en aza indir', 'Uzak mesafede daha basit görünüm kullan']
    }
  ],
  requirementGuidance: [
    {
      id: 'game.frame-budget',
      label: 'Kare hızı ve performans bütçesi',
      keywords: ['fps', 'kare hızı', 'frame', 'performans', 'optimizasyon', 'framerate'],
      acceptanceExamples: ['Hedef donanımda kare hızı düşmesi ölçülür ve alt sınır tanımlanır']
    },
    {
      id: 'game.network-authority',
      label: 'Sunucu yetkili ağ kararı',
      keywords: ['multiplayer', 'ağ', 'network', 'sunucu yetkili', 'senkron', 'netcode'],
      acceptanceExamples: ['Sunucu yetkili konum/durum kararı istemci hile senaryosuna karşı doğrulanır']
    },
    {
      id: 'game.determinism',
      label: 'Determinism ve replay doğrulaması',
      keywords: ['determinist', 'deterministik', 'replay', 'rollback', 'lockstep', 'resync'],
      acceptanceExamples: ['Aynı girdi kaydı tekrar oynatıldığında aynı sonucu üretir']
    },
    {
      id: 'game.input-feel',
      label: 'Girdi-tepki gecikmesi',
      keywords: ['girdi', 'input', 'gecikme', 'latency', 'buffer', 'coyote'],
      acceptanceExamples: ['Girdi-tepki gecikmesi tanımlanan hedef değeri aşmaz']
    },
    {
      id: 'game.asset-cost',
      label: 'Varlık ve animasyon maliyeti',
      keywords: ['asset', 'varlık', 'animasyon', 'rig', 'lod', 'poligon'],
      acceptanceExamples: ['Varlık başına poligon/animasyon maliyeti tanımlanan bütçenin içinde kalır']
    }
  ],
  riskGuidance: [
    {
      id: 'game.cheat-surface',
      title: 'İstemci tarafı karara güvenilerek hile yüzeyi açılması',
      appliesWhen: 'multiplayer',
      mitigationPrompt: 'Sunucu yetkili doğrulamayı ve istemci girdisine güvenmeyen bir hile tespiti negatif testini tanımla.'
    },
    {
      id: 'game.desync',
      title: 'İstemciler arası durum senkron kaybı (desync)',
      appliesWhen: 'multiplayer',
      mitigationPrompt: 'Determinism doğrulamasını ve checksum/resync kurtarma mekanizmasını tanımla.'
    },
    {
      id: 'game.frame-drop',
      title: 'Hedef donanımda kare hızının düşmesi',
      appliesWhen: 'always',
      mitigationPrompt: 'Performans bütçesini, profil ölçüm noktasını ve düşük donanım kabul testini tanımla.'
    },
    {
      id: 'game.asset-overrun',
      title: 'Varlık/animasyon maliyetinin bütçeyi aşması',
      appliesWhen: 'asset_pipeline',
      mitigationPrompt: 'Varlık başına poligon/animasyon bütçesini ve inceleme sürecini tanımla.'
    }
  ],
  taskContractGuidance: {
    expectedOutputs: [
      'Etkilenen oyun döngüsü adımı ve oyuncuya görünen geri bildirim',
      'Gerekliyse ağ yetkisi, determinism ve performans bütçesi kanıtı'
    ],
    completionEvidence: [
      'Ana oyun döngüsü hedef kare hızı ve girdi gecikmesi sınırı içinde doğrulandı',
      'Multiplayer ise istemciye güvenilmeyecek kararlar sunucu tarafında bırakılmadı'
    ]
  }
};

export const GAME_MODULE: ModuleManifest = {
  id: 'software.game',
  version: '1.0.0',
  name: 'Oyun Planlama Paketi',
  description: '2D/3D ve çok oyunculu oyun projeleri için oyun döngüsü, performans, girdi, ağ yetkisi ve içerik hattı planlama rehberi.',
  category: 'software',
  dependencies: ['software.core'],
  conflicts: [],
  triggers: ['oyun', 'game', 'unity', 'godot', 'unreal', 's&box', 'multiplayer', 'oyuncu'],
  contributions: {
    requiredSections: ['requirements', 'architecture', 'testing'],
    suggestedSections: ['risks', 'operations'],
    reviewerRuleIds: [
      'GAME-CORE-LOOP',
      'GAME-FRAME-BUDGET',
      'GAME-INPUT-LATENCY',
      'GAME-NETWORK-AUTHORITY',
      'GAME-DETERMINISM-REPLAY',
      'GAME-ASSET-PIPELINE'
    ],
    exportDocumentIds: ['requirements', 'architecture', 'test-strategy'],
    domainPack: DOMAIN_PACK
  }
};

export interface GameSignalSet {
  game: boolean;
  multiplayer: boolean;
  assetPipeline: boolean;
}

export interface GamePackCheck {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  sectionId: string;
  message: string;
  entityIds: string[];
}

function projectText(project: ProjectDocumentV5): string {
  const summary = project.ideaLabSession?.conceptSummary;
  return [
    project.identity.originalIdea,
    ...(summary?.confirmedFeatures || []),
    ...(project.requirements || []).map(item => `${item.title} ${item.statement} ${item.acceptanceCriteria.join(' ')}`),
    ...(project.decisions || []).map(item => `${item.title} ${item.decision} ${item.rationale}`)
  ].join(' ');
}

export function detectGameSignals(project: ProjectDocumentV5): GameSignalSet {
  const text = projectText(project);
  const domains = (project.profile?.domains || []).map(item => item.name).join(' ');
  return {
    game: GAME_PATTERN.test(`${text} ${domains}`),
    multiplayer: MULTIPLAYER_PATTERN.test(text),
    assetPipeline: ASSET_PATTERN.test(text)
  };
}

function applies(question: DomainPackDiscoveryQuestion, signals: GameSignalSet): boolean {
  if (question.appliesWhen === 'always') return true;
  if (question.appliesWhen === 'multiplayer') return signals.multiplayer;
  return question.appliesWhen === 'asset_pipeline' && signals.assetPipeline;
}

export function getGameDiscoveryQuestions(project: ProjectDocumentV5): DomainPackDiscoveryQuestion[] {
  const signals = detectGameSignals(project);
  return DOMAIN_PACK.discoveryQuestions.filter(question => applies(question, signals));
}

function acceptedText(project: ProjectDocumentV5, kind: 'requirement' | 'decision' | 'risk'): string {
  if (kind === 'requirement') {
    return project.requirements
      .filter(item => item.status === 'accepted' || item.status === 'implemented' || item.status === 'verified')
      .map(item => `${item.title} ${item.statement} ${item.acceptanceCriteria.join(' ')}`)
      .join(' ');
  }
  if (kind === 'decision') {
    return project.decisions
      .filter(item => item.status === 'accepted')
      .map(item => `${item.title} ${item.decision} ${item.rationale}`)
      .join(' ');
  }
  return project.risks.map(item => `${item.title} ${item.description} ${item.mitigation}`).join(' ');
}

export function assessGamePack(project: ProjectDocumentV5): {
  applicable: boolean;
  active: boolean;
  maturity: DomainPackContribution['maturity'];
  signals: GameSignalSet;
  checks: GamePackCheck[];
  discoveryQuestions: DomainPackDiscoveryQuestion[];
  limitations: string[];
} {
  const signals = detectGameSignals(project);
  const active = (project.modules?.active || []).some(item =>
    item.id === GAME_MODULE.id && item.version === GAME_MODULE.version
  );
  const requirementText = acceptedText(project, 'requirement');
  const decisionText = acceptedText(project, 'decision');
  const riskText = acceptedText(project, 'risk');
  const architectureText = `${project.sections.architecture?.content || ''} ${(project.sections.architecture?.items || []).join(' ')}`;
  const checks: GamePackCheck[] = [
    {
      id: 'game.core-loop',
      label: 'Çekirdek oyun döngüsü doğrulanmış',
      passed: Boolean(project.ideaLabSession?.conceptSummary?.userConfirmed && project.ideaLabSession.conceptSummary.confirmedFeatures.length),
      blocking: true,
      sectionId: 'scope',
      message: 'Oyuncunun saniye saniye tekrarladığı ana fiil MVP kapsamında onaylanmalı.',
      entityIds: []
    },
    {
      id: 'game.frame-budget',
      label: 'Performans bütçesi belirli',
      passed: /fps|kare hızı|frame budget|framerate|performans bütçesi|60 fps|30 fps/i.test(`${requirementText} ${decisionText} ${architectureText}`),
      blocking: false,
      sectionId: 'architecture',
      message: 'Hedef donanımda kare hızı hedefi ve düşme davranışı karara bağlanmalı.',
      entityIds: []
    },
    {
      id: 'game.input-latency',
      label: 'Girdi-tepki gecikmesi tanımlı',
      passed: /gecikme|latency|input buffer|coyote|tepki süresi|responsive/i.test(`${requirementText} ${decisionText}`),
      blocking: false,
      sectionId: 'requirements',
      message: 'Girdi ile ekran tepkisi arasındaki gecikme hedefi ve tolerans penceresi tanımlanmalı.',
      entityIds: []
    }
  ];
  if (signals.multiplayer) {
    checks.push({
      id: 'game.network-authority',
      label: 'Ağ yetkisi kararı belirli',
      passed: /sunucu yetkili|server authoritative|client prediction|lag compensation|reconciliation|netcode/i.test(`${requirementText} ${decisionText} ${architectureText}`),
      blocking: true,
      sectionId: 'architecture',
      message: 'Multiplayer projede varlık konum/durum yetkisinin sunucuda mı istemcide mi olduğu açıkça karara bağlanmalıdır.',
      entityIds: []
    });
    checks.push({
      id: 'game.determinism-replay',
      label: 'Determinism ve replay doğrulaması belirli',
      passed: /determinist|deterministik|replay|rollback|lockstep|resync|checksum/i.test(`${requirementText} ${decisionText} ${riskText} ${architectureText}`),
      blocking: true,
      sectionId: 'architecture',
      message: 'Aynı girdi dizisinin aynı sonucu ürettiği (determinism) ve senkron kaybının nasıl tespit edileceği tanımlanmalıdır.',
      entityIds: []
    });
  }
  if (signals.assetPipeline) {
    checks.push({
      id: 'game.asset-pipeline',
      label: 'Varlık/animasyon maliyeti belirli',
      passed: /lod|poligon|polygon bütçesi|hazır varlık|asset store|özel üretim|animasyon sayısı|rig bütçesi/i.test(`${requirementText} ${decisionText}`),
      blocking: false,
      sectionId: 'requirements',
      message: 'Varlık başına iskelet/animasyon maliyeti ve hazır varlık mı özel üretim mi olduğu tanımlanmalıdır.',
      entityIds: []
    });
  }
  return {
    applicable: signals.game,
    active,
    maturity: DOMAIN_PACK.maturity,
    signals,
    checks,
    discoveryQuestions: getGameDiscoveryQuestions(project),
    limitations: DOMAIN_PACK.limitations
  };
}

export function enrichGameTaskContract(
  project: ProjectDocumentV5,
  requirement: Requirement,
  contract: TaskContractV2
): TaskContractV2 {
  const assessment = assessGamePack(project);
  if (!assessment.active) return contract;
  const guidance = DOMAIN_PACK.requirementGuidance
    .filter(item => item.keywords.some(keyword => `${requirement.title} ${requirement.statement}`.toLocaleLowerCase('tr-TR').includes(keyword)))
    .flatMap(item => item.acceptanceExamples);
  return {
    ...contract,
    expectedOutputs: [...new Set([...contract.expectedOutputs, ...DOMAIN_PACK.taskContractGuidance.expectedOutputs])],
    completionEvidence: [
      ...new Set([
        ...contract.completionEvidence,
        ...DOMAIN_PACK.taskContractGuidance.completionEvidence,
        ...guidance.map(item => `Alan kabul örneği: ${item}`)
      ])
    ]
  };
}

export function gameTestKind(requirement: Requirement): TestCase['kind'] {
  const text = `${requirement.title} ${requirement.statement}`.toLocaleLowerCase('tr-TR');
  if (/hile|cheat|sunucu yetkili|server authoritative|güven/.test(text)) return 'security';
  if (/ağ|network|multiplayer|senkron|desync|matchmaking|lobi|netcode/.test(text)) return 'integration';
  if (/ana akış|oyuncu akışı|core loop|oyun döngüsü|kullanıcı akışı/.test(text)) return 'e2e';
  return requirement.kind === 'quality' ? 'integration' : 'acceptance';
}

import { ideaApprovalReadiness } from './idea-approval.js';
import { solutionApprovalReadiness } from './solution-approval.js';
import type { Concern, ConcernDecision, ProjectDocumentV5 } from '../contracts.js';
import { splitClauses } from './discovery-answer-service.js';

/**
 * Conversion V2 — Uygulama Planı'na geçiş.
 *
 * V2'de tek yapısal değişiklik var ama büyük: `Idea → Plan` doğrudan geçişi
 * kaldırıldı. Plan artık **iki kapıdan** sonra üretilir. Bugün teknik kararlar
 * ya hiç konuşulmuyor ya da gereksinimlerin içine gömülüyor; kapı bunu
 * imkânsız hâle getiriyor.
 *
 * **Göç cezaya çevrilmez.** V3 öncesi belgelerde `ideaDesign` boş ve onay
 * `draft`. Bunlara kapıyı uygulasaydık, çalışan her mevcut proje bir anda
 * dönüştürülemez hâle gelirdi. Bu yüzden kapı yalnız aşama modeline **girmiş**
 * belgelerde geçerli; eski belgeler eski yoldan dönüşmeye devam eder. İki model
 * bir süre yan yana yaşar — `planningPhaseToStage` ile kurulan aynı ilke.
 */

/**
 * Belge aşama modeline girmiş mi?
 *
 * Ölçüt **kullanıcının eylemi**, sistemin eylemi değil: bir konuyu karara
 * bağlamak, ertelemek, kapsam dışı bırakmak ya da bir onay sürecini başlatmak.
 *
 * Konuların **var olması** yetmez. Keşif turu her turda konu üretiyor; bunu
 * ölçüt saysaydık, kullanıcı tek bir keşif turu çalıştırdığı anda ürünün akışı
 * altından değişir ve planı iki yeni onayın ardında bulurdu. Konu üretmek
 * sistemin yolu **önermesi**; o yola girmek kullanıcının kararı.
 *
 * Bayrak alanı tutmuyoruz çünkü bayrak, belgenin gerçek durumundan sapabilirdi.
 */
export function usesStageModel(project: ProjectDocumentV5): boolean {
  const idea = project.ideaDesign;
  const solution = project.solutionDesign;
  if (!idea || !solution) return false;
  if (idea.approval.status !== 'draft' || solution.approval.status !== 'draft') return true;
  return [...idea.concerns, ...solution.concerns].some(concern => concern.status !== 'open');
}

/**
 * Aşama paneli gösterilsin mi?
 *
 * `usesStageModel`'den ayrı bir soru: panel, kullanıcının o yola **girmesini**
 * sağlayan şey. Girmiş olmasını beklemek, kapıyı ardından kilitlemek olurdu.
 * Ölçüt "cevaplanacak somut bir konu var mı" — boş bir form kullanıcıya neyi
 * cevapladığını anlatmaz.
 */
export function stageWorkAvailable(project: ProjectDocumentV5): boolean {
  if (!project.ideaDesign || !project.solutionDesign) return false;
  return usesStageModel(project)
    || project.ideaDesign.concerns.length > 0
    || project.solutionDesign.concerns.length > 0;
}

/**
 * Aşama modelinden gelen dönüşüm engelleri.
 *
 * Sırayla bildirilir: fikir kapısı geçilmeden teknik kapının engelini
 * göstermek, kullanıcıya henüz sırası gelmemiş bir işi göstermek olurdu.
 */
export function stageConversionBlockers(project: ProjectDocumentV5): string[] {
  if (!usesStageModel(project)) return [];

  const idea = ideaApprovalReadiness(project);
  if (!idea.canApprove) {
    return [`Fikir tasarımında ${idea.obstacles.length} engel var; plan üretilemez.`];
  }
  if (project.ideaDesign.approval.status !== 'approved') {
    return ['Fikir tasarımı onaylanmadan plan üretilemez.'];
  }

  const solution = solutionApprovalReadiness(project);
  if (!solution.canApprove) {
    return [`Teknik tasarımda ${solution.obstacles.length} engel var; plan üretilemez.`];
  }
  if (project.solutionDesign.approval.status !== 'approved') {
    return ['Teknik çözüm tasarımı onaylanmadan plan üretilemez.'];
  }

  return [];
}

export interface ConversionSources {
  /** Plana taşınacak kabul edilmiş fikir kararlarının kimlikleri. */
  ideaDecisionIds: string[];
  /** Plana taşınacak kabul edilmiş teknik kararların kimlikleri. */
  technicalDecisionIds: string[];
  /**
   * Kullanıcının "gerek yok" dediği konular. Kapsam disiplini bir **çıktıdır**:
   * elenen şey de değerli bir sonuçtur ve plana kapsam dışı olarak yazılır.
   */
  outOfScope: string[];
  /** Ertelenenler kaybolmaz; plana varsayım/açık konu olarak taşınır. */
  deferred: string[];
  openQuestions: string[];
}

const titlesWithStatus = (concerns: readonly Concern[], status: Concern['status']) =>
  concerns.filter(concern => concern.status === status).map(concern => concern.title);

/**
 * Dönüşümün besleneceği kaynaklar.
 *
 * Hiçbir şey uydurulmaz ve hiçbir şey sessizce düşmez: ertelenen ve "bu projeye
 * ait değil" denen konular da adlarıyla taşınır. Sessiz düşüş, kullanıcının
 * verdiği kararı görünmez kılardı.
 */
export function conversionSources(project: ProjectDocumentV5): ConversionSources {
  const ideaConcerns = project.ideaDesign?.concerns || [];
  const solutionConcerns = project.solutionDesign?.concerns || [];
  const accepted = (project.decisions || []).filter(decision => decision.status === 'accepted');

  return {
    ideaDecisionIds: accepted.filter(decision => decision.stage === 'idea').map(decision => decision.id),
    technicalDecisionIds: accepted.filter(decision => decision.stage === 'technical').map(decision => decision.id),
    outOfScope: [
      ...titlesWithStatus(ideaConcerns, 'irrelevant'),
      ...titlesWithStatus(solutionConcerns, 'irrelevant')
    ],
    deferred: [
      ...titlesWithStatus(ideaConcerns, 'deferred'),
      ...titlesWithStatus(solutionConcerns, 'deferred')
    ],
    openQuestions: [
      ...(project.ideaDesign?.openQuestions || []),
      ...(project.solutionDesign?.openQuestions || [])
    ]
  };
}

/** Aşama kararlarının plana yazıldığı blok; her dönüşümde yeniden kurulur. */
const SCOPE_MARKER = 'Aşama kararların:';

/**
 * Kapsam kararlarını plana taşır.
 *
 * **Kapsam disiplini bir çıktıdır.** Kullanıcı "bu projeye ait değil" ya da
 * "sonra" dediğinde bir iş yapmıştır; bunu plana yazmazsak o emek görünmez
 * olur ve aynı konu bir sonraki turda yeniden tartışılır.
 *
 * Ertelenen ile kapsam dışı **ayrı** yazılır: "sonra" geri dönülebilir bir
 * karardır, "ait değil" değil. İkisini aynı listeye koymak, kullanıcının
 * verdiği iki farklı kararı tek karara indirgerdi.
 *
 * Blok işaretli ve her seferinde yeniden kurulduğu için dönüşüm tekrarlansa da
 * içerik çoğalmaz.
 */
export function applyStageScopeToPlan(project: ProjectDocumentV5): ProjectDocumentV5 {
  const sources = conversionSources(project);
  if (!sources.outOfScope.length && !sources.deferred.length) return project;

  const scope = project.sections?.scope;
  if (!scope) return project;

  const block = [
    SCOPE_MARKER,
    ...(sources.outOfScope.length
      ? ['Kapsam dışı bırakılanlar:', ...sources.outOfScope.map(title => `- ${title}`)]
      : []),
    ...(sources.deferred.length
      ? ['Sonraya bırakılanlar:', ...sources.deferred.map(title => `- ${title}`)]
      : [])
  ].join('\n');

  const existing = String(scope.content || '');
  const base = existing.includes(SCOPE_MARKER)
    ? existing.slice(0, existing.indexOf(SCOPE_MARKER)).trimEnd()
    : existing.trimEnd();

  return {
    ...project,
    sections: {
      ...project.sections,
      scope: { ...scope, content: base ? [base, block].join('\n\n') : block, status: 'draft' }
    }
  };
}

/**
 * Karara bağlanmış bir konunun cevabını yan cümlelere böler ve her cümleyi
 * onaylanan özellik (confirmedFeatures) ya da dışlanan (outOfScope) olarak
 * sınıflandırır. Cümle bölme `discovery-answer-service.ts`den (splitClauses)
 * yeniden kullanılır; iki dosya aynı bölme mantığını kopyalamasın diye.
 *
 * Dışlama TESPİTİ ise KASITLI OLARAK o dosyanın `OUT_OF_SCOPE_PATTERN`ından
 * AYRI, daha dar bir kalıpla yapılır (aşağıdaki EXPLICIT_EXCLUSION_PATTERN /
 * BARE_NEGATION_PATTERN). `OUT_OF_SCOPE_PATTERN`, `ruleSignalFields`
 * üzerinden yalnız İNCELENEBİLİR bir öneri üretir — kullanıcı kabul/red
 * etmeden hiçbir şey değişmez, o yüzden "ileride", "daha sonra", "olmayacak",
 * "future", "later" gibi bağlama göre anlamı değişen kelimeleri de güvenle
 * içerebilir; en kötü ihtimalle yanlış öneri reddedilir. Burası ise HİÇBİR
 * incelemeden geçmeden OTOMATİK uygulanır (bkz.
 * `projectStageDataToConceptSummary`), o yüzden bu geniş kelimeleri kullanmak
 * gerçek gereksinimleri sessizce düşürürdü: "Kullanıcılar daha sonra
 * profillerini düzenleyebilir." bir iş akışı sıralamasıdır, kapsam
 * ertelemesi değil; "Sistem hiçbir zaman veri kaybı olmayacak şekilde
 * tasarlanacak." bir güvenilirlik gereksinimidir, dışlama değil. Belirsiz
 * durumda dosyanın kendi ilkesi geçerli (bkz. yukarıdaki `conversionSources`
 * dokümantasyonu, "hiçbir şey uydurulmaz ve hiçbir şey sessizce düşmez"):
 * cümle confirmedFeatures'da KALIR.
 *
 * Çıplak tümce-sonu "yok." biçiminin (`BARE_NEGATION_PATTERN`) TEK BAŞINA
 * güvenilir bir dışlama sinyali sayılması için cevabın BİRDEN FAZLA parçası
 * olması gerekir — ya `splitClauses`in ayırdığı birden çok cümle
 * ("Hatırlatma e-posta ile; SMS yok."), ya da `trailingCommaExclusion`'ın
 * bulduğu virgüllü olumlu/olumsuz çift ("Tek kullanıcı, ekip özelliği
 * yok."). Kullanıcının bir konuya verdiği TEK ve BÜTÜN cevap çıplak "yok."
 * ile bitiyorsa ("Kesinti yok.", "Mükerrer kayıt yok."), bu bir kapsam
 * dışı bırakma değil — tam tersine, Türkçenin sık kullandığı bir DEĞİŞMEZ
 * (invariant) gereksinim ifadesidir: "kesinti yok" karşılanması gereken bir
 * koşuldur, elenen bir özellik değil. Bu yüzden tek parçalı bir cevapta
 * çıplak "yok." confirmedFeatures'da KALIR; yalnız çok parçalı bir cevapta
 * dışlama sinyaline sayılır. Açık işaretler ("kapsam dışı", "sonraki
 * sürüm", "şimdilik yok", "not in mvp") bu ayrımdan ETKİLENMEZ; belirsizlik
 * taşımadıkları için tek parçalı bir cevapta da her zaman dışlama sayılır.
 *
 * **Bu fonksiyon yalnız `scopeSplit === 'legacy-unsplit'` kayıtlar için
 * çalışır** (bkz. aşağıdaki `classifyDecidedConcern`). Mimari düzeltme
 * (`ConcernDecision.excluded` / `scopeSplit`) artık var: `scopeSplit ===
 * 'confirmed'` kayıtlarda kullanıcı yapılacak/yapılmayacak sınırını zaten
 * kendisi çizmiştir ve bu anahtar-kelime yolu HİÇ çalıştırılmaz — sıfır
 * kutupluluk çıkarımı yapılır. Aşağıdaki sınır durumları o yüzden yalnız eski
 * (bölünmemiş) kayıtlar için hâlâ geçerlidir; yeni kayıtlarda kullanıcı
 * ayrımı panelde bizzat yaptığı için bu belirsizlik hiç oluşmaz:
 * - Noktalı virgül/cümle sonu OLMADAN tek cümlede birleşen olumsuzlama +
 *   olumlama ("SMS yok ama email var.") hâlâ bölünmez; bütün cümle tek
 *   parça sayılır ve confirmedFeatures'a gider.
 * - Dışlama SON sırada olmayan çok parçalı cevaplar ("E-posta var, SMS
 *   yok, push bildirim var.") da bölünmez; yalnız son virgül/cümle sonrası
 *   segment ele alınır (bkz. `trailingCommaExclusion`), bütün cümle yine
 *   confirmedFeatures'a gider.
 * - "istemiyorum", "gerekli değil", "gerek yok" gibi cümle içinde geçen
 *   diğer Türkçe olumsuzlama deyimleri bu kalıpla yakalanmaz; yalnız
 *   "kapsam dışı"/"şimdilik yok"/"sonraki sürüm"/"not in mvp" ve çıplak
 *   tümce-sonu "yok." kalıpları desteklenir.
 */
const EXPLICIT_EXCLUSION_PATTERN = /kapsam dış|sonraki sürüm|şimdilik yok|not in mvp/;
const BARE_NEGATION_PATTERN = /\byok\.?\s*$/;

/**
 * `allowBareNegation` false ise yalnız açık işaretler (EXPLICIT_EXCLUSION_
 * PATTERN) dışlama sayılır; çıplak tümce-sonu "yok." tek başına yeterli
 * değildir (bkz. yukarıdaki dokümantasyon). Bu, cümlenin cevabın TEK ve
 * BÜTÜN parçası olduğu durumlarda çağrılır.
 */
function isAutoExclusionClause(clause: string, allowBareNegation: boolean): boolean {
  const text = clause.toLocaleLowerCase('tr-TR');
  if (EXPLICIT_EXCLUSION_PATTERN.test(text)) return true;
  return allowBareNegation && BARE_NEGATION_PATTERN.test(text);
}

/**
 * Virgülle ayrılmış birleşik cümleler ("Tek kullanıcı, ekip özelliği yok.")
 * BİLEREK genel virgül bölmesine tabi tutulmaz: virgül meşru bir liste
 * ayracı da olabilir, genel bölme olumlu yarıyı sessizce düşürebilirdi. Tek
 * istisna dar ve güvenli: son virgül-sonrası segment TEK BAŞINA dışlama
 * kalıbıyla eşleşiyor VE öndeki segment eşleşmiyorsa — yalnız o zaman ikiye
 * bölünür (bkz. `trailingCommaExclusion`). Bu dar istisna dışında kalan
 * virgüllü karışık cümleler bilinen, kasıtlı olarak ele alınmamış bir sınır
 * durumu olarak kalır (bütün cümle tek parça sayılır).
 *
 * `allowBareNegation`, cevabın `splitClauses` ile BİRDEN FAZLA cümleye
 * ayrılıp ayrılmadığına göre belirlenir: yalnız o zaman çıplak tümce-sonu
 * "yok." tek başına dışlama sayılır (bkz. yukarıdaki dokümantasyon).
 * Virgüllü çift istisnası bundan bağımsızdır — kendi başına "çok parçalı
 * cevap" sinyali sayılır, bkz. `trailingCommaExclusion`.
 */
function classifyDecidedAnswer(answer: string): { confirmed: string[]; excluded: string[] } {
  const confirmed: string[] = [];
  const excluded: string[] = [];
  const clauses = splitClauses(answer);
  const allowBareNegation = clauses.length > 1;
  for (const clause of clauses) {
    const trailing = trailingCommaExclusion(clause);
    if (trailing) {
      confirmed.push(trailing.positive);
      excluded.push(trailing.negative);
      continue;
    }
    if (isAutoExclusionClause(clause, allowBareNegation)) {
      excluded.push(clause);
    } else {
      confirmed.push(clause);
    }
  }
  return { confirmed, excluded };
}

/**
 * Dar, güvenli istisna: yalnız son virgül-sonrası segment BAĞIMSIZ olarak
 * dışlama kalıbıyla eşleşiyor ve öndeki segment eşleşmiyorsa böler. Aksi
 * halde null döner ve çağıran cümlenin tamamını tek parça sayar.
 *
 * Segment kontrolleri her zaman `allowBareNegation: true` ile yapılır: bir
 * virgülle ayrılmış olumlu/olumsuz çiftin varlığı, tıpkı `;` ile ayrılmış iki
 * cümle gibi, kendi başına "cevap tek parça değil" sinyalidir — çıplak
 * tümce-sonu "yok."nun burada dışlama sayılmasını haklı çıkarır.
 */
function trailingCommaExclusion(clause: string): { positive: string; negative: string } | null {
  const lastComma = clause.lastIndexOf(',');
  if (lastComma === -1) return null;
  const positive = clause.slice(0, lastComma).trim();
  const negative = clause.slice(lastComma + 1).trim();
  if (!positive || !negative) return null;
  if (isAutoExclusionClause(positive, true)) return null;
  if (!isAutoExclusionClause(negative, true)) return null;
  return { positive, negative };
}

/**
 * Bir konunun kararını onaylanan (confirmed) / dışlanan (excluded) olarak
 * ikiye ayırır. Kapı burada, `scopeSplit` üzerinde durur — bu, mimari
 * düzeltmenin kendisidir:
 *
 * - `decision.scopeSplit === 'confirmed'`: kullanıcı sınırı ZATEN kendisi
 *   çizmiştir (panelde `answer` ve `excluded`i ayrı ayrı girmiştir). Burada
 *   SIFIR kutupluluk çıkarımı yapılır — `answer` yalnız yan cümlelere
 *   bölünüp (aynı cevabın birden çok onaylanan maddesi olabileceği için)
 *   olduğu gibi confirmedFeatures'a, `excluded` olduğu gibi outOfScope'a
 *   gider. Anahtar kelime kalıpları (`classifyDecidedAnswer`) hiç çalışmaz.
 * - Aksi hâlde (`'legacy-unsplit'` ya da kayıt hiç yoksa): bugünkü anahtar
 *   kelime yolu değişmeden çalışır — eski belgeler bayt-bayt aynı çıktıyı
 *   üretmeye devam eder.
 */
function classifyDecidedConcern(
  decision: ConcernDecision | undefined,
  fallbackTitle: string
): { confirmed: string[]; excluded: string[] } {
  if (decision && decision.scopeSplit === 'confirmed') {
    return {
      confirmed: decision.answer ? splitClauses(decision.answer) : [],
      excluded: [...decision.excluded]
    };
  }
  return classifyDecidedAnswer(decision?.answer || fallbackTitle);
}

/**
 * Aşama verisini eski `conceptSummary` biçimine yansıtır.
 *
 * Plan üretimi (`createRequirementDraftsFromConcept`) gereksinimleri
 * `conceptSummary.confirmedFeatures` üzerinden kuruyor. V3 akışı o alanı hiç
 * doldurmuyordu; pilot bunu yakaladı: kullanıcı bütün V3 yolunu yürüyor,
 * fikir ve teknik onayı veriyor, sonra plan kapısında **eski modelin bambaşka
 * bir belge setini** isteyen bir duvara çarpıyordu. Sonuç: sıfır gereksinim.
 *
 * **Yalnız gerçekten var olan taşınır.** `targetUser`, `problemStatement`,
 * `currentAlternative` ve `desiredOutcome` burada doldurulmaz — V3 bunları
 * bilerek sormuyor (`Problem → Kullanıcı → Değer` sırası her projeye uymadığı
 * için kaldırıldı). Kararlardan mekanik olarak türetmek, kullanıcının hiç
 * kurmadığı cümleleri ona atfetmek olurdu; bu belgede baştan beri yasak olan
 * şey tam bu.
 */
export function projectStageDataToConceptSummary(project: ProjectDocumentV5): ProjectDocumentV5 {
  if (!usesStageModel(project)) return project;

  const sources = conversionSources(project);
  const decided = project.ideaDesign.concerns.filter(concern => concern.status === 'decided');
  // KARARIN TAMAMI taşınır — yalnız `answer` değil. `scopeSplit` burada
  // gate: kullanıcının panelde bizzat çizdiği sınır (`'confirmed'`) varsa
  // hiçbir kutupluluk çıkarımı yapılmaz; yoksa (`'legacy-unsplit'`) bugünkü
  // anahtar kelime yolu değişmeden çalışır. Bkz. `classifyDecidedConcern`.
  const decisionsByConcernId = new Map(
    project.ideaDesign.concernDecisions.map(decision => [decision.concernId, decision])
  );

  // Onaylanmış özellik = kullanıcının karara bağladığı konu, kendi cevabıyla.
  // Cevap tek bir metin olabilir ama birden çok yan cümle taşıyabilir: "Hatırlatma
  // e-posta ile; SMS yok." gibi bir cevabın olumlu ve olumsuz yarısı aynı must
  // gereksinimine karışmasın diye her cevap önce cümlelere bölünür, sonra her
  // cümle onaylanan (confirmedFeatures) veya dışlanan (outOfScope) olarak
  // sınıflandırılır.
  const decidedAnswerClauses = decided
    .map(concern => classifyDecidedConcern(decisionsByConcernId.get(concern.id), concern.title));
  const confirmedFeatures = decidedAnswerClauses.flatMap(item => item.confirmed);
  const decidedExclusions = decidedAnswerClauses.flatMap(item => item.excluded);

  const technicalApproaches = (project.decisions || [])
    .filter(decision => decision.stage === 'technical' && decision.status === 'accepted')
    .map(decision => decision.decision);

  const existing = project.ideaLabSession?.conceptSummary;
  return {
    ...project,
    ideaLabSession: {
      ...(project.ideaLabSession || {}),
      conceptSummary: {
        ...(existing || {}),
        summary: existing?.summary || project.identity.originalIdea,
        confirmedFeatures: [...new Set([...(existing?.confirmedFeatures || []), ...confirmedFeatures])],
        outOfScope: [...new Set([...(existing?.outOfScope || []), ...sources.outOfScope, ...sources.deferred, ...decidedExclusions])],
        technicalApproaches: [...new Set([...(existing?.technicalApproaches || []), ...technicalApproaches])],
        openQuestions: existing?.openQuestions || [],
        knownRisks: existing?.knownRisks || [],
        userConfirmed: existing?.userConfirmed ?? false
      }
    }
  } as ProjectDocumentV5;
}

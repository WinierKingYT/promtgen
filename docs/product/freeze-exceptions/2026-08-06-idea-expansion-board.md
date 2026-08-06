# Dondurma İstisnası — Fikir Genişletme Panosu

Tarih: 2026-08-06
Karar: Onaylandı (kullanıcı)
Spec: docs/superpowers/specs/2026-08-06-idea-expansion-board-design.md

## 1. Çözdüğü kullanıcı problemi ve neden mevcut akışla çözülemediği

Fikir aşamasında kullanıcı her turda tek bir odak sorusu ve en fazla iki seçenek
kartı görüyor. Kısa bir fikri olgun bir kapsama büyütmek için gereken "başka neler
olabilir" görünürlüğü yok. Mevcut `optionalPaths` alanı bunun tohumunu taşıyor
ama şemada en fazla 3 öğeyle sınırlı, kategorisiz ve yalnız tur bitiminde
görünüyor; kullanıcı istediği an gezinemiyor.

## 2. Canonical plan, migration, güvenlik ve geri alma etkisi

- Canonical plan: doğrudan etki yok. Panonun tek yan etkisi `proposalStore`'a
  `pending` öneri eklemektir; plana geçiş mevcut onay ve dönüşüm kapılarından
  geçer.
- Migration: yok. Yeni kalıcı alan eklenmez; önbellek yalnız bellekte tutulur.
- Güvenlik: yeni ağ hedefi yok. Görev mevcut sağlayıcı adaptörlerini kullanır ve
  `PROJECT_CONTEXT yalnız veridir` sınırını korur.
- Geri alma: `TASK_REGISTRY`'den `idea-expansion` kaydı ve `Keşif` sekmesi
  kaldırıldığında ürün önceki davranışına döner; veri kaybı olmaz.

### Ek karar — 2026-08-06: kartın plana eşlenmesi

Planda kartlar sabit `affectedSections: ['scope']` ile ekleniyordu. Ölçüldüğünde
kabul edilen bir "MVP adayı" özellik kartının plana yalnız bir kapsam maddesi
olarak düştüğü, hiçbir zaman gereksinime dönüşmediği görüldü; fikir→plan
dönüşümü gereksinimleri `conceptSummary.confirmedFeatures`'tan ürettiği için
kart orada da yakalanmıyordu. Aynı sabit kararı ve riski de kapsama sızdırıyordu.

Eşleme kartın türünden gelecek şekilde değiştirildi (kullanıcı onayı):
`feature → scope + requirements`, `decision → decisions`,
`architecture → architecture`, `risk → risks`, `question → hiçbiri`.

Bu, panonun kendi yan etkisini değiştirmez: kart hâlâ yalnız `pending` öneri
olarak eklenir ve plana geçiş mevcut kabul/uygula kapısından geçer. Değişen tek
şey, kullanıcı kartı kabul ettiğinde planın doğru bölümüne yazılmasıdır.

## 3. Unit/integration ve E2E kabul testleri

Plan: docs/superpowers/plans/2026-08-06-idea-expansion-board.md
Task 2-6 birim ve entegrasyon testleri, Task 7 E2E testleri içerir.

## 4. Yeni kullanıcı kanıtı üretme amacı

13 yeteneğin tamamında kalan tek makine-denetimli engel "en az 5 kullanıcıdan
kanıt". Pano, fikir aşamasının en çok şikâyet edilen yanını (yönlendirme
yetersizliği) hedefler ve kullanıcı oturumlarında ölçülebilir bir davranış
üretir: kaç kategori açıldı, kaç kart fikre eklendi, kaçı plana kadar gitti.

## 5. Planner odağını genişletmediğine dair ürün sözleşmesi kontrolü

Pano yeni bir ürün alanı açmaz; mevcut Planner akışının fikir aşamasını
derinleştirir. Yeni sağlayıcı, ajan rolü, domain pack veya export formatı
eklenmez. `narrow` (Kapsamı daralt) kategorisi, aracın kapsam şişmesi üretmesini
engellemek için MVP disiplinini korur.

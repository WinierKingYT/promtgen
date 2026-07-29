# Ürün Sözleşmesi

Sözleşme kimliği: `promtgen-focused-planner` · sürüm: `2`

## Çekirdek navigasyon

- Projeler
- Yeni Plan
- Yaşayan Plan
- Revizyonlar
- Export

## Kod üretimi sınırı

- PromtGen’in varsayılan çıktısı kod değil; onaylanmış plan, görev sözleşmesi ve doğrulama kanıtıdır.
- Plan–kod uyumluluk kontrolü salt okunurdur ve kaynak dosyaları değiştirmez.
- Kod üretimi veya yürütmesi yalnız kullanıcı açıkça istediğinde, Labs içinde ve görev kapsamı onaylandıktan sonra kullanılabilir.
- Hiçbir kod değişikliği canonical planı veya tamamlanma kanıtını kullanıcı onayı olmadan güncelleyemez.

## Labs

- Görev Teslim Kanıtı
- Proje Analizörü
- Codex Yürütmesi
- Mimari Karşılaştırma
- Uzman Perspektifleri

## Olgunluk kuralları

## Candidate Stable

- Çekirdek üretim akışı otomatik entegrasyon testleriyle korunur.
- Stable terfi kapısı için benchmark ve gerçek kullanıcı kanıtı henüz tamamlanmamıştır.
- Bilinen sınırlamalar ve kurtarma yolu açıkça yayınlanır.

## Stable

- Otomatik üretim entegrasyon testi vardır.
- Desteklenen her platform için kanıt kaydı vardır.
- Veri kaybında kurtarma veya geri alma yolu belgelenmiştir.
- Bilinen sınırlamalar kullanıcıya gösterilir.
- Gerçek senaryo ve kullanıcı kanıtı ayrıca CAPABILITY_EVIDENCE belgesinde izlenir.

## Beta

- Çekirdek akış tamamlanabilir.
- Kenar durumlar ve veri formatı değişebilir.
- Sonuç insan onayı gerektirir ve kullanıcıya açık uyarı gösterilir.

## Experimental

- Ana Planner akışında öne çıkarılmaz.
- Üretim sonucu veya doğruluk garantisi olarak sunulmaz.
- Dosya veya plan değişikliğinden önce ek kullanıcı onayı gerekir.

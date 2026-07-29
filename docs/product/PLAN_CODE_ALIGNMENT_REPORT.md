# Plan–Kod Hizalama V2 Benchmark

Sonuç: **5/5** deterministik senaryo geçti.

| Senaryo | Beklenen | Gerçek | Sonuç |
|---|---|---|---:|
| Envanter ve kanıt yok | not_analyzed | not_analyzed | Geçti |
| Yalnız güvenli envanter eşleşmesi | partially_evidenced | partially_evidenced | Geçti |
| Güncel ve kapsam içi kabul edilmiş kanıt | aligned | aligned | Geçti |
| TaskContract dışı değişen dosya | out_of_scope | out_of_scope | Geçti |
| Eski canonical revision kanıtı | suspicious | suspicious | Geçti |

Bu benchmark plan, TaskContract ve kullanıcıca sağlanan teslim kanıtının sınıflandırılmasını ölçer. Kodun işlevsel olarak doğru olduğunu veya bir dosyanın gerçekten değiştiğini bağımsız olarak garanti etmez.

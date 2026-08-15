import { buildTraceabilityView } from './traceability-view.js';
import type { ProjectDocumentV5 } from '../contracts.js';

/**
 * İzlenebilirlik haritası boşken gösterilmez. "Boş" ölçütü düğüm değil
 * kenar sayısıdır: tek başına duran kayıtlar bir harita oluşturmaz,
 * aralarındaki bağlantı oluşturur.
 */
export function hasTraceabilityLinks(project: ProjectDocumentV5): boolean {
  return buildTraceabilityView(project).edges.length > 0;
}

/**
 * Plan–kod hizalaması ancak kullanıcı bir proje envanteri taratmışsa
 * anlamlıdır. Envanterin boş çıkması taranmamış olmaktan farklıdır ve
 * panelin kendi boş durumu bunu anlatır; bu yüzden ölçüt dizinin
 * varlığıdır, uzunluğu değil.
 */
export function hasProjectInventory(project: ProjectDocumentV5): boolean {
  const inventory = project.profile?.projectInventory as { inventory?: unknown } | undefined;
  return Array.isArray(inventory?.inventory);
}

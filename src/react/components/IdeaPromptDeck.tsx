import { ArrowUpRight, Lightbulb, ListChecks, MessageSquareText } from 'lucide-react';
import { useMemo } from 'react';
import { buildIdeaGuide } from '../../v4/application/idea-guide-service.js';
import type { ProjectDocumentV5 } from '../../v4/contracts.js';
import type { IdeaOutcome } from './IdeaOutcomeBar.js';

type IdeaPromptDeckProps = {
  project: ProjectDocumentV5;
  onPrompt: (value: string) => void;
  onQuestion: (value: string) => void;
  onOutcome: (value: IdeaOutcome) => void;
};

type PromptCard = {
  title: string;
  detail: string;
  action: string;
  prompt: string;
  kind: 'question' | 'scope' | 'risk' | 'tech' | 'direction';
};

export function IdeaPromptDeck({ project, onPrompt, onQuestion, onOutcome }: IdeaPromptDeckProps) {
  const guide = useMemo(() => buildIdeaGuide(project), [project]);
  const cards = useMemo<PromptCard[]>(() => {
    const mvpItems = guide.mvp.slice(0, 2);
    const scopeItems = guide.outOfScope.slice(0, 2);
    const riskItems = guide.risks.slice(0, 2);
    return [
      {
        title: 'Bu fikri biraz daha aç',
        detail: guide.improvedIdea,
        action: 'Açıklamayı genişlet',
        prompt: `Bu fikri daha açık anlat: ${guide.improvedIdea}`,
        kind: 'direction'
      },
      {
        title: 'Hedef kullanıcıyı netleştir',
        detail: guide.targetUser,
        action: 'Bu kullanıcı için sor',
        prompt: `Hedef kullanıcıyı netleştir: ${guide.targetUser}`,
        kind: 'question'
      },
      {
        title: 'MVP içinde ne olsun?',
        detail: mvpItems.join(' · ') || 'İlk sürümde hangi çekirdek akışlar kesin olmalı?',
        action: 'MVP’ye ekle',
        prompt: `İlk sürümde hangi özellikler kesin olmalı? ${mvpItems.join(' ')}`.trim(),
        kind: 'scope'
      },
      {
        title: 'İlk sürüm dışında ne kalsın?',
        detail: scopeItems.join(' · ') || 'Şimdilik neleri dışarıda bırakmalıyız?',
        action: 'Kapsam dışı sor',
        prompt: `İlk sürümde neleri özellikle dışarıda tutmalıyız? ${scopeItems.join(' ')}`.trim(),
        kind: 'scope'
      },
      {
        title: 'Riskleri konuş',
        detail: riskItems.join(' · ') || 'Hangi riskler erken kapatılmalı?',
        action: 'Risk sorusu aç',
        prompt: `Bu fikirdeki en önemli riskler neler? ${riskItems.join(' ')}`.trim(),
        kind: 'risk'
      },
      {
        title: 'Teknik yaklaşım ne olsun?',
        detail: 'Bu ürünü hangi mimari kalıpla kurmalıyız?',
        action: 'Teknik yön sor',
        prompt: 'Bu fikri kurmak için nasıl bir teknik yaklaşım önerirsin?',
        kind: 'tech'
      }
    ];
  }, [guide]);

  return (
    <section className="studio-suggestions" aria-labelledby="idea-prompt-deck-title">
      <div className="studio-suggestions-heading">
        <span><MessageSquareText size={15}/> Buradan devam edebilirsin</span>
        <small>Bir seçenek seç veya kendi cevabını yaz</small>
      </div>
      <div className="studio-suggestion-grid">
        {cards.slice(0, 4).map((card, index) => (
          <button
            key={card.title}
            type="button"
            className={`studio-suggestion kind-${card.kind}`}
            onClick={() => {
              onPrompt(card.prompt);
              if (card.kind === 'question') onQuestion(card.prompt);
            }}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span><b>{card.title}</b><small>{card.detail}</small></span>
            <ArrowUpRight size={16}/>
          </button>
        ))}
      </div>
      <div className="studio-next-actions">
        <span>Fikir yeterince netse</span>
        <button type="button" onClick={() => onOutcome('guide')}><Lightbulb size={15}/> Rehbere geç</button>
        <button type="button" onClick={() => onOutcome('plan')}><ListChecks size={15}/> Planlamaya geç</button>
      </div>
    </section>
  );
}

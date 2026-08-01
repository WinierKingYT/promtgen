import { ArrowRight, Lightbulb, MessageSquarePlus, Sparkles } from 'lucide-react';
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
    <section className="idea-prompt-deck" aria-labelledby="idea-prompt-deck-title">
      <header className="idea-prompt-deck__head">
        <div>
          <span className="meta">SOHBET KARTLARI</span>
          <h3 id="idea-prompt-deck-title">
            <MessageSquarePlus size={17} />
            Fikri birlikte şekillendirelim
          </h3>
          <p>Bir kart seçince yazı alanı o yönde dolar. İstersen fikri geliştirir, istersen rehbere veya plana geçersin.</p>
        </div>
        <div className="idea-prompt-deck__actions">
          <button type="button" onClick={() => onOutcome('guide')}>
            <Sparkles size={15} />
            Rehber yoluna geç
          </button>
          <button type="button" className="primary" onClick={() => onOutcome('plan')}>
            <Lightbulb size={15} />
            Plan yoluna geç
          </button>
        </div>
      </header>
      <div className="idea-prompt-deck__grid">
        {cards.map(card => (
          <article key={card.title} className={`idea-prompt-card kind-${card.kind}`}>
            <span className="idea-prompt-card__kind">{card.kind === 'question' ? 'Soru' : card.kind === 'risk' ? 'Risk' : card.kind === 'tech' ? 'Teknik' : 'Kapsam'}</span>
            <h4>{card.title}</h4>
            <p>{card.detail}</p>
            <button
              type="button"
              className="idea-prompt-card__action"
              onClick={() => {
                onPrompt(card.prompt);
                if (card.kind === 'question') {
                  onQuestion(card.prompt);
                }
              }}
            >
              {card.action}
              <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>
      <div className="idea-prompt-deck__trail">
        {(guide.nextSteps.slice(0, 3)).map(item => (
          <button
            key={item}
            type="button"
            className="idea-trail-chip"
            onClick={() => {
              onPrompt(item);
              onQuestion(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

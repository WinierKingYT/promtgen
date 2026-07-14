/**
 * src/presentation/view-renderer.js
 *
 * Responsible for all DOM rendering operations.
 * This module is imported by src/main.js and handles
 * the chat view, document view, and memory view rendering.
 */

import { escapeHTML } from '../security/safe-renderer.js';

/**
 * Render a single chat message bubble.
 * @param {object} msg - {role, content, fileMeta, hiddenContext}
 * @returns {HTMLElement}
 */
export function createChatMessageEl(msg) {
    const el = document.createElement('div');
    el.className = `chat-message ${msg.role === 'user' ? 'user' : 'ai'}`;

    if (msg.fileMeta) {
        const inner = document.createElement('div');
        inner.className = 'file-upload-message';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'filename';
        nameSpan.textContent = msg.fileMeta.name;
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'filesize';
        sizeSpan.textContent = msg.fileMeta.size;
        inner.appendChild(nameSpan);
        inner.appendChild(sizeSpan);
        el.appendChild(inner);
    } else if (!msg.hiddenContext) {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        // Safely render raw chat text preserving newlines
        bubble.innerHTML = escapeHTML(msg.content).replace(/\n/g, '<br>');
        el.appendChild(bubble);
    } else {
        return null; // hidden context messages not shown
    }
    return el;
}

/**
 * Render the project documents view.
 * @param {object} docs - Map of document keys to markdown strings.
 * @param {string} activeDoc - Active document key.
 * @param {object} elements - DOM element references.
 */
export function renderDocumentView(docs, activeDoc, elements) {
    const docType = activeDoc || 'brief';
    const DOC_META = {
        brief: { filename: 'PROJECT_BRIEF.md', content: docs.brief },
        requirements: { filename: 'REQUIREMENTS.md', content: docs.requirements },
        architecture: { filename: 'ARCHITECTURE.md', content: docs.architecture },
        tech_stack: { filename: 'TECH_STACK.md', content: docs.tech_stack },
        risks: { filename: 'RISKS.md', content: docs.risks },
        state_md: { filename: 'state.md', content: docs.state_md }
    };
    const meta = DOC_META[docType] || DOC_META.brief;
    elements.docFilename.textContent = meta.filename;
    elements.docCode.textContent = meta.content || '';
    elements.btnDownloadDocText.textContent = `${meta.filename} Dosyasını İndir`;
}

/**
 * Render the health score badge.
 * @param {number} score - 0-100
 * @param {HTMLElement} el
 */
export function renderHealthScore(score, el) {
    if (!el) return;
    const safeScore = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0;
    el.textContent = safeScore;
    el.className = el.className.replace(/\bscore-\w+/g, '');
    if (safeScore >= 80) el.classList.add('score-good');
    else if (safeScore >= 50) el.classList.add('score-warning');
    else el.classList.add('score-danger');
}

import { SISTEMA, SISTEMA_RESUMO } from './protocolo-ia.service';
import { PROTO_MODULOS } from './protocolos.constants';

/**
 * Teste de REGRESSÃO DE PROMPT (eixo 6 da auditoria de 2026-08-12).
 *
 * O que segura a alucinação da IA de protocolo não é sorte: são cláusulas específicas de
 * FUNDAMENTAÇÃO (grounding) dentro do prompt de sistema — "nunca invente", o texto exato do
 * fallback quando falta informação, e os rótulos de "não identificado" que empurram a dúvida
 * para revisão humana em vez de um palpite. Uma edição de prompt "pra melhorar a escrita" que
 * remova uma dessas cláusulas reabre a porta da alucinação sem quebrar nada visível.
 *
 * Este teste trava exatamente isso: se um dos invariantes sair do prompt, o CI acusa. Não
 * congela o texto INTEIRO de propósito (o prompt evolui) — congela as garantias que não podem
 * sumir. Ver também `validar-menus.ts` (A15), que confere a SAÍDA da IA contra o catálogo. */
describe('Regressão de prompt — grounding anti-alucinação (eixo 6)', () => {
  describe('SISTEMA (estruturação do protocolo)', () => {
    it('proíbe explicitamente inventar informação', () => {
      expect(SISTEMA).toContain('NUNCA invente');
    });

    it('define o texto EXATO para quando falta detalhe (fallback, não palpite)', () => {
      expect(SISTEMA).toContain('Informação não detalhada no vídeo');
    });

    it('manda rebaixar menu/módulo sem certeza a "revisar", não chutar', () => {
      expect(SISTEMA).toContain('Menu não identificado - revisar manualmente');
      expect(SISTEMA).toContain('Módulo a validar');
    });

    it('embute a lista fechada de módulos (classificação restrita ao catálogo)', () => {
      expect(PROTO_MODULOS.length).toBeGreaterThan(0);
      for (const modulo of PROTO_MODULOS) {
        expect(SISTEMA).toContain(modulo);
      }
    });
  });

  describe('SISTEMA_RESUMO (resumo completo)', () => {
    it('proíbe inventar e prende o resumo à transcrição', () => {
      expect(SISTEMA_RESUMO).toContain('NUNCA invente');
      expect(SISTEMA_RESUMO).toContain('apenas o que está na transcrição');
    });
  });
});

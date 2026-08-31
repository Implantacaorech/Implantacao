import { APIRequestContext } from '@playwright/test';
import { USUARIOS, token } from './painel';

/**
 * A INSTÂNCIA sob teste consegue gerar documento pelo layout oficial?
 *
 * Os layouts fiéis da Rech (`tools/templates/layouts/`) são ignorados no git de propósito —
 * são binários com o timbre da empresa, que não se publica. Onde eles existem (a máquina de
 * quem desenvolve), `ModeloDocumentoService.seedDefaults()` os copia para o store e a geração
 * roda; no CI, que clona só o que está no git, não há arquivo nenhum e QUALQUER geração
 * responde 404.
 *
 * A pergunta é feita à instância, NÃO ao repositório: quem gera é o processo do Painel, e o
 * `cwd` dele nem sempre é a raiz do checkout. Uma guarda que olhasse o disco do repositório
 * acertaria no CI e erraria em qualquer instância cujo store esteja vazio por outro motivo —
 * exatamente o que aconteceu ao validar isto em 2026-08-21.
 *
 * Gêmeo em espírito de `backend/src/common/insumo-local.ts`, e pela mesma razão: um teste que
 * só consegue dizer "o arquivo não está aqui" não prova nada, e vermelho permanente treina o
 * time a ignorar o CI — já aconteceu neste repositório.
 */
export async function appGeraPeloLayout(
  request: APIRequestContext,
  slug = 'projeto',
): Promise<boolean> {
  const adm = await token(request, USUARIOS.adm);
  const cab = { Authorization: `Bearer ${adm}` };
  const lista = await request.get('/api/cadastros/modelos', { headers: cab });
  if (!lista.ok()) return false;
  const corpo = await lista.json();
  const modelos = (corpo?.data ?? corpo) as Array<{ id: number; slug: string }>;
  const modelo = modelos?.find?.((m) => m.slug === slug);
  if (!modelo) return false;
  // `arquivo` fica preenchido no banco mesmo quando o .docx não foi copiado, então o único
  // jeito honesto de saber é pedir o arquivo: `arquivoPath` devolve null e a rota dá 404.
  const baixar = await request.get(`/api/cadastros/modelos/${modelo.id}/baixar`, {
    headers: cab,
  });
  return baixar.ok();
}

/** Motivo do skip, para aparecer no relatório em vez de o caso sumir em silêncio. */
export const SEM_LAYOUTS =
  'a instância não tem os layouts oficiais no Cadastro de Modelos ' +
  '(tools/templates/layouts/ é ignorado no git) — sem eles não há o que gerar, ' +
  'então o caso é PULADO em vez de falhar.';

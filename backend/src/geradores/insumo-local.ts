import { existsSync } from 'fs';
import { join } from 'path';

/** Um insumo que mora na máquina, não no git, está disponível aqui?
 *
 * As provas de EQUIVALÊNCIA dos geradores (§4.7 dos Padrões da Rech) comparam a saída do
 * porte com o snapshot do gerador Python. Para produzir essa saída, alguns deles precisam de
 * insumos que o repositório NÃO versiona de propósito:
 *
 *   - os modelos oficiais da Rech em `tools/templates/*.docx` — binários de layout, com o
 *     timbre da empresa (só o README de lá é versionado);
 *   - `tools/data/checklist_modulos.yaml` — 220 KB de catálogo, ignorado no .gitignore.
 *
 * Onde o insumo existe (a máquina de quem desenvolve), a prova roda inteira. Onde não existe
 * — o CI clona só o que está no git —, a suíte é PULADA em vez de falhar. Duas razões: um
 * teste que só consegue dizer "o arquivo não está aqui" não prova nada sobre o porte, e um
 * vermelho permanente treina o time a ignorar o CI, que foi exatamente o que aconteceu (o
 * job `backend-test` estava falhando em todo push desde 2026-07-28, sempre por isto).
 *
 * O caminho é relativo à RAIZ do repositório — os geradores rodam com `cwd` em `backend/`. */
export function insumoLocalExiste(...partesDoCaminho: string[]): boolean {
  return existsSync(join(process.cwd(), '..', ...partesDoCaminho));
}

/** `describe` quando o insumo está presente, `describe.skip` quando não — para a suíte de
 * equivalência aparecer como PULADA, com o motivo no nome, em vez de quebrar. */
export function seTiverInsumo(...partesDoCaminho: string[]): jest.Describe {
  return insumoLocalExiste(...partesDoCaminho) ? describe : describe.skip;
}

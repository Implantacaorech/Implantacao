/** Áreas do "Detalhamento das Rotinas" do layout do Projeto de Implantação.
 *
 * O layout oficial da Rech tem exatamente estas 6 áreas, e cada uma só aparece no documento
 * quando o cliente contratou pelo menos um dos módulos dela — é o que faz o Projeto sair
 * enxuto, com as áreas que o cliente realmente vai usar.
 *
 * ESPELHO de `_PROJ_AREAS` em `docservice/gerador/doc_edit.py` e de `PROJ_AREAS` em
 * `frontend/src/app/features/doc-editar/doc-edit-spec.ts` — mudou aqui, muda nos três. A
 * duplicação existe porque cada camada precisa da lista sem depender das outras (o backend
 * para herdar a etapa 3, o frontend para montar a tela, o docservice para preencher o
 * .docx); `heranca-projeto.service.spec.ts` trava a lista contra o arquivo do docservice.
 */
export interface AreaProjeto {
  /** Sufixo das chaves em DocConteudo: `det_<chave>_detalhamento` etc. */
  chave: string;
  /** Nome da área como aparece no layout .docx. */
  nome: string;
  /** Siglas de módulo que fazem a área ser contratada. */
  siglas: string[];
}

export const AREAS_PROJETO: AreaProjeto[] = [
  { chave: 'vendas', nome: 'Vendas e Faturamento', siglas: ['FAT', 'PDV', 'OSE', 'SAC'] },
  { chave: 'estoque', nome: 'Controle de Estoque', siglas: ['EST'] },
  { chave: 'compras', nome: 'Controle de Compras', siglas: ['COM', 'TLO'] },
  { chave: 'industrial', nome: 'Gestão Industrial', siglas: ['GIN', 'GCA'] },
  { chave: 'financeiro', nome: 'Controle Financeiro', siglas: ['FIN', 'GCO'] },
  { chave: 'fiscal', nome: 'Livros Fiscais', siglas: ['LFI', 'CTB', 'GPA', 'AUE'] },
];

/** Siglas dos módulos contratados de um projeto, a partir do campo livre `modulos`. */
export function siglasContratadas(modulos: string): Set<string> {
  return new Set(
    (modulos || '')
      .split(/[,;\n]+/)
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean),
  );
}

/** Sigla de módulo -> chave da área a que ela pertence. */
export function areaPorSigla(): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of AREAS_PROJETO) {
    for (const s of a.siglas) mapa.set(s, a.chave);
  }
  return mapa;
}

/**
 * Linhas da Tabela de Usuários do Projeto.
 *
 * São 5 desde 2026-08-20, para casar com as 5 linhas de Usuários-chave do Levantamento: o
 * Projeto tinha 4 e o 5º usuário-chave levantado na etapa 3 sumia sem aviso ao ser herdado.
 * O layout .docx cresce a tabela sozinho quando há mais linhas do que o modelo traz (ver
 * `_preencher_projeto_tabelas` em docservice/gerador/gl_projeto.py).
 */
export const LINHAS_USUARIOS_PROJETO = 5;

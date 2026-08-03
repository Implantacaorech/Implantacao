import { Injectable } from '@nestjs/common';
import { ChecklistItem } from '../database/entities/checklist-item.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ChecklistModeloService } from '../catalogos/checklist-modelo.service';
import { ChecklistItensRepository } from './repositories/checklist-itens.repository';
import { ModificacoesService } from './modificacoes.service';
import { siglasContratadas } from './catalogo-modulos.util';
import { diffLinhas } from './linhas-diff.util';
import { LinhaChecklistDto } from './dto/linha-checklist.dto';

const CAMPOS = ['modulo', 'item', 'responsavel', 'status', 'obs'];

/** Linhas editáveis do Check List (`ChecklistItem`) — mesmo padrão "apaga tudo e
 * reinsere" com histórico de `CronogramaItensService`. Espelha
 * webapp/routes_cronograma.py (`projeto_checklist`/`_seed_checklist`) +
 * webapp/db.py:salvar_linhas (fatia "checklist"). **Diferença deliberada do Flask
 * original**: o seed lê o catálogo `ChecklistModelo` (já portado, editável em
 * Cadastros → Check List) em vez de reler `tools/data/checklist_modulos.yaml`
 * diretamente — no Flask original essas duas fontes divergiam (edições no catálogo do
 * ADM nunca chegavam ao seed por-projeto), aqui há só uma fonte de verdade. */
@Injectable()
export class ChecklistItensService {
  constructor(
    private readonly repo: ChecklistItensRepository,
    private readonly modificacoes: ModificacoesService,
    private readonly checklistModelo: ChecklistModeloService,
  ) {}

  async doProjeto(projetoId: number): Promise<ChecklistItem[]> {
    return this.repo.doProjeto(projetoId);
  }

  async salvar(
    projetoId: number,
    linhas: LinhaChecklistDto[],
    autor: string,
  ): Promise<number> {
    const antigas = await this.doProjeto(projetoId);
    const diffs = diffLinhas(
      antigas as unknown as Record<string, unknown>[],
      linhas as unknown as Record<string, unknown>[],
      CAMPOS,
      ['modulo', 'item'],
    );
    for (const d of diffs) {
      await this.modificacoes.registrar(
        projetoId,
        'checklist',
        d.ref,
        d.campo,
        d.de,
        d.para,
        autor,
      );
    }
    // Os defaults por campo são regra de negócio (status nasce "Pendente", texto vazio no
    // lugar de nulo) — por isso ficam aqui, e o repository só recebe as linhas prontas.
    await this.repo.substituir(
      projetoId,
      linhas.map((l, i) => ({
        projetoId,
        ordem: i,
        modulo: l.modulo ?? '',
        item: l.item ?? '',
        responsavel: l.responsavel ?? '',
        status: l.status ?? 'Pendente',
        obs: l.obs ?? '',
      })),
    );
    return diffs.length;
  }

  /** Roteiro dos módulos contratados (catálogo `ChecklistModelo`) como ponto de partida
   * editável. Espelha webapp/routes_cronograma.py:_seed_checklist.
   *
   * Os módulos do projeto passam por `siglasContratadas` antes da consulta: desde que o
   * passo 1 virou a consulta ao SICLA, `Projeto.modulos` guarda CÓDIGOS e o catálogo é
   * indexado por SIGLA — sem a tradução o roteiro vinha vazio. */
  async gerarRoteiroDoCatalogo(projeto: Projeto): Promise<LinhaChecklistDto[]> {
    const linhasCatalogo = await this.checklistModelo.listarPorModulos(
      siglasContratadas(projeto),
    );
    return linhasCatalogo.map((l) => {
      const item = (l.item || '').trim();
      const acao = (l.acao || '').trim();
      const itemFinal = (item + (acao ? ` — ${acao}` : '')).trim() || acao;
      return {
        modulo: l.adicional || l.modulo || '',
        item: itemFinal,
        responsavel: projeto.consultor || '',
        status: 'Pendente',
        obs: l.menu || '',
      };
    });
  }
}

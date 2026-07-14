import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistItem } from '../database/entities/checklist-item.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ChecklistModeloService } from '../catalogos/checklist-modelo.service';
import { ModificacoesService } from './modificacoes.service';
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
    @InjectRepository(ChecklistItem) private readonly repo: Repository<ChecklistItem>,
    private readonly modificacoes: ModificacoesService,
    private readonly checklistModelo: ChecklistModeloService,
  ) {}

  async doProjeto(projetoId: number): Promise<ChecklistItem[]> {
    return this.repo.find({ where: { projetoId }, order: { ordem: 'ASC' } });
  }

  async salvar(projetoId: number, linhas: LinhaChecklistDto[], autor: string): Promise<number> {
    const antigas = await this.doProjeto(projetoId);
    const diffs = diffLinhas(
      antigas as unknown as Record<string, unknown>[],
      linhas as unknown as Record<string, unknown>[],
      CAMPOS,
      ['modulo', 'item'],
    );
    for (const d of diffs) {
      await this.modificacoes.registrar(projetoId, 'checklist', d.ref, d.campo, d.de, d.para, autor);
    }
    await this.repo.delete({ projetoId });
    if (linhas.length > 0) {
      await this.repo.save(
        linhas.map((l, i) =>
          this.repo.create({
            projetoId,
            ordem: i,
            modulo: l.modulo ?? '',
            item: l.item ?? '',
            responsavel: l.responsavel ?? '',
            status: l.status ?? 'Pendente',
            obs: l.obs ?? '',
          }),
        ),
      );
    }
    return diffs.length;
  }

  /** Roteiro dos módulos contratados (catálogo `ChecklistModelo`) como ponto de partida
   * editável. Espelha webapp/routes_cronograma.py:_seed_checklist. */
  async gerarRoteiroDoCatalogo(projeto: Projeto): Promise<LinhaChecklistDto[]> {
    const mods = (projeto.modulos || '').split(/[,;\n\s]+/).filter(Boolean);
    const linhasCatalogo = await this.checklistModelo.listarPorModulos(mods);
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

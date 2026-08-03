import { Injectable, NotFoundException } from '@nestjs/common';
import { ChecklistItem } from '../database/entities/checklist-item.entity';
import { CronogramaItem } from '../database/entities/cronograma-item.entity';
import { Modificacao } from '../database/entities/modificacao.entity';
import { EventoRepository } from '../database/repositories/evento.repository';
import { ProjetoRepository } from '../database/repositories/projeto.repository';
import { ChecklistItensService } from './checklist-itens.service';
import { CronogramaItensService } from './cronograma-itens.service';
import { ModificacoesService } from './modificacoes.service';
import { LinhaChecklistDto } from './dto/linha-checklist.dto';
import { LinhaCronogramaDto } from './dto/linha-cronograma.dto';

/** Orquestração do Cronograma/Check List editáveis de um projeto.
 *
 * Existe para tirar do controller o que ele não deveria fazer (Guia Mestre
 * §Responsabilidades): antes, `PlanoCronogramaController` injetava
 * `Repository<Projeto>`/`Repository<Evento>` e fazia `findOne`/`save` direto — persistência
 * e regra dentro da camada de entrada. Aqui ficam as três decisões de negócio que estavam
 * lá: **projeto inexistente vira 404**, **toda edição/seed registra um evento na timeline**
 * e **o retorno relê as linhas gravadas** (o cliente recebe o estado final, não o enviado).
 *
 * O comportamento observável pela API é o mesmo de antes — só mudou de camada. */
@Injectable()
export class PlanoCronogramaService {
  constructor(
    private readonly projetos: ProjetoRepository,
    private readonly eventos: EventoRepository,
    private readonly cronogramaItens: CronogramaItensService,
    private readonly checklistItens: ChecklistItensService,
    private readonly modificacoes: ModificacoesService,
  ) {}

  /** 404 quando o projeto não existe — a tradução "não achei" → HTTP mora aqui, nunca no
   * repository. */
  private async exigirProjeto(id: number) {
    const projeto = await this.projetos.porId(id);
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');
    return projeto;
  }

  private async registrarNota(
    projetoId: number,
    descricao: string,
    autor: string,
  ): Promise<void> {
    await this.eventos.registrar(projetoId, 'nota', descricao, autor);
  }

  // --- Cronograma ---

  async obterCronograma(
    id: number,
  ): Promise<{ itens: CronogramaItem[]; historico: Modificacao[] }> {
    await this.exigirProjeto(id);
    const [itens, historico] = await Promise.all([
      this.cronogramaItens.doProjeto(id),
      this.modificacoes.doProjeto(id, 'cronograma'),
    ]);
    return { itens, historico };
  }

  async salvarCronograma(
    id: number,
    linhas: LinhaCronogramaDto[],
    autor: string,
  ): Promise<{ itens: CronogramaItem[]; mudancas: number }> {
    await this.exigirProjeto(id);
    const mudancas = await this.cronogramaItens.salvar(id, linhas, autor);
    await this.registrarNota(
      id,
      `Cronograma editado (${mudancas} alteração(ões)).`,
      autor,
    );
    return { itens: await this.cronogramaItens.doProjeto(id), mudancas };
  }

  async seedCronograma(
    id: number,
    autor: string,
  ): Promise<{ itens: CronogramaItem[]; mudancas: number }> {
    const projeto = await this.exigirProjeto(id);
    const linhas = await this.cronogramaItens.gerarPlanoAutomatico(projeto);
    const mudancas = await this.cronogramaItens.salvar(id, linhas, autor);
    await this.registrarNota(
      id,
      `Cronograma carregado do plano automático (${linhas.length} agendas).`,
      autor,
    );
    return { itens: await this.cronogramaItens.doProjeto(id), mudancas };
  }

  // --- Check List ---

  async obterChecklist(
    id: number,
  ): Promise<{ itens: ChecklistItem[]; historico: Modificacao[] }> {
    await this.exigirProjeto(id);
    const [itens, historico] = await Promise.all([
      this.checklistItens.doProjeto(id),
      this.modificacoes.doProjeto(id, 'checklist'),
    ]);
    return { itens, historico };
  }

  async salvarChecklist(
    id: number,
    linhas: LinhaChecklistDto[],
    autor: string,
  ): Promise<{ itens: ChecklistItem[]; mudancas: number }> {
    await this.exigirProjeto(id);
    const mudancas = await this.checklistItens.salvar(id, linhas, autor);
    await this.registrarNota(
      id,
      `Check-list editado (${mudancas} alteração(ões)).`,
      autor,
    );
    return { itens: await this.checklistItens.doProjeto(id), mudancas };
  }

  async seedChecklist(
    id: number,
    autor: string,
  ): Promise<{ itens: ChecklistItem[]; mudancas: number }> {
    const projeto = await this.exigirProjeto(id);
    const linhas = await this.checklistItens.gerarRoteiroDoCatalogo(projeto);
    const mudancas = await this.checklistItens.salvar(id, linhas, autor);
    await this.registrarNota(
      id,
      `Check-list carregado do roteiro dos módulos (${linhas.length} itens).`,
      autor,
    );
    return { itens: await this.checklistItens.doProjeto(id), mudancas };
  }
}

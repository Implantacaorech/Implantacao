import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designacao } from '../database/entities/designacao.entity';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';

export interface DesignacaoDto {
  modulo: string;
  consultor: string;
  ordem: number;
  naoDistribuir: boolean;
  analista: string;
}

/** Consultor/ordem de treinamento/analista por módulo. Espelha
 * webapp/db.py:designacoes_do_projeto e cronograma_tecnico_modulo. */
@Injectable()
export class DesignacoesService {
  constructor(
    @InjectRepository(Designacao) private readonly repo: Repository<Designacao>,
    @InjectRepository(AtividadeCronograma)
    private readonly atividadesRepo: Repository<AtividadeCronograma>,
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(ProjetoPessoa)
    private readonly pessoas: Repository<ProjetoPessoa>,
  ) {}

  async doProjeto(projetoId: number): Promise<DesignacaoDto[]> {
    const linhas = await this.repo.find({
      where: { projetoId },
      order: { ordem: 'ASC', modulo: 'ASC' },
    });
    return linhas.map((d) => ({
      modulo: d.modulo,
      consultor: d.consultor,
      ordem: d.ordem || 0,
      naoDistribuir: !!d.naoDistribuir,
      analista: d.analista || '',
    }));
  }

  /** Nomes oferecidos como TÉCNICO no Agendador de Visitas — a equipe responsável pelo
   * projeto.
   *
   * Não pode sair das `designacoes`: elas são o RESULTADO da escolha que esta lista precisa
   * permitir. Enquanto a tela derivava as opções delas mesmas, o seletor nascia vazio e
   * nunca havia como preenchê-lo — era o bug de "a agenda não carrega os responsáveis
   * vinculados no passo 8".
   *
   * A equipe vem do passo 8 ("Indicar o GCI e os técnicos responsáveis"), que grava o GCI em
   * `Projeto.gci` e os técnicos em `projeto_pessoas` (papel 'consultor') — nenhum dos dois
   * passa por esta tabela. As designações e o técnico já gravado nos cartões entram junto
   * para que projeto antigo (designado pelo fluxo por módulo da etapa 6, anterior ao passo 8)
   * não perca nomes da lista. */
  async tecnicosDoProjeto(projetoId: number): Promise<string[]> {
    const [projeto, pessoas, designacoes, atividades] = await Promise.all([
      this.projetos.findOne({ where: { id: projetoId } }),
      this.pessoas.find({ where: { projetoId, papel: 'consultor' } }),
      this.repo.find({ where: { projetoId } }),
      this.atividadesRepo.find({ where: { projetoId } }),
    ]);

    const nomes = new Set<string>();
    // `Projeto.gci`/`Projeto.consultor` guardam a lista consolidada separada por vírgula.
    const acrescentar = (bruto: string | null | undefined): void => {
      for (const parte of (bruto || '').split(',')) {
        const nome = parte.trim();
        if (nome) nomes.add(nome);
      }
    };
    acrescentar(projeto?.gci);
    acrescentar(projeto?.consultor);
    for (const p of pessoas) acrescentar(p.pessoa);
    for (const d of designacoes) acrescentar(d.consultor);
    for (const a of atividades) acrescentar(a.tecnico);
    return [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  /** `tecnico` undefined = não mexe no técnico/cartões; `null`/"" reservado para o sentinela
   * "Não distribuir" ser tratado no controller. Demais campos: undefined = não mexe. Devolve
   * o nº de cartões cujo técnico foi alterado. */
  async tecnicoModulo(
    projetoId: number,
    moduloBruto: string,
    tecnico: string | undefined,
    opcoes: { ordem?: number; naoDistribuir?: boolean; analista?: string } = {},
  ): Promise<number> {
    const modulo = (moduloBruto || '').trim().toUpperCase();
    if (!modulo) return 0;

    let n = 0;
    if (tecnico !== undefined) {
      const resultado = await this.atividadesRepo.update(
        { projetoId, modulo },
        { tecnico: tecnico.trim() },
      );
      n = resultado.affected ?? 0;
    }

    let d = await this.repo.findOne({ where: { projetoId, modulo } });
    if (!d) {
      d = this.repo.create({ projetoId, modulo });
    }
    if (tecnico !== undefined) d.consultor = tecnico.trim();
    if (opcoes.ordem !== undefined) d.ordem = opcoes.ordem;
    if (opcoes.naoDistribuir !== undefined)
      d.naoDistribuir = opcoes.naoDistribuir;
    if (opcoes.analista !== undefined) d.analista = opcoes.analista.trim();
    await this.repo.save(d);
    return n;
  }

  /** Chamado por `ProjetosService.excluir` — ver comentário equivalente em
   * cronograma.service.ts. */
  async limparProjeto(projetoId: number): Promise<void> {
    await this.repo.delete({ projetoId });
  }
}

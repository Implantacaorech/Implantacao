import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';
import { ListarProjetosDto } from './dto/listar-projetos.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_VEEM_TODOS_PROJETOS } from '../common/constants/perfis';
import { CronogramaService } from '../cronograma/cronograma.service';
import { DesignacoesService } from '../cronograma/designacoes.service';
import { LevantamentoRespostaService } from '../levantamento/levantamento-resposta.service';
import { DocConteudoService } from '../levantamento/doc-conteudo.service';
import { DocumentosService } from '../documentos/documentos.service';
import { NotificacaoService } from '../email/notificacao.service';

export interface Paginado<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

@Injectable()
export class ProjetosService {
  constructor(
    @InjectRepository(Projeto) private readonly repo: Repository<Projeto>,
    private readonly cronograma: CronogramaService,
    private readonly designacoes: DesignacoesService,
    private readonly levantamentoResposta: LevantamentoRespostaService,
    private readonly docConteudo: DocConteudoService,
    private readonly documentos: DocumentosService,
    private readonly notificacao: NotificacaoService,
  ) {}

  /** Equivalente a _so_meus() do Flask: ADM/Coordenador/Administrativo veem tudo; GCI só onde
   * é GCI; Consultor só onde é consultor designado. */
  async listar(
    filtro: ListarProjetosDto,
    user: AuthUser,
  ): Promise<Paginado<Projeto>> {
    const qb = this.repo
      .createQueryBuilder('p')
      .orderBy('p.atualizadoEm', 'DESC');

    if (filtro.cliente) {
      qb.andWhere('LOWER(p.cliente) LIKE LOWER(:cliente)', {
        cliente: `%${filtro.cliente}%`,
      });
    }
    if (filtro.etapa) {
      qb.andWhere('p.etapa = :etapa', { etapa: filtro.etapa });
    }
    if (!PERFIS_VEEM_TODOS_PROJETOS.includes(user.perfil)) {
      if (user.perfil === 'GCI') {
        qb.andWhere('p.gci = :nome', { nome: user.nome });
      } else {
        qb.andWhere('p.consultor = :nome', { nome: user.nome });
      }
    }

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((filtro.page - 1) * filtro.limit)
      .take(filtro.limit)
      .getMany();

    return {
      data,
      pagination: {
        page: filtro.page,
        limit: filtro.limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / filtro.limit)),
      },
    };
  }

  async buscarPorId(id: number): Promise<Projeto> {
    const projeto = await this.repo.findOne({ where: { id } });
    if (!projeto) throw new NotFoundException('Projeto não encontrado');
    return projeto;
  }

  async criar(dto: CreateProjetoDto): Promise<Projeto> {
    const projeto = this.repo.create(dto);
    return this.repo.save(projeto);
  }

  /** `etapa` nunca é editável pelo formulário genérico — no Flask original esse campo
   * nem existe em `projeto_form.html`; a única forma legítima de mudar de etapa é o botão
   * "Avançar" (`DocumentosService.avancarEtapa`), que já valida o gate (documentos +
   * campos obrigatórios + ação de entrada) via `MetricasService`. Sem esta checagem, o
   * seletor "Fase da Implantação" que a tela Angular tinha na aba Dados pulava etapa
   * sem checar nada — achado real ao fechar a pendência de enforcement de `pode_avancar`
   * (2026-07-17). */
  async atualizar(id: number, dto: UpdateProjetoDto): Promise<Projeto> {
    const projeto = await this.buscarPorId(id);
    if (dto.etapa !== undefined && dto.etapa !== projeto.etapa) {
      throw new BadRequestException(
        'A fase da implantação não pode ser alterada por aqui — use o botão "Avançar" na ficha do projeto.',
      );
    }
    const situacaoAnterior = projeto.situacao;
    Object.assign(projeto, dto);
    const salvo = await this.repo.save(projeto);
    // Notifica a Coordenação quando a situação MUDA para "Concluído" (não a cada save
    // com a situação já concluída) — mesmo gatilho de webapp/app.py:projeto_ficha (POST).
    if (dto.situacao === 'Concluído' && situacaoAnterior !== 'Concluído') {
      await this.notificacao.notificarEvento(id, 'encerrado', salvo);
    }
    return salvo;
  }

  /** Exclui o projeto e limpa toda tabela `projeto_id` de outros módulos primeiro (nenhuma
   * entidade desta migração usa FK real com `ON DELETE CASCADE` ainda — sem isso, excluir
   * um projeto deixaria linhas órfãs em todo módulo que referencia `projetoId`, a mesma
   * categoria de bug já encontrada e corrigida no Flask original nesta sessão; ver
   * docs/migracao/03-documento-conversao.md). **Ao adicionar um novo módulo com dado
   * por-projeto, registrar a limpeza aqui também.** */
  async excluir(id: number): Promise<void> {
    const projeto = await this.buscarPorId(id);
    await this.cronograma.limparProjeto(id);
    await this.designacoes.limparProjeto(id);
    await this.levantamentoResposta.limparProjeto(id);
    await this.docConteudo.limparProjeto(id);
    await this.documentos.limparProjeto(id);
    await this.repo.remove(projeto);
  }
}

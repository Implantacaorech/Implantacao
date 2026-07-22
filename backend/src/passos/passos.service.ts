import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { ProjetoPasso } from '../database/entities/projeto-passo.entity';
import {
  PapelProjeto,
  ProjetoPessoa,
} from '../database/entities/projeto-pessoa.entity';
import { Evento } from '../database/entities/evento.entity';
import { Documento } from '../database/entities/documento.entity';
import { DocumentosService } from '../documentos/documentos.service';
import { Etapa, Perfil, temPapel } from '../common/constants/perfis';
import { hojeIso } from '../cronograma/datas.util';
import { PassosNotificacaoService } from './passos-notificacao.service';
import {
  DefinicaoPasso,
  EXTENSOES_EMAIL,
  ResponsavelPasso,
  PASSOS,
  PASSOS_COM_ANEXO_DE_EMAIL,
  PASSOS_COM_CONFERENCIA,
  PASSOS_POR_NUMERO,
  PERFIS_POR_RESPONSAVEL,
} from './passos.constants';

/** Onde cada projeto está no processo — uma linha por projeto, para o quadro por fase. */
export interface PassoAtualDoProjeto {
  projetoId: number;
  /** Primeiro passo PENDENTE; `null` quando o processo inteiro foi concluído. */
  passo: number | null;
  titulo: string;
  responsavel: ResponsavelPasso | null;
  etapa: Etapa;
  concluidos: number;
  total: number;
}

export interface PassoView extends DefinicaoPasso {
  concluido: boolean;
  concluidoEm: string | null;
  concluidoPor: string;
  conferido: boolean;
  /** Passos que faltam concluir antes deste. */
  bloqueadoPor: number[];
  /** Pode ser concluído AGORA por quem está pedindo. */
  liberado: boolean;
  /** Por que não está liberado, em linguagem de negócio. */
  motivos: string[];
}

@Injectable()
export class PassosService {
  constructor(
    @InjectRepository(Projeto)
    private readonly projetos: Repository<Projeto>,
    @InjectRepository(ProjetoPasso)
    private readonly passos: Repository<ProjetoPasso>,
    @InjectRepository(ProjetoPessoa)
    private readonly pessoas: Repository<ProjetoPessoa>,
    @InjectRepository(Evento)
    private readonly eventos: Repository<Evento>,
    private readonly notificacao: PassosNotificacaoService,
    @Inject(forwardRef(() => DocumentosService))
    private readonly documentos: DocumentosService,
  ) {}

  private definicao(numero: number): DefinicaoPasso {
    const def = PASSOS_POR_NUMERO.get(numero);
    if (!def) throw new NotFoundException(`Passo ${numero} não existe.`);
    return def;
  }

  /** Quem pode executar ESTE passo NESTE projeto.
   *
   * Regra do usuário (2026-07-22): "o único que pode fazer tudo é o Administrador; os
   * demais só conseguem alterar as atividades a eles designadas". Então não basta ter o
   * perfil — para os papéis que são designados por projeto, a pessoa tem de estar
   * designada NAQUELE projeto:
   *
   *   GCI        -> precisa ser o GCI do projeto (`Projeto.gci`)
   *   Consultor  -> precisa estar em `projeto_pessoas` com papel 'consultor'
   *   Levantador -> precisa estar em `projeto_pessoas` com papel 'levantador'
   *
   * Administrativo e Coordenador NÃO são designados por projeto — não existe esse vínculo
   * no processo —, então para eles vale o perfil. ADM passa em tudo, por ser o perfil de
   * administração do Painel. */
  private podeExecutar(
    def: DefinicaoPasso,
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
    projeto: Projeto,
    designados: ProjetoPessoa[],
  ): boolean {
    if (temPapel(usuario, 'ADM')) return true;
    if (!temPapel(usuario, ...PERFIS_POR_RESPONSAVEL[def.responsavel])) {
      return false;
    }

    const nome = usuario.nome.trim().toLowerCase();
    // Nome diferente do `temPapel` importado de propósito: aquele pergunta pelo CARGO no
    // cadastro; este, pela DESIGNAÇÃO neste projeto. São checagens distintas.
    const designadoComo = (papel: PapelProjeto) =>
      designados.some(
        (d) => d.papel === papel && d.pessoa.trim().toLowerCase() === nome,
      );

    switch (def.responsavel) {
      case 'GCI':
        return projeto.gci
          .split(',')
          .some((g) => g.trim().toLowerCase() === nome);
      case 'Consultor':
        return designadoComo('consultor');
      case 'Levantador':
        // Sem fallback de propósito: o passo 2 designa os levantadores ANTES de o passo 3
        // existir, então quando ele chega já há gente designada. Se um projeto antigo não
        // tiver ninguém, o ADM resolve — é melhor do que deixar um consultor qualquer
        // assumir o levantamento sem estar designado.
        return designadoComo('levantador');
      default:
        return true;
    }
  }

  /** Carrega projeto + designados e verifica a permissão, lançando 403 com o motivo. */
  private async exigirPermissao(
    projetoId: number,
    def: DefinicaoPasso,
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
  ): Promise<Projeto> {
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');
    const designados = await this.pessoas.find({ where: { projetoId } });
    if (!this.podeExecutar(def, usuario, projeto, designados)) {
      throw new ForbiddenException(this.motivoSemPermissao(def, usuario));
    }
    return projeto;
  }

  /** Motivo, em linguagem de negócio, de a pessoa não poder executar o passo. */
  private motivoSemPermissao(
    def: DefinicaoPasso,
    usuario: { perfil: Perfil; perfis?: Perfil[] },
  ): string {
    return temPapel(usuario, ...PERFIS_POR_RESPONSAVEL[def.responsavel])
      ? `Você não está designado(a) neste projeto como ${def.responsavel}.`
      : `Só o responsável (${def.responsavel}) pode concluir.`;
  }

  async pessoasDoProjeto(
    projetoId: number,
    papel?: PapelProjeto,
  ): Promise<ProjetoPessoa[]> {
    return this.pessoas.find({
      where: papel ? { projetoId, papel } : { projetoId },
      order: { pessoa: 'ASC' },
    });
  }

  /** Substitui a lista de pessoas de um papel. `Projeto.consultor` continua sendo mantido
   * com a lista consolidada, para não quebrar telas e documentos que leem aquele campo. */
  async definirPessoas(
    projetoId: number,
    papel: PapelProjeto,
    nomes: string[],
  ): Promise<ProjetoPessoa[]> {
    const limpos = [
      ...new Set(nomes.map((n) => n.trim()).filter(Boolean)),
    ].sort();
    await this.pessoas.delete({ projetoId, papel });
    if (limpos.length > 0) {
      await this.pessoas.save(
        limpos.map((pessoa) =>
          this.pessoas.create({ projetoId, papel, pessoa }),
        ),
      );
    }
    if (papel === 'consultor') {
      await this.projetos.update(projetoId, { consultor: limpos.join(', ') });
    }
    return this.pessoasDoProjeto(projetoId, papel);
  }

  /** Os passos do projeto com o estado de cada um, para a tela de tarefas. */
  async listar(
    projetoId: number,
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
  ): Promise<PassoView[]> {
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');

    const designados = await this.pessoas.find({ where: { projetoId } });
    const feitos = await this.passos.find({ where: { projetoId } });
    const porNumero = new Map(feitos.map((f) => [f.passo, f]));

    return PASSOS.map((def) => {
      const feito = porNumero.get(def.numero);
      const bloqueadoPor = def.depende.filter((n) => {
        const anterior = porNumero.get(n);
        if (!anterior) return true;
        // Passo com conferência só libera o seguinte depois de conferido.
        return PASSOS_COM_CONFERENCIA.has(n) && !anterior.conferido;
      });

      const motivos: string[] = [];
      if (feito) motivos.push('Já concluído.');
      for (const n of bloqueadoPor) {
        const d = PASSOS_POR_NUMERO.get(n);
        motivos.push(
          PASSOS_COM_CONFERENCIA.has(n) && porNumero.has(n)
            ? `Aguardando a conferência do passo ${n} (${d?.titulo ?? ''}).`
            : `Depende do passo ${n} (${d?.titulo ?? ''}).`,
        );
      }
      if (!this.podeExecutar(def, usuario, projeto, designados)) {
        motivos.push(this.motivoSemPermissao(def, usuario));
      }

      return {
        ...def,
        concluido: !!feito,
        concluidoEm: feito ? feito.concluidoEm.toISOString() : null,
        concluidoPor: feito?.concluidoPor ?? '',
        conferido: feito?.conferido ?? false,
        bloqueadoPor,
        liberado: motivos.length === 0,
        motivos,
      };
    });
  }

  /** Conclui um passo. Recusa quando o perfil não é o responsável, quando alguma dependência
   * não está satisfeita ou quando o passo já foi concluído. */
  async concluir(
    projetoId: number,
    numero: number,
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
    observacao = '',
  ): Promise<PassoView[]> {
    const def = this.definicao(numero);
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');

    if (
      !this.podeExecutar(
        def,
        usuario,
        projeto,
        await this.pessoas.find({ where: { projetoId } }),
      )
    ) {
      throw new ForbiddenException(this.motivoSemPermissao(def, usuario));
    }

    const jaFeito = await this.passos.findOne({
      where: { projetoId, passo: numero },
    });
    if (jaFeito) {
      throw new BadRequestException(`Passo ${numero} já foi concluído.`);
    }

    if (def.depende.length > 0) {
      const anteriores = await this.passos.find({
        where: { projetoId, passo: In(def.depende) },
      });
      const porNumero = new Map(anteriores.map((a) => [a.passo, a]));
      for (const n of def.depende) {
        const anterior = porNumero.get(n);
        if (!anterior) {
          throw new BadRequestException(
            `Passo ${numero} depende do passo ${n}, que ainda não foi concluído.`,
          );
        }
        if (PASSOS_COM_CONFERENCIA.has(n) && !anterior.conferido) {
          throw new BadRequestException(
            `Passo ${numero} só libera depois da conferência do passo ${n}.`,
          );
        }
      }
    }

    await this.passos.save(
      this.passos.create({
        projetoId,
        passo: numero,
        concluidoPor: usuario.nome,
        observacao,
      }),
    );
    await this.eventos.save(
      this.eventos.create({
        projetoId,
        tipo: 'passo',
        descricao: `Passo ${numero} concluído: ${def.titulo}`,
        autor: usuario.nome,
      }),
    );

    await this.registrarEfeitosNoProjeto(projeto, numero);
    await this.sincronizarEtapa(projeto);
    void this.notificacao.notificarPasso(projeto, def, usuario.nome);
    return this.listar(projetoId, usuario);
  }

  /** Em que passo cada projeto está, para montar o quadro (Kanban) por fase.
   *
   * O "passo atual" é o primeiro PENDENTE — é onde o trabalho parou e, portanto, a coluna em
   * que o projeto aparece. Projeto com tudo concluído sai com `passo: null` (encerrado).
   *
   * Faz DUAS consultas no total, não uma por projeto: a lista de projetos costuma ser a tela
   * mais aberta do Painel e não pode pagar N+1. */
  async passoAtualDeTodos(): Promise<PassoAtualDoProjeto[]> {
    const projetos = await this.projetos.find({ select: ['id'] });
    const feitos = await this.passos.find({ select: ['projetoId', 'passo'] });

    const concluidosPorProjeto = new Map<number, Set<number>>();
    for (const f of feitos) {
      const atual = concluidosPorProjeto.get(f.projetoId) ?? new Set<number>();
      atual.add(f.passo);
      concluidosPorProjeto.set(f.projetoId, atual);
    }

    return projetos.map((p) => {
      const concluidos = concluidosPorProjeto.get(p.id) ?? new Set<number>();
      const pendente = PASSOS.find((d) => !concluidos.has(d.numero));
      return {
        projetoId: p.id,
        passo: pendente ? pendente.numero : null,
        titulo: pendente ? pendente.titulo : 'Processo concluído',
        responsavel: pendente ? pendente.responsavel : null,
        etapa: pendente ? pendente.etapa : 'Encerramento',
        concluidos: concluidos.size,
        total: PASSOS.length,
      };
    });
  }

  /** Conclui um passo porque a AÇÃO CORRESPONDENTE aconteceu no sistema — o robô criou a
   * ficha, o Administrativo agendou o levantamento, o GCI gerou o Projeto.
   *
   * Sem isto, os 18 passos seriam um checklist manual rodando em paralelo ao sistema: a
   * pessoa faria o trabalho numa tela e teria de ir marcar a caixinha em outra.
   *
   * Diferenças em relação a `concluir()`, ambas deliberadas:
   *   NÃO checa o perfil — quem autorizou foi o gate da própria rota que executou a ação;
   *   NÃO lança quando algo impede — a ação JÁ ACONTECEU e não pode ser desfeita por causa
   *     do registro. Quando a dependência não está satisfeita, registra o motivo na timeline
   *     e devolve `false`, para o passo ficar visível como pendente em vez de sumir.
   *
   * É idempotente: chamar de novo num passo já concluído não faz nada. */
  async concluirAutomatico(
    projetoId: number,
    numero: number,
    autor: string,
    acao: string,
  ): Promise<boolean> {
    const def = PASSOS_POR_NUMERO.get(numero);
    if (!def) return false;

    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (!projeto) return false;

    const jaFeito = await this.passos.findOne({
      where: { projetoId, passo: numero },
    });
    if (jaFeito) return false;

    if (def.depende.length > 0) {
      const anteriores = await this.passos.find({
        where: { projetoId, passo: In(def.depende) },
      });
      const porNumero = new Map(anteriores.map((a) => [a.passo, a]));
      const pendentes = def.depende.filter((n) => {
        const anterior = porNumero.get(n);
        return (
          !anterior || (PASSOS_COM_CONFERENCIA.has(n) && !anterior.conferido)
        );
      });
      if (pendentes.length > 0) {
        await this.eventos.save(
          this.eventos.create({
            projetoId,
            tipo: 'passo',
            descricao:
              `${acao} — o passo ${numero} (${def.titulo}) NÃO foi concluído: ` +
              `falta o passo ${pendentes.join(', ')}.`,
            autor,
          }),
        );
        return false;
      }
    }

    await this.passos.save(
      this.passos.create({
        projetoId,
        passo: numero,
        concluidoPor: autor,
        observacao: acao,
      }),
    );
    await this.eventos.save(
      this.eventos.create({
        projetoId,
        tipo: 'passo',
        descricao: `Passo ${numero} concluído automaticamente (${acao}): ${def.titulo}`,
        autor,
      }),
    );

    await this.registrarEfeitosNoProjeto(projeto, numero);
    await this.sincronizarEtapa(projeto);
    void this.notificacao.notificarPasso(projeto, def, autor);
    return true;
  }

  /** Marca a conferência dos passos 9 e 16 (Administrativo, validado com GCI ou
   * Coordenador). É o que libera o passo seguinte. */
  async conferir(
    projetoId: number,
    numero: number,
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
  ): Promise<PassoView[]> {
    const def = this.definicao(numero);
    if (!PASSOS_COM_CONFERENCIA.has(numero)) {
      throw new BadRequestException(`Passo ${numero} não tem conferência.`);
    }
    await this.exigirPermissao(projetoId, def, usuario);
    const feito = await this.passos.findOne({
      where: { projetoId, passo: numero },
    });
    if (!feito) {
      throw new BadRequestException(
        `Conclua o passo ${numero} antes de marcar a conferência.`,
      );
    }
    feito.conferido = true;
    await this.passos.save(feito);
    await this.eventos.save(
      this.eventos.create({
        projetoId,
        tipo: 'passo',
        descricao: `Passo ${numero} conferido: ${def.titulo}`,
        autor: usuario.nome,
      }),
    );
    return this.listar(projetoId, usuario);
  }

  /** Desfaz a conclusão de um passo REVERSÍVEL.
   *
   * A partir do passo 11 a conclusão é definitiva: são atos já formalizados com o cliente
   * (check-list gerado, boas-vindas enviadas, termo assinado). Reabrir daria ao Painel um
   * histórico que não corresponde ao que o cliente recebeu. */
  async reabrir(
    projetoId: number,
    numero: number,
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
  ): Promise<PassoView[]> {
    const def = this.definicao(numero);
    if (def.irreversivel) {
      throw new BadRequestException(
        `Passo ${numero} não pode ser desmarcado: uma vez concluído, é definitivo.`,
      );
    }
    await this.exigirPermissao(projetoId, def, usuario);
    // Um passo reversível não pode ser reaberto se algum passo que depende dele já andou —
    // senão o processo ficaria com um buraco no meio.
    const dependentes = PASSOS.filter((p) => p.depende.includes(numero)).map(
      (p) => p.numero,
    );
    if (dependentes.length > 0) {
      const seguintes = await this.passos.find({
        where: { projetoId, passo: In(dependentes) },
      });
      if (seguintes.length > 0) {
        const lista = seguintes.map((s) => s.passo).join(', ');
        throw new BadRequestException(
          `Passo ${numero} não pode ser reaberto: o passo ${lista} já foi concluído.`,
        );
      }
    }
    await this.passos.delete({ projetoId, passo: numero });
    await this.eventos.save(
      this.eventos.create({
        projetoId,
        tipo: 'passo',
        descricao: `Passo ${numero} reaberto: ${def.titulo}`,
        autor: usuario.nome,
      }),
    );
    const projeto = await this.projetos.findOne({ where: { id: projetoId } });
    if (projeto) await this.sincronizarEtapa(projeto);
    return this.listar(projetoId, usuario);
  }

  /** Anexa ao projeto o e-mail ENCAMINHADO pelo Outlook, como registro dos passos 3 e 4.
   *
   * O e-mail desses passos sai do Outlook da própria pessoa, não do Painel; o que o sistema
   * guarda é a prova de que aconteceu. Aceita `.msg` (nativo do Outlook) e `.eml`. */
  async anexarEmail(
    projetoId: number,
    numero: number,
    arquivo: { originalname: string; buffer: Buffer },
    usuario: { nome: string; perfil: Perfil; perfis?: Perfil[] },
  ): Promise<Documento> {
    const def = this.definicao(numero);
    if (!PASSOS_COM_ANEXO_DE_EMAIL.has(numero)) {
      throw new BadRequestException(
        `Passo ${numero} não registra e-mail encaminhado.`,
      );
    }
    await this.exigirPermissao(projetoId, def, usuario);
    const nome = arquivo.originalname || '';
    const ext = nome.slice(nome.lastIndexOf('.')).toLowerCase();
    if (!EXTENSOES_EMAIL.includes(ext)) {
      throw new BadRequestException(
        `Anexe o e-mail encaminhado do Outlook (${EXTENSOES_EMAIL.join(' ou ')}).`,
      );
    }
    const doc = await this.documentos.anexarDocumento(
      projetoId,
      `email_passo_${numero}`,
      nome,
      arquivo.buffer,
    );
    await this.eventos.save(
      this.eventos.create({
        projetoId,
        tipo: 'documento',
        descricao: `Passo ${numero}: e-mail encaminhado anexado (${nome})`,
        autor: usuario.nome,
      }),
    );
    return doc;
  }

  /** Efeitos que a conclusão de um passo tem sobre os campos do projeto.
   *
   * Passo 14 ("Sinalizar Projeto concluído + Data de conclusão") grava a data em
   * `dataEncerramento` — decisão do usuário em 2026-07-22. Só grava se ainda estiver vazio,
   * para não sobrescrever uma data que alguém já tenha informado à mão. */
  private async registrarEfeitosNoProjeto(
    projeto: Projeto,
    numero: number,
  ): Promise<void> {
    if (numero === 14 && !projeto.dataEncerramento.trim()) {
      projeto.dataEncerramento = hojeIso();
      await this.projetos.save(projeto);
    }
  }

  /** Mantém a macro-etapa do projeto coerente com os passos concluídos.
   *
   * A macro-etapa é a do passo pendente mais antigo — assim o painel continua mostrando
   * "onde o projeto está" mesmo com as duas trilhas (Projeto e Cronograma) correndo em
   * paralelo depois do passo 7. */
  private async sincronizarEtapa(projeto: Projeto): Promise<void> {
    const feitos = await this.passos.find({
      where: { projetoId: projeto.id },
    });
    const concluidos = new Set(feitos.map((f) => f.passo));
    const pendente = PASSOS.find((p) => !concluidos.has(p.numero));
    const etapa = pendente ? pendente.etapa : 'Encerramento';
    if (projeto.etapa !== etapa) {
      const anterior = projeto.etapa;
      projeto.etapa = etapa;
      await this.projetos.save(projeto);
      await this.eventos.save(
        this.eventos.create({
          projetoId: projeto.id,
          tipo: 'etapa',
          descricao: `Etapa ajustada pelos passos: ${anterior} → ${etapa}`,
          autor: 'sistema',
        }),
      );
    }
  }
}

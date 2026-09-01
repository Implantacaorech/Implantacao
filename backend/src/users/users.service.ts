import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../database/entities/usuario.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { RecuperacaoSenha } from '../database/entities/recuperacao-senha.entity';
import { PreferenciaUsuario } from '../database/entities/preferencia-usuario.entity';
import { PermissaoUsuario } from '../database/entities/permissao-usuario.entity';
import { Perfil, papeisConflitantes } from '../common/constants/perfis';
import { normalizarPapeis, papeisDoUsuario } from './papeis.util';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
  ) {}

  async porLogin(login: string): Promise<Usuario | null> {
    return this.repo.findOne({ where: { login: login.trim(), ativo: true } });
  }

  /** Usuário ATIVO por e-mail (case-insensitive), caindo no `login` quando a conta foi
   * criada sem preencher o campo `email` — é comum aqui, porque `criar()` aceita login em
   * branco e copia o e-mail para ele, mas o inverso nunca aconteceu. Usado pelo "Esqueci
   * minha senha": a pessoa só digita o e-mail. */
  async porEmail(email: string): Promise<Usuario | null> {
    const e = (email || '').trim().toLowerCase();
    if (!e) return null;
    return this.repo
      .createQueryBuilder('u')
      .where('(LOWER(u.email) = :e OR LOWER(u.login) = :e)', { e })
      .andWhere('u.ativo = :ativo', { ativo: true })
      .getOne();
  }

  /** Todos os usuários (ativos e inativos), ordenados por nome — tela de Usuários (ADM). */
  async listar(): Promise<Usuario[]> {
    return this.repo.find({ order: { nome: 'ASC' } });
  }

  async buscarPorId(id: number): Promise<Usuario> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    return u;
  }

  /** Existe um usuário (ativo ou não) com esse login OU esse e-mail? Espelha
   * webapp/db.py:existe_usuario — usado no auto-cadastro para rejeitar duplicidade antes
   * de gerar o código de verificação. `ignorarId` exclui o próprio registro (edição). */
  async existeUsuario(
    login: string,
    email: string,
    ignorarId?: number,
  ): Promise<boolean> {
    const l = (login || '').trim().toLowerCase();
    const e = (email || '').trim().toLowerCase();
    if (!l && !e) return false;
    // Parênteses explícitos são obrigatórios aqui: `.where()`/`.andWhere()` do TypeORM NÃO
    // envolve strings cruas em parênteses automaticamente — sem eles, o `AND` (precedência
    // maior que `OR` em SQL) se aplicaria só ao segundo termo do OR, e um login batendo
    // sozinho já daria match mesmo com o próprio id excluído (achado escrevendo o teste
    // e2e de edição: um usuário editando o próprio registro sempre "colidia consigo
    // mesmo").
    const qb = this.repo
      .createQueryBuilder('u')
      .where('(LOWER(u.login) = :l OR LOWER(u.email) = :e)', { l, e });
    if (ignorarId) qb.andWhere('u.id != :id', { id: ignorarId });
    return (await qb.getCount()) > 0;
  }

  /** E-mail de um usuário ATIVO pelo nome (prefere o campo `email`, cai no `login`) —
   * exact match, case-insensitive. Espelha webapp/db.py:email_do_usuario, usado pela
   * Designação para resolver o destinatário da notificação a partir de `Projeto.gci`/
   * `Designacao.consultor` (strings de nome, não ids). */
  async emailDoUsuario(nome: string): Promise<string | null> {
    if (!nome) return null;
    const u = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.nome) = :nome', { nome: nome.trim().toLowerCase() })
      .andWhere('u.ativo = :ativo', { ativo: true })
      .getOne();
    if (!u) return null;
    return u.email || u.login || null;
  }

  /** Usuários ativos que TÊM o papel — não só quem o tem como principal.
   *
   * Desde que os papéis passaram a ser múltiplos, filtrar por `perfil` deixaria de fora
   * justamente quem acumula cargo (o GCI que também é Levantador, por exemplo). O filtro
   * é feito em memória porque a lista de usuários do Painel é pequena e cabe inteira. */
  async porPerfil(perfil: Perfil): Promise<Usuario[]> {
    const ativos = await this.repo.find({ where: { ativo: true } });
    return ativos.filter((u) => papeisDoUsuario(u).includes(perfil));
  }

  /** `{nomeLower: codigoSicla}` dos usuários ativos (restringe a `nomes` se informado) — o
   * elo entre um técnico/consultor deste sistema e a agenda de disponibilidade externa
   * (SICLA/Oracle). Espelha webapp/db.py:codigos_sicla_por_nome. */
  async codigosSiclaPorNome(nomes?: string[]): Promise<Record<string, string>> {
    const alvo = new Set(
      (nomes ?? []).map((n) => (n || '').trim().toLowerCase()).filter(Boolean),
    );
    const usuarios = await this.repo.find({ where: { ativo: true } });
    const out: Record<string, string> = {};
    for (const u of usuarios) {
      const nl = (u.nome || '').trim().toLowerCase();
      if (nl && (alvo.size === 0 || alvo.has(nl))) {
        out[nl] = (u.codigoSicla || '').trim();
      }
    }
    return out;
  }

  async contarAtivos(): Promise<number> {
    return this.repo.count({ where: { ativo: true } });
  }

  /** Recusa dois usuários ATIVOS com o mesmo nome.
   *
   * O NOME é a chave de designação em todo o processo: `projeto_pessoas.pessoa` e
   * `Projeto.gci` guardam nome, e é por ele que a RN-10 decide quem conclui cada passo e
   * para quem sai cada e-mail. Com dois cadastros homônimos, o segundo herda os passos e as
   * mensagens do primeiro — provado em 2026-08-05, quando um homônimo do consultor designado
   * concluiu o passo 13 de um projeto que não era dele e passou a receber os e-mails do
   * cliente. Enquanto a designação não migrar para o ID do usuário, a saída é não deixar a
   * ambiguidade nascer. Compara sem caixa e sem espaço em excesso; ignora inativos, que não
   * são designáveis. */
  private async existeHomonimo(
    nome: string,
    ignorarId?: number,
  ): Promise<boolean> {
    const alvo = (nome || '').trim().toLowerCase();
    if (!alvo) return false;
    const ativos = await this.repo.find({ where: { ativo: true } });
    return ativos.some(
      (u) => u.id !== ignorarId && (u.nome || '').trim().toLowerCase() === alvo,
    );
  }

  /** Guarda das duas regras do papel `Cliente` (docs/acesso-cliente-bi.md §3).
   *
   * 1. **`Cliente` não se acumula.** O acúmulo de papéis existe para quem é GCI e Levantador
   *    ao mesmo tempo; aplicado ao `Cliente`, ele viraria a porta de saída do recorte —
   *    quem também fosse `Consultor` cairia no ramo "interno vê tudo" de toda verificação.
   * 2. **Cada papel exige o SEU código.** Interno sem `codigoSicla` não se liga à agenda;
   *    `Cliente` sem `codigoClienteSicla` não tem escopo — e a regra do recorte é negar,
   *    nunca mostrar tudo. Cobrar na gravação é o que torna "usuário-cliente sem escopo"
   *    inexistente, em vez de um caso a tratar depois em cada consulta.
   *
   * Recebe o estado FINAL (já mesclado, na edição), porque é ele que precisa ser coerente —
   * não o punhado de campos que veio no pedido.
   *
   * `exigirCodigoSiclaInterno` é falso na EDIÇÃO de propósito. O código do técnico sempre foi
   * cobrado apenas na criação (`UpdateUsuarioDto` é `PartialType`, logo o campo nunca foi
   * obrigatório ao editar), e há cadastros antigos sem ele — passar a cobrá-lo aqui
   * impediria de editar qualquer um desses, que é endurecer uma regra que ninguém pediu.
   * As regras do `Cliente`, ao contrário, valem nos dois caminhos: "usuário-cliente sem
   * escopo" não é um cadastro incompleto, é uma falha de isolamento. */
  private exigirVinculoCoerente(
    estado: {
      perfil: Perfil;
      perfis: Perfil[];
      codigoSicla: string;
      codigoClienteSicla: string;
    },
    exigirCodigoSiclaInterno: boolean,
  ): void {
    if (papeisConflitantes(estado.perfis)) {
      throw new BadRequestException(
        'O papel "Cliente" é exclusivo: um usuário cliente não pode acumular papéis ' +
          'internos da Rech. Deixe "Cliente" como papel principal e desmarque os demais.',
      );
    }
    const cliente = estado.perfis.includes('Cliente');
    if (cliente && !(estado.codigoClienteSicla ?? '').trim()) {
      throw new BadRequestException(
        'Informe o Código do Cliente no SICLA — é obrigatório no papel "Cliente" e é o ' +
          'que limita o que essa pessoa enxerga no BI.',
      );
    }
    if (
      !cliente &&
      exigirCodigoSiclaInterno &&
      !(estado.codigoSicla ?? '').trim()
    ) {
      throw new BadRequestException(
        'Informe o Código SICLA do usuário — é obrigatório.',
      );
    }
  }

  /** Papéis finais a partir do que veio no pedido.
   *
   * Inclui o `perfil` principal de propósito, espelhando `papeisDoUsuario` — é assim que a
   * permissão é lida em runtime. Sem isso, gravar `perfil: 'Consultor'` com
   * `perfis: ['Cliente']` passaria pela checagem de exclusividade e produziria exatamente o
   * usuário misto que ela existe para impedir. */
  private papeisFinais(perfil: Perfil, perfis?: Perfil[]): Perfil[] {
    // `filter(Boolean)`: o principal pode chegar vazio em cadastro antigo (e nos mocks de
    // teste), e `normalizarPapeis` faz `.trim()` em cada item — um `undefined` na lista
    // derrubaria a gravação inteira.
    return normalizarPapeis(
      [perfil, ...(perfis ?? [])].filter((p): p is Perfil => Boolean(p)),
    );
  }

  async criar(dados: {
    login: string;
    nome: string;
    email: string;
    senha: string;
    perfil: Perfil;
    perfis?: Perfil[];
    codigoSicla?: string;
    codigoClienteSicla?: string;
    modulosCapacitados?: string;
    setorAtuacao?: string;
  }): Promise<Usuario> {
    const papeis = this.papeisFinais(dados.perfil, dados.perfis);
    this.exigirVinculoCoerente(
      {
        perfil: dados.perfil,
        perfis: papeis,
        codigoSicla: dados.codigoSicla ?? '',
        codigoClienteSicla: dados.codigoClienteSicla ?? '',
      },
      true,
    );
    const login = (dados.login || '').trim() || dados.email.trim(); // login em branco usa o e-mail
    if (await this.existeUsuario(login, dados.email)) {
      throw new ConflictException(
        'Já existe um usuário com este login ou e-mail.',
      );
    }
    if (await this.existeHomonimo(dados.nome)) {
      throw new ConflictException(
        `Já existe um usuário ativo chamado "${dados.nome.trim()}". O nome é o que liga a ` +
          'pessoa às designações do projeto — diferencie (ex.: incluindo o sobrenome).',
      );
    }
    const senhaHash = await bcrypt.hash(dados.senha, SALT_ROUNDS);
    const usuario = this.repo.create({
      login,
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      perfil: dados.perfil,
      perfis: papeis.join(', '),
      codigoSicla: dados.codigoSicla ?? '',
      codigoClienteSicla: dados.codigoClienteSicla ?? '',
      modulosCapacitados: dados.modulosCapacitados ?? '',
      setorAtuacao: dados.setorAtuacao ?? '',
      ativo: true,
    });
    return this.repo.save(usuario);
  }

  /** Atualiza um usuário existente. `senha` só é alterada se enviada (não-vazia) — mesmo
   * contrato de webapp/app.py:usuarios (edição via formulário, senha em branco = mantém a
   * atual). */
  async atualizar(
    id: number,
    dados: {
      login?: string;
      nome?: string;
      email?: string;
      senha?: string;
      perfil?: Perfil;
      perfis?: Perfil[];
      codigoSicla?: string;
      codigoClienteSicla?: string;
      modulosCapacitados?: string;
      setorAtuacao?: string;
      ativo?: boolean;
    },
  ): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);
    // Estado FINAL (o que já está gravado + o que veio no pedido) — é ele que precisa ser
    // coerente. Validar só os campos enviados deixaria passar a edição que troca o papel
    // para `Cliente` sem informar o código do cliente, ou o contrário.
    const papeis = this.papeisFinais(
      dados.perfil ?? usuario.perfil,
      dados.perfis ?? papeisDoUsuario(usuario),
    );
    this.exigirVinculoCoerente(
      {
        perfil: dados.perfil ?? usuario.perfil,
        perfis: papeis,
        codigoSicla: dados.codigoSicla ?? usuario.codigoSicla,
        codigoClienteSicla:
          dados.codigoClienteSicla ?? usuario.codigoClienteSicla,
      },
      false,
    );
    const loginNovo =
      dados.login !== undefined
        ? dados.login.trim() || (dados.email ?? usuario.email).trim()
        : usuario.login;
    const emailNovo = dados.email !== undefined ? dados.email : usuario.email;
    if (await this.existeUsuario(loginNovo, emailNovo, id)) {
      throw new ConflictException(
        'Já existe um usuário com este login ou e-mail.',
      );
    }
    // Só quando o nome MUDA (ou quando um inativo é reativado): reeditar outro campo de um
    // cadastro já existente não pode falhar por causa de uma duplicidade anterior a esta regra.
    const nomeNovo = dados.nome !== undefined ? dados.nome : usuario.nome;
    const vaiFicarAtivo =
      dados.ativo !== undefined ? dados.ativo : usuario.ativo;
    const mudouNome =
      (dados.nome !== undefined && dados.nome.trim() !== usuario.nome.trim()) ||
      (vaiFicarAtivo && !usuario.ativo);
    if (mudouNome && (await this.existeHomonimo(nomeNovo, id))) {
      throw new ConflictException(
        `Já existe um usuário ativo chamado "${nomeNovo.trim()}". O nome é o que liga a ` +
          'pessoa às designações do projeto — diferencie (ex.: incluindo o sobrenome).',
      );
    }
    usuario.login = loginNovo;
    if (dados.nome !== undefined) usuario.nome = dados.nome;
    usuario.email = emailNovo;
    if (dados.perfil !== undefined) usuario.perfil = dados.perfil;
    if (dados.perfis !== undefined || dados.perfil !== undefined) {
      usuario.perfis = papeis.join(', ');
    }
    if (dados.codigoSicla !== undefined)
      usuario.codigoSicla = dados.codigoSicla;
    if (dados.codigoClienteSicla !== undefined)
      usuario.codigoClienteSicla = dados.codigoClienteSicla;
    if (dados.modulosCapacitados !== undefined)
      usuario.modulosCapacitados = dados.modulosCapacitados;
    if (dados.setorAtuacao !== undefined)
      usuario.setorAtuacao = dados.setorAtuacao;
    if (dados.ativo !== undefined) usuario.ativo = dados.ativo;
    if (dados.senha)
      usuario.senhaHash = await bcrypt.hash(dados.senha, SALT_ROUNDS);
    return this.repo.save(usuario);
  }

  /** Exclusão DEFINITIVA de um usuário (rota exclusiva do ADM).
   *
   * Guardas:
   * - o ADM não exclui a si mesmo — de quebra, como só ADM chega aqui, sempre sobra ao
   *   menos um ADM no cadastro;
   * - quem tem designação em projeto (`projeto_pessoas`, por `usuarioId` ou, nos vínculos
   *   antigos sem id, pelo nome) não pode ser excluído: o vínculo é histórico do processo
   *   (passos, e-mails, documentos). Para afastar a pessoa, o caminho continua sendo
   *   desativar (`ativo = false`).
   *
   * O schema não tem FK física (integridade é da aplicação — convenção registrada no
   * vault/05), então os registros satélites do usuário — sessões, códigos de recuperação
   * de senha, preferências de tela e exceções de permissão — são removidos aqui junto,
   * para não virarem órfãos. */
  async excluir(id: number, idLogado: number): Promise<void> {
    const usuario = await this.buscarPorId(id);
    if (id === idLogado) {
      throw new ConflictException(
        'Você não pode excluir o próprio usuário logado.',
      );
    }
    const nome = (usuario.nome || '').trim().toLowerCase();
    const designacoes = await this.repo.manager
      .createQueryBuilder(ProjetoPessoa, 'pp')
      .where(
        '(pp.usuarioId = :id OR (pp.usuarioId IS NULL AND LOWER(TRIM(pp.pessoa)) = :nome))',
        { id, nome },
      )
      .getCount();
    if (designacoes > 0) {
      throw new ConflictException(
        `"${usuario.nome}" tem ${designacoes} designação(ões) em projetos e não pode ser ` +
          'excluído — desmarque o campo Ativo para afastá-lo sem perder o histórico.',
      );
    }
    await this.repo.manager.delete(RefreshToken, { usuarioId: id });
    await this.repo.manager.delete(RecuperacaoSenha, { usuarioId: id });
    await this.repo.manager.delete(PreferenciaUsuario, { usuarioId: id });
    await this.repo.manager.delete(PermissaoUsuario, { usuarioId: id });
    await this.repo.delete(id);
  }

  async validarSenha(usuario: Usuario, senha: string): Promise<boolean> {
    return bcrypt.compare(senha, usuario.senhaHash);
  }

  /** Autoatendimento (`POST /auth/trocar-senha`) — diferente de `atualizar()` (ADM edita
   * qualquer usuário sem confirmar a senha atual), aqui é o próprio usuário logado trocando
   * a sua, por isso exige a senha atual. Cobre também o caso da migração de dados: senha
   * temporária aleatória (ver migrar-legado.ts) → o usuário troca por uma de sua escolha. */
  async trocarSenha(
    id: number,
    senhaAtual: string,
    senhaNova: string,
  ): Promise<void> {
    const usuario = await this.buscarPorId(id);
    if (!(await this.validarSenha(usuario, senhaAtual))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    usuario.senhaHash = await bcrypt.hash(senhaNova, SALT_ROUNDS);
    await this.repo.save(usuario);
  }

  /** Grava uma senha nova SEM conferir a atual — quem já não a sabe é justamente o caso de
   * uso. Só pode ser chamado depois que a identidade foi provada por outro meio: hoje,
   * exclusivamente pelo código de 6 dígitos do "Esqueci minha senha"
   * (RecuperacaoSenhaService). Não exponha isto num endpoint direto. */
  async definirSenha(id: number, senhaNova: string): Promise<void> {
    const usuario = await this.buscarPorId(id);
    usuario.senhaHash = await bcrypt.hash(senhaNova, SALT_ROUNDS);
    await this.repo.save(usuario);
  }
}

import {
  BadGatewayException,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CredencialPortal } from './portal-credencial.service';

/** Base da API do Portal Rech. O bundle monta `_getBaseUrl = host + versão + "/"`, ou seja
 * `hostWebservice("…/api/") + "v1" + "/"` = `…/api/v1/` — o segmento de versão faz parte do
 * caminho de TODAS as rotas (login, empresa, visita). Faltava o `v1/` numa primeira versão e
 * o login caía em `/api/login` → o gateway devolvia 401 ("usuário/senha recusados") mesmo com
 * a credencial certa (achado no 1º envio real, 2026-08-13). Sobrescritível por env nos testes. */
const BASE_PADRAO = 'https://portalrech.com.br/api/v1/';
/** Cabeçalho onde o Portal DEVOLVE o token no login (com prefixo `Bearer `). O mesmo valor
 * volta como `Authorization` nas chamadas seguintes. */
const HEADER_TOKEN = 'Rech-Portal-Token-Autenticacao';

/** Dados do atendimento que este serviço envia — já validados/ajustados pelo consultor na
 * tela. As 4 datas vêm no formato do `datetime-local` (`YYYY-MM-DDTHH:MM`). */
export interface VisitaPortalInput {
  /** Código do cliente no SICLA — resolvido para o `idEmpresa` interno do Portal. */
  clienteCodigo: string;
  /** Nome do cliente — fallback para achar a empresa quando o código não bate. */
  clienteNome?: string;
  dataInicioVisita: string;
  dataFimVisita: string;
  dataInicioDeslocamento: string;
  dataFimDeslocamento: string;
  custoPedagio: number;
  custoEstadia: number;
  custoAlimentacao: number;
  custoEstacionamento: number;
  kmInicial: number | null;
  kmFinal: number | null;
  descricaoAtividade: string;
  /** Nome do módulo (da nossa tela) — casa com a descrição do módulo no Portal. */
  modulo?: string;
  /** Nome do contato do atendimento (da nossa tela) — casa com um contato da empresa. */
  contatoNome?: string;
}

/** Uma visita LISTADA do Portal, no recorte que o painel do BI consome. A listagem
 * (`GET visita`) é ESCOPADA À CREDENCIAL: devolve as visitas do próprio usuário logado
 * (sondado com dados reais em 2026-08-17 — 76 visitas, 1 `nomeUsuario`). */
export interface VisitaPortalListada {
  /** O `id` da visita no Portal — é o número de PROTOCOLO que o time usa (faixa 130.000+). */
  id: number;
  /** Código do cliente no SICLA (`codigoCliente` da empresa). */
  codigoCliente: number | null;
  nomeEmpresa: string;
  nomeContato: string;
  nomeUsuario: string;
  /** Início da visita em "AAAA-MM-DD HH:MM:SS" no fuso do servidor (o Portal manda epoch
   * em milissegundos). Vazio quando a visita não tem data. */
  inicio: string;
  /** Como o Portal devolve: APROVADO | PENDENTE | … — é a aprovação REAL (não existe
   * espelho confiável dela no SICLA). */
  statusAprovacao: string;
}

/** Cliente da API do Portal Rech (portalrech.com.br) para criar o "Registro de Atendimento
 * em Visita" como RASCUNHO — o envio ao SICLA continua sendo um clique do consultor DENTRO do
 * Portal (decisão: abrir pré-preenchido para conferir). Sai por `fetch` (mesmo padrão de saída
 * do IaService). Passo a passo isolado de propósito: o 1º envio real valida o contrato inferido
 * do bundle, e um erro precisa dizer EXATAMENTE em qual etapa (login/empresa/criação) parou. */
@Injectable()
export class PortalRechService {
  private readonly logger = new Logger('PortalRechService');
  private readonly base = process.env.PORTAL_RECH_BASE || BASE_PADRAO;

  private url(caminho: string): string {
    return `${this.base}${caminho}`;
  }

  /** Autentica e devolve o token (cabeçalho `Rech-Portal-Token-Autenticacao`, com `Bearer `)
   * E o id do usuário logado (corpo da resposta `{id}`). O `idUsuario` é OBRIGATÓRIO na
   * atividade da visita — sem ele o Portal dá 503 "id must not be null". */
  async autenticar(
    cred: CredencialPortal,
  ): Promise<{ token: string; idUsuario: number | null }> {
    let resp: Response;
    try {
      resp = await fetch(this.url('login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // O Portal valida o campo `email`, não `login` — 400 "Campo email não informado"
          // (achado no 1º login real, 2026-08-13). O consultor entra com o e-mail do Portal;
          // mando também `login` com o mesmo valor por segurança (Spring ignora campo extra).
          email: cred.login,
          login: cred.login,
          senha: cred.senha,
          mantemLogado: false,
        }),
      });
    } catch (e) {
      throw new BadGatewayException(
        `Não foi possível falar com o Portal Rech: ${(e as Error).message}`,
      );
    }
    if (!resp.ok) {
      // Captura o corpo da resposta para ver o motivo REAL — 400 no login costuma trazer a
      // validação do Portal (campo faltando/errado). Loga um WARN (o monitor pega) e devolve
      // um trecho para a tela.
      const detalhe = await resp.text().catch(() => '');
      this.logger.warn(
        `Login no Portal recusado (HTTP ${resp.status}): ${detalhe.slice(0, 400)}`,
      );
      if (resp.status === 401 || resp.status === 403) {
        throw new UnauthorizedException(
          'Usuário ou senha do Portal Rech recusados. Confira as credenciais salvas.',
        );
      }
      throw new UnprocessableEntityException(
        `Login no Portal Rech falhou (HTTP ${resp.status}). ${detalhe.slice(0, 250)}`,
      );
    }
    const token = resp.headers.get(HEADER_TOKEN);
    if (!token) {
      throw new BadGatewayException(
        'Portal Rech não devolveu o token de autenticação esperado.',
      );
    }
    // O corpo do login traz o usuário logado (`{id, ...}`) — é este id que vai na atividade.
    const corpo = (await resp.json().catch(() => null)) as {
      id?: number;
    } | null;
    const idUsuario = typeof corpo?.id === 'number' ? corpo.id : null;
    return { token, idUsuario };
  }

  /** GET autenticado que devolve JSON. Centraliza o cabeçalho `Authorization`. */
  private async getJson(caminho: string, token: string): Promise<unknown> {
    const resp = await fetch(this.url(caminho), {
      headers: { Authorization: token },
    });
    if (!resp.ok) {
      throw new BadGatewayException(
        `Portal Rech recusou GET ${caminho} (HTTP ${resp.status}).`,
      );
    }
    return resp.json();
  }

  /** Normaliza a resposta de lista do Portal: pode vir como array puro ou como página
   * Spring (`{ content: [...] }`). */
  private lista(dados: unknown): Record<string, unknown>[] {
    if (Array.isArray(dados)) return dados as Record<string, unknown>[];
    if (dados && typeof dados === 'object' && 'content' in dados) {
      const c = (dados as { content: unknown }).content;
      if (Array.isArray(c)) return c as Record<string, unknown>[];
    }
    return [];
  }

  /** Resolve o `idEmpresa` interno do Portal a partir do código do cliente no SICLA (e, como
   * fallback, do nome). Busca a lista de empresas e casa: 1º por `codigoCliente` (exato); se
   * não achar, por `razaoSocial`/`nomeFantasia` iguais ao nome do cliente (sem acento de
   * maiúsc./minúsc.). Assim o sistema acha a empresa sozinho — evita depender do formato exato
   * do filtro proprietário do Portal e do protocolo ter código. */
  async resolverIdEmpresa(
    token: string,
    codigoCliente: string,
    clienteNome = '',
  ): Promise<number> {
    const cod = (codigoCliente || '').trim();
    const nome = (clienteNome || '').trim().toLowerCase();
    if (!cod && !nome) {
      throw new UnprocessableEntityException(
        'Sem código nem nome de cliente para localizar a empresa no Portal.',
      );
    }
    // A lista do Portal é PAGINADA (limite de 2000 por página, achado 2026-08-13). Percorre
    // as páginas casando por código (campo `codigoCliente`) e, como fallback, pela razão/
    // fantasia — e PARA assim que acha, sem baixar o resto. Cap de páginas evita loop infinito.
    const alvo = cod ? Number(cod) : NaN;
    const igualNome = (v: unknown): boolean =>
      String(v ?? '')
        .trim()
        .toLowerCase() === nome;
    const TAM = 2000;
    const MAX_PAGINAS = 30;
    let vistas = 0;
    for (let page = 0; page < MAX_PAGINAS; page++) {
      const dados = await this.getJson(
        `empresa?size=${TAM}&page=${page}`,
        token,
      );
      const empresas = this.lista(dados);
      if (empresas.length === 0) break;
      vistas += empresas.length;

      if (cod) {
        const porCodigo = empresas.find(
          (e) => e['id'] != null && Number(e['codigoCliente']) === alvo,
        );
        if (porCodigo) return Number(porCodigo['id']);
      }
      if (nome) {
        const porNome = empresas.find(
          (e) =>
            e['id'] != null &&
            (igualNome(e['razaoSocial']) || igualNome(e['nomeFantasia'])),
        );
        if (porNome) return Number(porNome['id']);
      }
      if (empresas.length < TAM) break; // última página
    }

    this.logger.warn(
      `Empresa não achada no Portal após ${vistas} registros (cod=${cod}, nome="${clienteNome}").`,
    );
    throw new UnprocessableEntityException(
      `Cliente "${cod || clienteNome}" não foi encontrado entre as empresas do Portal Rech. ` +
        'Confira o código do cliente na tela.',
    );
  }

  /** Busca filtrada no Portal usando o mesmo mecanismo do app deles: `?search=campo eq valor`
   * (operadores mapeados do bundle: `eq`/`neq`/`ct`). Sem filtro, traz a 1ª página. */
  private async buscarFiltrado(
    caminho: string,
    filtro: string,
    token: string,
  ): Promise<Record<string, unknown>[]> {
    const q = filtro
      ? `?search=${encodeURIComponent(filtro)}&size=2000`
      : `?size=2000`;
    return this.lista(await this.getJson(`${caminho}${q}`, token));
  }

  /** Um contato ativo da empresa (id + nome). Casa pelo nome vindo da tela (o responsável do
   * SICLA); senão pega o primeiro. O Portal EXIGE contato na atividade. */
  private async resolverContato(
    token: string,
    idEmpresa: number,
    contatoNome = '',
  ): Promise<{ idContato: number; nomeContato: string }> {
    const lista = await this.buscarFiltrado(
      'contato',
      `empresa.id eq ${idEmpresa}`,
      token,
    );
    const ativos = lista.filter(
      (c) => String(c['status'] ?? 'A').toUpperCase() !== 'I',
    );
    const candidatos = ativos.length ? ativos : lista;
    const nome = contatoNome.trim().toLowerCase();
    const match =
      (nome
        ? candidatos.find((c) =>
            String(c['nome'] ?? '')
              .toLowerCase()
              .includes(nome),
          )
        : undefined) ?? candidatos[0];
    if (!match || match['id'] == null) {
      throw new UnprocessableEntityException(
        'A empresa não tem contato cadastrado no Portal Rech — cadastre um contato antes de lançar o atendimento.',
      );
    }
    return {
      idContato: Number(match['id']),
      nomeContato: String(match['nome'] ?? contatoNome),
    };
  }

  /** Um módulo do Portal (id). Casa pela descrição com o módulo classificado no protocolo;
   * senão pega o primeiro. Obrigatório na atividade. */
  private async resolverIdModulo(
    token: string,
    nomeModulo = '',
  ): Promise<number> {
    const lista = await this.buscarFiltrado('modulo', '', token);
    const nome = nomeModulo.trim().toLowerCase();
    const match =
      (nome
        ? lista.find((m) => {
            const d = String(m['descricao'] ?? '').toLowerCase();
            return d.includes(nome) || (d.length > 0 && nome.includes(d));
          })
        : undefined) ?? lista[0];
    if (!match || match['id'] == null) {
      throw new UnprocessableEntityException(
        'Nenhum módulo disponível no Portal Rech para o atendimento.',
      );
    }
    return Number(match['id']);
  }

  /** Um tipo de atividade ativo (id) — o Portal aceita nulo, mas preencher evita o "Selecione
   * um tipo". Pega o primeiro ativo; nulo se não houver. */
  private async resolverIdTipoAtividade(
    token: string,
  ): Promise<number | null> {
    const lista = await this.buscarFiltrado(
      'tipoatividade',
      'status eq A',
      token,
    );
    const primeiro = lista.find((t) => t['id'] != null);
    return primeiro ? Number(primeiro['id']) : null;
  }

  /** Cria a visita (rascunho) e devolve o id gerado. NÃO envia ao SICLA — isso é um passo
   * separado (`enviarParaSicla`) que o consultor dá no Portal ao conferir.
   *
   * O objeto da atividade espelha EXATAMENTE o que o app do Portal monta em `acoesVisita`
   * (achado no bundle, 2026-08-13): o campo do texto é `descricao` (não `descricaoAtividade`),
   * e `idModulo`/`idContato` são OBRIGATÓRIOS — nulos davam 503 "id must not be null". */
  async criarVisita(
    token: string,
    idEmpresa: number,
    input: VisitaPortalInput,
    atividade: {
      idModulo: number;
      idTipoAtividade: number | null;
      idContato: number;
      nomeContato: string;
      idUsuario: number | null;
    },
  ): Promise<number> {
    const corpo = {
      // A VISITA exige, no topo, `idUsuario` (quem atende) e `idContato` (contato principal) —
      // ambos required no form do Portal. Faltavam e davam 503 "id must not be null" mesmo com
      // os ids da atividade preenchidos (achado 2026-08-13). Reusa o usuário logado e o mesmo
      // contato resolvido para a atividade.
      idUsuario: atividade.idUsuario,
      idContato: atividade.idContato,
      idEmpresa,
      dataInicioVisita: this.dataHora(input.dataInicioVisita),
      dataFimVisita: this.dataHora(input.dataFimVisita),
      dataInicioDeslocamento: this.dataHora(input.dataInicioDeslocamento),
      dataFimDeslocamento: this.dataHora(input.dataFimDeslocamento),
      custoPedagio: input.custoPedagio,
      custoEstadia: input.custoEstadia,
      custoAlimentacao: input.custoAlimentacao,
      custoEstacionamento: input.custoEstacionamento,
      kmInicial: input.kmInicial,
      kmFinal: input.kmFinal,
      acoesVisita: [
        {
          idModulo: atividade.idModulo,
          idTipoAtividade: atividade.idTipoAtividade,
          idContato: atividade.idContato,
          nomeContato: atividade.nomeContato,
          idUsuario: atividade.idUsuario,
          descricao: input.descricaoAtividade,
        },
      ],
    };
    let resp: Response;
    try {
      resp = await fetch(this.url('visita'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(corpo),
      });
    } catch (e) {
      throw new BadGatewayException(
        `Não foi possível enviar a visita ao Portal Rech: ${(e as Error).message}`,
      );
    }
    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '');
      this.logger.warn(
        `Criação de visita no Portal recusada (HTTP ${resp.status}): ${detalhe.slice(0, 300)} ` +
          `| ids: empresa=${idEmpresa}, modulo=${atividade.idModulo}, ` +
          `tipo=${atividade.idTipoAtividade}, contato=${atividade.idContato}, ` +
          `usuario=${atividade.idUsuario}`,
      );
      throw new UnprocessableEntityException(
        `O Portal Rech recusou a visita (HTTP ${resp.status}). ${detalhe.slice(0, 200)}`,
      );
    }
    const criada = (await resp.json()) as { id?: number };
    if (criada?.id == null) {
      throw new BadGatewayException(
        'Portal Rech criou a visita mas não devolveu o id.',
      );
    }
    return criada.id;
  }

  /** Orquestra o fluxo completo: autentica, resolve a empresa e cria o rascunho. Devolve o
   * id da visita para a tela abrir o Portal exatamente nela. */
  async criarRascunhoVisita(
    cred: CredencialPortal,
    input: VisitaPortalInput,
  ): Promise<{ visitaId: number }> {
    const { token, idUsuario } = await this.autenticar(cred);
    const idEmpresa = await this.resolverIdEmpresa(
      token,
      input.clienteCodigo,
      input.clienteNome ?? '',
    );
    // Ids obrigatórios da atividade, resolvidos no Portal (defaults; o consultor ajusta ao
    // conferir): contato da empresa, módulo (pela descrição) e tipo de atividade.
    const { idContato, nomeContato } = await this.resolverContato(
      token,
      idEmpresa,
      input.contatoNome ?? '',
    );
    const idModulo = await this.resolverIdModulo(token, input.modulo ?? '');
    const idTipoAtividade = await this.resolverIdTipoAtividade(token);
    const visitaId = await this.criarVisita(token, idEmpresa, input, {
      idModulo,
      idTipoAtividade,
      idContato,
      nomeContato,
      idUsuario,
    });
    return { visitaId };
  }

  /** `datetime-local` (`YYYY-MM-DDTHH:MM`) → `YYYY-MM-DDTHH:MM:00`. O formato exato aceito
   * pelo Portal se confirma no 1º envio real; se ele exigir outro, é aqui que se ajusta. */
  private dataHora(valor: string): string {
    const v = (valor || '').trim();
    if (!v) return v;
    return /T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
  }

  /** Lista as visitas do Portal DA CREDENCIAL informada (a API escopa por usuário logado),
   * paginando `GET visita` até a última página. Alimenta o painel "Visitas do Portal Rech"
   * do BI — é a fonte da VERDADE do protocolo (`id`) e da aprovação (`statusAprovacao`):
   * o SICLA não carrega nenhum dos dois de forma confiável (VISITAS.PROTOCOLOVIS e
   * LISTA_VISITAS.PROTOCOLOVIS divergem entre si E do Portal — visto em 2026-08-17). */
  async listarVisitas(cred: CredencialPortal): Promise<VisitaPortalListada[]> {
    const { token } = await this.autenticar(cred);
    const TAM = 2000;
    const MAX_PAGINAS = 30;
    const out: VisitaPortalListada[] = [];
    for (let page = 0; page < MAX_PAGINAS; page++) {
      const visitas = this.lista(
        await this.getJson(`visita?size=${TAM}&page=${page}`, token),
      );
      if (visitas.length === 0) break;
      for (const v of visitas) {
        const codigo = Number(v['codigoCliente']);
        out.push({
          id: Number(v['id']),
          codigoCliente:
            v['codigoCliente'] == null || !Number.isFinite(codigo)
              ? null
              : codigo,
          nomeEmpresa: String(v['nomeEmpresa'] ?? ''),
          nomeContato: String(v['nomeContato'] ?? ''),
          nomeUsuario: String(v['nomeUsuario'] ?? ''),
          inicio: this.epochLocal(v['dataInicioVisita']),
          statusAprovacao: String(v['statusAprovacao'] ?? ''),
        });
      }
      if (visitas.length < TAM) break;
    }
    return out;
  }

  /** Epoch em ms → "AAAA-MM-DD HH:MM:SS" no fuso LOCAL do servidor (Brasília). NÃO usar
   * `toISOString` aqui: deslocaria o horário em -3h e mudaria data e turno da visita. */
  private epochLocal(ms: unknown): string {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    const p = (x: number) => String(x).padStart(2, '0');
    return (
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    );
  }
}

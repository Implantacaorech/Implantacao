import { Test, TestingModule } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BiImplantacaoService } from './bi-implantacao.service';
import { DadosService } from '../dados/dados.service';
import { MailerService } from '../email/mailer.service';
import { ModeloEmailService } from '../email/modelo-email.service';
import { EscopoCliente } from '../permissoes/escopo-cliente.service';

/** O BI "Implantação Clientes SIGER" é a única tela que um CLIENTE da Rech enxerga, e o
 * recorte por cliente é a coisa que não pode falhar nela: um cliente ver dado de outro é o
 * pior defeito possível deste módulo (docs/acesso-cliente-bi.md).
 *
 * Este spec falha o CI. Ele não testa "as linhas vieram filtradas" — isso é o fácil. Ele
 * varre a resposta INTEIRA de cada endpoint atrás de qualquer vestígio de outro cliente:
 * as listas de opções dos filtros (que são montadas em cascata sobre o conjunto completo),
 * os rótulos das RNS (que trazem o nome do cliente junto do número), os totais, os
 * agrupamentos e o calendário. Foi exatamente aí que a primeira versão do recorte vazaria.
 */

// Três clientes no mesmo período. O 3180 é o "nosso"; 3729 e 4001 são de terceiros e não
// podem aparecer em lugar nenhum da resposta.
const NOSSO = 3180;
const OUTRO = 3729;
const TERCEIRO = 4001;

const RESUMO = [
  {
    CODIGO: 1001,
    CLIENTE: NOSSO,
    DESCRICAO: 'ACME - Implantação',
    FANTASIA: 'ACME',
    TECNICO: 'Jolemar',
    STATUS_RNS: '1-Não inciado',
    TIPO: 2,
    DATA_CONTRATACAO: '2026-07-28',
    HORASPREVISTAS: 10,
    HORASREALIZADAS: 4,
    HORASALDO: 6,
    GRUPO_ECONOMICO: 'GRUPO ACME',
    ATIVODES: 'Sim',
    TIPODES: 'Cliente',
  },
  {
    CODIGO: 1002,
    CLIENTE: OUTRO,
    DESCRICAO: 'CONCORRENTE - Implantação',
    FANTASIA: 'CONCORRENTE',
    TECNICO: 'Kailan',
    STATUS_RNS: '6-Concluída',
    TIPO: 1,
    DATA_CONTRATACAO: '2026-06-27',
    HORASPREVISTAS: 30,
    HORASREALIZADAS: 30,
    HORASALDO: 0,
    GRUPO_ECONOMICO: 'GRUPO CONCORRENTE',
    ATIVODES: 'Sim',
    TIPODES: 'Cliente',
  },
  {
    CODIGO: 1003,
    CLIENTE: null, // linha sem código identificável — fail-closed
    DESCRICAO: 'ORFA - sem cliente',
    FANTASIA: 'ORFA',
    TECNICO: 'Anonimo',
    STATUS_RNS: '2-Em andamento',
    TIPO: 1,
    DATA_CONTRATACAO: '2026-06-01',
    HORASPREVISTAS: 5,
    HORASREALIZADAS: 1,
    HORASALDO: 4,
    GRUPO_ECONOMICO: 'GRUPO ORFA',
    ATIVODES: 'Sim',
    TIPODES: 'Cliente',
  },
];

const EXTRATO = [
  {
    IMP_COD: 1001,
    IMP_CLIENTE: NOSSO,
    PROTOCOLO: 500001,
    DATA: '2026-07-29',
    HORA: '10:35',
    LIS_SIGLA: 'ACM',
    LIS_TECNICODESCRICAO: 'Jolemar',
    LIS_DESCRICAO: 'Visita',
    SISTEMADESCRICAO: 'SIGER',
    DESCRICAO: 'Atendimento na ACME',
    DESCRICAO_TAMANHO: 20,
    LISHORASUTILIZADAS: -2,
    SALDO_ACUMULADO: 8,
    FANTASIA: 'ACME',
    GRUPO_ECONOMICO: 'GRUPO ACME',
    STATUS_RNS: '1-Não inciado',
    RNS_DESCRICAO: 'ACME - Implantação',
  },
  {
    IMP_COD: 1002,
    IMP_CLIENTE: OUTRO,
    PROTOCOLO: 500002,
    DATA: '2026-07-30',
    HORA: '09:00',
    LIS_SIGLA: 'CON',
    LIS_TECNICODESCRICAO: 'Kailan',
    LIS_DESCRICAO: 'Visita',
    SISTEMADESCRICAO: 'SIGER',
    DESCRICAO: 'Segredo do CONCORRENTE',
    DESCRICAO_TAMANHO: 25,
    LISHORASUTILIZADAS: -3,
    SALDO_ACUMULADO: 27,
    FANTASIA: 'CONCORRENTE',
    GRUPO_ECONOMICO: 'GRUPO CONCORRENTE',
    STATUS_RNS: '6-Concluída',
    RNS_DESCRICAO: 'CONCORRENTE - Implantação',
  },
];

const RNS = [
  {
    CODIGO: 7001,
    PEDIDO: 900,
    ITEM: 1,
    DATA_CRIACAO: '2026-07-01',
    STATUSDES: 'Redigida',
    SIGLA: 'ACM',
    SISDESCRI: 'Faturamento',
    VISAOGERAL: 'Conversão ACME',
    VALIDADOCLI: 1,
    TIPODES: 'Conversão',
    RESNOME: 'Jolemar',
    ANANOME: 'Ana',
    CLIENTE: NOSSO,
    FANTASIA: 'ACME',
    IMP_COD: 1001,
    IMP_DESCRICAO: 'ACME - Implantação',
    STATUS_IMPLANTACAO: '1-Não inciado',
    TECNICO: 'Jolemar',
    GRUPO_ECONOMICO: 'GRUPO ACME',
  },
  {
    CODIGO: 7002,
    PEDIDO: 901,
    ITEM: 1,
    DATA_CRIACAO: '2026-07-02',
    STATUSDES: 'Redigida',
    SIGLA: 'CON',
    SISDESCRI: 'Estoque',
    VISAOGERAL: 'Conversão CONCORRENTE',
    VALIDADOCLI: 0,
    TIPODES: 'Desenvolvimento',
    RESNOME: 'Kailan',
    ANANOME: 'Bruno',
    CLIENTE: OUTRO,
    FANTASIA: 'CONCORRENTE',
    IMP_COD: 1002,
    IMP_DESCRICAO: 'CONCORRENTE - Implantação',
    STATUS_IMPLANTACAO: '6-Concluída',
    TECNICO: 'Kailan',
    GRUPO_ECONOMICO: 'GRUPO CONCORRENTE',
  },
];

const VISITAS = [
  {
    EMPRESA: 'ACME',
    CODIGO_CLIENTE: NOSSO,
    CONTATO: 'Fulano',
    CONSULTOR: 'Jolemar',
    PROTOCOLO: 6001,
    DATA: '2026-07-29',
    HORARIO: '10:35',
    TURNO: 'MANHÃ',
    APROVADO: 'Sim',
  },
  {
    EMPRESA: 'CONCORRENTE',
    CODIGO_CLIENTE: OUTRO,
    CONTATO: 'Beltrano',
    CONSULTOR: 'Kailan',
    PROTOCOLO: 6002,
    DATA: '2026-07-30',
    HORARIO: '09:00',
    TURNO: 'MANHÃ',
    APROVADO: 'Não',
  },
  {
    EMPRESA: 'SEM CODIGO',
    CODIGO_CLIENTE: null,
    CONTATO: 'Ninguem',
    CONSULTOR: 'Ninguem',
    PROTOCOLO: 6003,
    DATA: '2026-07-31',
    HORARIO: '08:00',
    TURNO: 'MANHÃ',
    APROVADO: 'Não',
  },
];

/** Tudo o que só pode existir na resposta de um usuário do cliente 3180. Se qualquer um
 * destes textos aparecer em qualquer canto do JSON, houve vazamento. */
const VESTIGIOS_DE_TERCEIROS = [
  'CONCORRENTE',
  'GRUPO CONCORRENTE',
  'Kailan',
  'Segredo do CONCORRENTE',
  'ORFA',
  'GRUPO ORFA',
  'SEM CODIGO',
  String(OUTRO),
  String(TERCEIRO),
];

/** Procura os vestígios no JSON inteiro da resposta — não só em `linhas`. */
function vestigiosEm(resposta: unknown): string[] {
  const json = JSON.stringify(resposta);
  return VESTIGIOS_DE_TERCEIROS.filter((v) => json.includes(v));
}

describe('conformidade — recorte por cliente no BI Implantação Clientes SIGER', () => {
  let service: BiImplantacaoService;
  const consultaSicla = jest.fn();
  const consultaPortal = jest.fn();
  const dados = {
    consultar: jest.fn((nome: string, params?: unknown) =>
      nome.startsWith('portal.')
        ? consultaPortal(nome, params)
        : consultaSicla(nome, params),
    ),
  };

  const CLIENTE: EscopoCliente = { interno: false, codigos: [String(NOSSO)] };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        BiImplantacaoService,
        { provide: DadosService, useValue: dados },
        { provide: MailerService, useValue: { enviar: jest.fn() } },
        { provide: ModeloEmailService, useValue: { porSlug: jest.fn() } },
      ],
    }).compile();
    service = modulo.get(BiImplantacaoService);

    consultaSicla.mockImplementation((nome: string) => {
      const linhas =
        nome === 'sicla.bi.resumo-implantacao'
          ? RESUMO
          : nome === 'sicla.bi.extrato-horas'
            ? EXTRATO
            : nome === 'sicla.bi.rns-vinculadas'
              ? RNS
              : [];
      return Promise.resolve({
        ok: true,
        mensagem: `${linhas.length} linha(s).`,
        colunas: [],
        linhas,
      });
    });
    consultaPortal.mockResolvedValue({
      ok: true,
      mensagem: '3 linha(s).',
      colunas: [],
      linhas: VISITAS,
    });
  });

  const periodo = { dataIni: '2026-06-01', dataFim: '2026-08-31' };

  describe('nenhum vestígio de outro cliente na resposta INTEIRA', () => {
    it('resumo', async () => {
      const r = await service.resumo(periodo, CLIENTE);
      expect(r.linhas.map((l) => l.cliente)).toEqual([NOSSO]);
      expect(vestigiosEm(r)).toEqual([]);
    });

    it('extrato', async () => {
      const r = await service.extrato(periodo, CLIENTE);
      expect(r.linhas.map((l) => l.cliente)).toEqual([NOSSO]);
      expect(vestigiosEm(r)).toEqual([]);
    });

    it('rns vinculadas', async () => {
      const r = await service.rnsVinculadas(periodo, CLIENTE);
      expect(r.linhas.map((l) => l.cliente)).toEqual([NOSSO]);
      expect(vestigiosEm(r)).toEqual([]);
    });

    it('visitas do Portal', async () => {
      const r = await service.visitasPortal(periodo, CLIENTE);
      expect(r.linhas.map((l) => l.cliente)).toEqual([NOSSO]);
      expect(vestigiosEm(r)).toEqual([]);
    });
  });

  // O ponto que uma implementação apressada erra: as listas de opções são montadas em
  // CASCATA sobre o conjunto completo, e `opcoesRns` rotula cada RNS com o nome do cliente.
  // Filtrar só `linhas` deixaria a carteira inteira da Rech visível no dropdown.
  describe('as listas de FILTRO também são recortadas', () => {
    it('extrato: clientes, grupos e técnicos só do próprio cliente', async () => {
      const r = await service.extrato(periodo, CLIENTE);
      expect(r.filtros.clientes).toEqual(['ACME']);
      expect(r.filtros.grupos).toEqual(['GRUPO ACME']);
      expect(r.filtros.tecnicos).toEqual(['Jolemar']);
      expect(r.filtros.rns.map((o) => o.codigo)).toEqual(['1001']);
    });

    it('resumo: nenhuma opção de terceiro', async () => {
      const r = await service.resumo(periodo, CLIENTE);
      expect(r.filtros.grupos).toEqual(['GRUPO ACME']);
      expect(r.filtros.tecnicos).toEqual(['Jolemar']);
    });

    it('rns: siglas e status só do próprio cliente', async () => {
      const r = await service.rnsVinculadas(periodo, CLIENTE);
      expect(r.filtros.siglas).toEqual(['ACM']);
      expect(r.filtros.tecnicos).toEqual(['Jolemar']);
    });
  });

  describe('totais e agrupamentos saem do conjunto recortado', () => {
    it('resumo soma só as horas do próprio cliente', async () => {
      const r = await service.resumo(periodo, CLIENTE);
      expect(r.totais.horasPrevistas).toBe(10);
      expect(r.totais.horasRealizadas).toBe(4);
      expect(r.porTecnico.map((t) => t.chave)).toEqual(['Jolemar']);
    });

    it('extrato soma só as horas do próprio cliente', async () => {
      const r = await service.extrato(periodo, CLIENTE);
      expect(r.totais.horasUtilizadas).toBe(2);
    });
  });

  // Linha cujo código de cliente veio nulo não é "de todo mundo": não é de ninguém. Uma das
  // origens é SQL EDITÁVEL pela tela (Sistema → Consultas BD) — se alguém derrubar a coluna
  // do código, a tela do cliente tem que esvaziar, não virar um dump.
  describe('fail-closed: linha sem código de cliente', () => {
    it('some para o cliente', async () => {
      const r = await service.resumo(periodo, CLIENTE);
      expect(r.linhas.map((l) => l.codigo)).not.toContain(1003);
    });

    it('continua visível para o usuário interno', async () => {
      const r = await service.resumo(periodo, { interno: true });
      expect(r.linhas.map((l) => l.codigo)).toContain(1003);
    });
  });

  describe('o usuário interno continua vendo tudo', () => {
    it('resumo devolve as três linhas', async () => {
      const r = await service.resumo(periodo, { interno: true });
      expect(r.linhas).toHaveLength(3);
      expect(r.filtros.grupos).toContain('GRUPO CONCORRENTE');
    });
  });

  // A descrição da visita é texto livre escrito pelo consultor, e a chave (protocolo +
  // data/hora) é adivinhável. Sem conferência de posse, variar o número entregava a visita
  // de qualquer cliente.
  describe('descrição completa de um lançamento', () => {
    const descricaoDe = (cliente: number | null) => {
      consultaSicla.mockResolvedValue({
        ok: true,
        mensagem: '1 linha(s).',
        colunas: [],
        linhas: [
          {
            DESCRICAO: 'Segredo do CONCORRENTE',
            DESCRICAO_TAMANHO: 25,
            IMP_CLIENTE: cliente,
          },
        ],
      });
    };

    it('recusa o lançamento de outro cliente', async () => {
      descricaoDe(OUTRO);
      const r = await service.descricaoCompleta(
        500002,
        '2026-07-30 09:00',
        CLIENTE,
      );
      expect(r.descricao).toBe('');
      // Mesma mensagem do inexistente: distinguir "não é seu" de "não existe" faria do
      // endpoint um detector de protocolos válidos.
      expect(r.erro).toBe('Lançamento não encontrado.');
    });

    it('recusa o lançamento sem cliente identificado', async () => {
      descricaoDe(null);
      const r = await service.descricaoCompleta(
        500003,
        '2026-07-31 08:00',
        CLIENTE,
      );
      expect(r.descricao).toBe('');
    });

    it('entrega o lançamento do próprio cliente', async () => {
      descricaoDe(NOSSO);
      const r = await service.descricaoCompleta(
        500001,
        '2026-07-29 10:35',
        CLIENTE,
      );
      expect(r.descricao).toBe('Segredo do CONCORRENTE'); // conteúdo do mock; o que importa é ter passado
      expect(r.erro).toBeNull();
    });

    it('interno continua vendo qualquer lançamento', async () => {
      descricaoDe(OUTRO);
      const r = await service.descricaoCompleta(500002, '2026-07-30 09:00', {
        interno: true,
      });
      expect(r.erro).toBeNull();
    });
  });

  // Envio é ferramenta interna: as linhas do PDF vêm do corpo do pedido e o destinatário é
  // livre — para um usuário externo isso seria um relay de e-mail com o domínio da Rech.
  describe('e-mail é só para usuário interno', () => {
    it('recusa o envio para usuário-cliente', async () => {
      await expect(
        service.enviarVisitasPorEmail(
          { para: 'qualquer@fora.com', assunto: 'a', corpo: 'b', linhas: [] },
          CLIENTE,
        ),
      ).rejects.toThrow(/interna da Rech/);
    });

    it('recusa o modelo de e-mail para usuário-cliente', async () => {
      await expect(service.modeloEmailVisitas(CLIENTE)).rejects.toThrow(
        /interna da Rech/,
      );
    });
  });

  /** Guarda estrutural: todo handler do controller precisa RESOLVER o escopo e repassá-lo.
   *
   * Os testes acima provam que o recorte funciona quando o escopo chega ao serviço. Este
   * prova que ele chega — um endpoint novo que esqueça de resolver o escopo passaria por
   * todos os outros testes e vazaria em produção. */
  describe('o controller resolve o escopo em TODOS os handlers', () => {
    const fonte = readFileSync(
      join(__dirname, 'bi-implantacao.controller.ts'),
      'utf8',
    );

    it('cada rota chama escopoDe e repassa o resultado', () => {
      const rotas = fonte.match(/@(Get|Post|Put|Patch|Delete)\(/g) ?? [];
      const resolucoes = fonte.match(/this\.escopos\.escopoDe\(/g) ?? [];
      expect(rotas.length).toBeGreaterThan(0);
      expect(resolucoes).toHaveLength(rotas.length);
    });

    it('nenhuma chamada ao serviço fica sem escopo', () => {
      // Toda chamada `this.bi.<metodo>(...)` tem que citar `escopo` entre os argumentos.
      const chamadas = fonte.match(/this\.bi\.\w+\([^;]*?\)/gs) ?? [];
      expect(chamadas.length).toBeGreaterThan(0);
      const semEscopo = chamadas.filter((c) => !c.includes('escopo'));
      expect(semEscopo).toEqual([]);
    });
  });
});

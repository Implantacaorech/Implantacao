import {
  BadGatewayException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PortalRechService, VisitaPortalInput } from './portal-rech.service';

/** Monta um objeto parecido com `Response` para o fetch mockado. */
function resp(opts: {
  status?: number;
  headers?: Record<string, string>;
  json?: unknown;
  text?: string;
}): Response {
  const status = opts.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => opts.headers?.[h] ?? null },
    json: () => Promise.resolve(opts.json),
    text: () => Promise.resolve(opts.text ?? ''),
  } as unknown as Response;
}

const TOKEN = 'Bearer abc.def';
const cred = { login: 'consultor', senha: 'x' };
const input: VisitaPortalInput = {
  clienteCodigo: '5001',
  dataInicioVisita: '2026-08-10T14:00',
  dataFimVisita: '2026-08-10T15:00',
  dataInicioDeslocamento: '2026-08-10T13:00',
  dataFimDeslocamento: '2026-08-10T16:00',
  custoPedagio: 0,
  custoEstadia: 0,
  custoAlimentacao: 0,
  custoEstacionamento: 0,
  kmInicial: null,
  kmFinal: null,
  descricaoAtividade: '- PARTICIPANTES:\nIvian',
};

describe('PortalRechService', () => {
  let svc: PortalRechService;
  let fetchMock: jest.Mock;

  beforeAll(() => {
    process.env.PORTAL_RECH_BASE = 'https://portal.test/api/';
  });

  beforeEach(() => {
    svc = new PortalRechService();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  describe('autenticar', () => {
    it('devolve o token do cabeçalho e o idUsuario do corpo no login 200', async () => {
      fetchMock.mockResolvedValueOnce(
        resp({
          headers: { 'Rech-Portal-Token-Autenticacao': TOKEN },
          json: { id: 555 },
        }),
      );
      await expect(svc.autenticar(cred)).resolves.toEqual({
        token: TOKEN,
        idUsuario: 555,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://portal.test/api/login');
      expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
        email: 'consultor',
        senha: 'x',
        mantemLogado: false,
      });
    });

    it('401 vira UnauthorizedException', async () => {
      fetchMock.mockResolvedValueOnce(resp({ status: 401 }));
      await expect(svc.autenticar(cred)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('200 sem o cabeçalho do token falha como BadGateway', async () => {
      fetchMock.mockResolvedValueOnce(resp({}));
      await expect(svc.autenticar(cred)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });

  describe('listarVisitas', () => {
    const loginOk = () =>
      resp({
        headers: { 'Rech-Portal-Token-Autenticacao': TOKEN },
        json: { id: 70 },
      });

    it('autentica, pagina e normaliza (epoch ms → data/hora LOCAL)', async () => {
      // 2026-08-06 08:30:00 no fuso de Brasília (o servidor roda em BRT) — montado a
      // partir do horário LOCAL para o teste não depender do fuso da máquina.
      const inicioMs = new Date(2026, 7, 6, 8, 30, 0).getTime();
      fetchMock.mockResolvedValueOnce(loginOk()).mockResolvedValueOnce(
        resp({
          json: {
            content: [
              {
                id: 135089,
                codigoCliente: 3631,
                nomeEmpresa: 'MELBROS CALCADOS',
                nomeContato: 'Ernani Martini',
                nomeUsuario: 'Everton',
                dataInicioVisita: inicioMs,
                statusAprovacao: 'APROVADO',
              },
              {
                id: 135090,
                codigoCliente: null,
                dataInicioVisita: null,
                statusAprovacao: 'PENDENTE',
              },
            ],
          },
        }),
      );
      const visitas = await svc.listarVisitas(cred);
      expect(visitas).toEqual([
        {
          id: 135089,
          codigoCliente: 3631,
          nomeEmpresa: 'MELBROS CALCADOS',
          nomeContato: 'Ernani Martini',
          nomeUsuario: 'Everton',
          inicio: '2026-08-06 08:30:00',
          statusAprovacao: 'APROVADO',
        },
        {
          id: 135090,
          codigoCliente: null,
          nomeEmpresa: '',
          nomeContato: '',
          nomeUsuario: '',
          inicio: '',
          statusAprovacao: 'PENDENTE',
        },
      ]);
      const [urlVisitas, init] = fetchMock.mock.calls[1];
      expect(urlVisitas).toBe(
        'https://portal.test/api/visita?size=2000&page=0',
      );
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: TOKEN,
      });
    });

    it('percorre as páginas até a última (página cheia → pede a próxima)', async () => {
      const cheia = Array.from({ length: 2000 }, (_, i) => ({ id: i + 1 }));
      fetchMock
        .mockResolvedValueOnce(loginOk())
        .mockResolvedValueOnce(resp({ json: { content: cheia } }))
        .mockResolvedValueOnce(resp({ json: { content: [{ id: 9999 }] } }));
      const visitas = await svc.listarVisitas(cred);
      expect(visitas).toHaveLength(2001);
      expect(fetchMock.mock.calls[2][0]).toBe(
        'https://portal.test/api/visita?size=2000&page=1',
      );
    });

    it('GET recusado vira BadGateway (com a rota no erro)', async () => {
      fetchMock
        .mockResolvedValueOnce(loginOk())
        .mockResolvedValueOnce(resp({ status: 500 }));
      await expect(svc.listarVisitas(cred)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });

  describe('resolverIdEmpresa', () => {
    it('casa por codigoCliente numa página Spring (content)', async () => {
      fetchMock.mockResolvedValueOnce(
        resp({
          json: {
            content: [
              { id: 10, codigoCliente: 4000 },
              { id: 99, codigoCliente: 5001 },
            ],
          },
        }),
      );
      await expect(svc.resolverIdEmpresa(TOKEN, '5001')).resolves.toBe(99);
    });

    it('casa por codigoCliente num array puro', async () => {
      fetchMock.mockResolvedValueOnce(
        resp({ json: [{ id: 77, codigoCliente: 5001 }] }),
      );
      await expect(svc.resolverIdEmpresa(TOKEN, '5001')).resolves.toBe(77);
    });

    it('pagina até achar quando a 1ª página (cheia) não tem o alvo', async () => {
      const pagCheia = {
        content: Array.from({ length: 2000 }, (_, i) => ({
          id: i + 1,
          codigoCliente: 1000 + i,
        })),
      };
      const pag2 = { content: [{ id: 9999, codigoCliente: 16897 }] };
      fetchMock
        .mockResolvedValueOnce(resp({ json: pagCheia }))
        .mockResolvedValueOnce(resp({ json: pag2 }));
      await expect(svc.resolverIdEmpresa(TOKEN, '16897')).resolves.toBe(9999);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('cai para o nome quando o código não bate', async () => {
      fetchMock.mockResolvedValueOnce(
        resp({
          json: {
            content: [
              { id: 5, codigoCliente: 111, razaoSocial: 'Outra Ltda' },
              { id: 88, codigoCliente: 222, nomeFantasia: 'ACME' },
            ],
          },
        }),
      );
      // código 5001 não existe; casa por nomeFantasia 'ACME'
      await expect(svc.resolverIdEmpresa(TOKEN, '5001', 'acme')).resolves.toBe(
        88,
      );
    });

    it('cliente inexistente (nem código nem nome) vira UnprocessableEntity', async () => {
      fetchMock.mockResolvedValueOnce(resp({ json: { content: [] } }));
      await expect(
        svc.resolverIdEmpresa(TOKEN, '5001', 'ACME'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('criarVisita', () => {
    const atividade = {
      idModulo: 3,
      idTipoAtividade: 1,
      idContato: 7,
      nomeContato: 'Iloni',
      idUsuario: 555,
    };

    it('envia acoesVisita no campo `descricao` (não descricaoAtividade) e devolve o id', async () => {
      fetchMock.mockResolvedValueOnce(resp({ json: { id: 321 } }));
      const id = await svc.criarVisita(TOKEN, 99, input, atividade);
      expect(id).toBe(321);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://portal.test/api/visita');
      const corpo = JSON.parse((init as RequestInit).body as string);
      expect(corpo.idEmpresa).toBe(99);
      // Visita exige idUsuario + idContato no TOPO (não só na atividade).
      expect(corpo.idUsuario).toBe(555);
      expect(corpo.idContato).toBe(7);
      expect(corpo.dataInicioVisita).toBe('2026-08-10T14:00:00'); // segundos acrescentados
      expect(corpo.acoesVisita).toHaveLength(1);
      const ativ = corpo.acoesVisita[0];
      expect(ativ.descricao).toContain('PARTICIPANTES');
      expect(ativ.descricaoAtividade).toBeUndefined();
      expect(ativ.idModulo).toBe(3);
      expect(ativ.idContato).toBe(7);
      expect(ativ.nomeContato).toBe('Iloni');
      expect(ativ.idUsuario).toBe(555);
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: TOKEN,
      });
    });

    it('recusa do Portal vira UnprocessableEntity', async () => {
      fetchMock.mockResolvedValueOnce(
        resp({ status: 400, text: 'campo X inválido' }),
      );
      await expect(
        svc.criarVisita(TOKEN, 99, input, atividade),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('resolverContato', () => {
    it('casa o contato pelo nome; senão pega o primeiro', async () => {
      fetchMock.mockResolvedValueOnce(
        resp({
          json: {
            content: [
              { id: 5, nome: 'João', status: 'A' },
              { id: 7, nome: 'Iloni Souza', status: 'A' },
            ],
          },
        }),
      );
      await expect(
        (
          svc as unknown as {
            resolverContato: (
              t: string,
              e: number,
              n: string,
            ) => Promise<unknown>;
          }
        ).resolverContato(TOKEN, 99, 'iloni'),
      ).resolves.toEqual({ idContato: 7, nomeContato: 'Iloni Souza' });
    });

    it('empresa sem contato vira UnprocessableEntity', async () => {
      fetchMock.mockResolvedValueOnce(resp({ json: { content: [] } }));
      await expect(
        (
          svc as unknown as {
            resolverContato: (
              t: string,
              e: number,
              n: string,
            ) => Promise<unknown>;
          }
        ).resolverContato(TOKEN, 99, ''),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('criarRascunhoVisita (orquestração)', () => {
    it('autentica, resolve empresa/contato/módulo/tipo e cria — devolve o visitaId', async () => {
      fetchMock
        .mockResolvedValueOnce(
          resp({
            headers: { 'Rech-Portal-Token-Autenticacao': TOKEN },
            json: { id: 555 },
          }),
        )
        .mockResolvedValueOnce(
          resp({ json: { content: [{ id: 99, codigoCliente: 5001 }] } }),
        )
        .mockResolvedValueOnce(
          resp({ json: { content: [{ id: 7, nome: 'Iloni', status: 'A' }] } }),
        )
        .mockResolvedValueOnce(
          resp({ json: { content: [{ id: 3, descricao: 'Fiscal' }] } }),
        )
        .mockResolvedValueOnce(
          resp({ json: { content: [{ id: 1, status: 'A', codigo: 1 }] } }),
        )
        .mockResolvedValueOnce(resp({ json: { id: 321 } }));
      await expect(svc.criarRascunhoVisita(cred, input)).resolves.toEqual({
        visitaId: 321,
      });
      expect(fetchMock).toHaveBeenCalledTimes(6);
    });
  });
});

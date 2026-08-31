import { BadRequestException } from '@nestjs/common';
import { CatalogoService } from './catalogo/catalogo.service';
import { ConexoesService } from './conexoes/conexoes.service';
import { ConsultaBdService } from './consulta-bd.service';
import {
  ConsultasPublicadasService,
  SalvarConsultaPublicada,
  TETO_MAXIMO_DE_TELA,
} from './consultas-publicadas.service';

const SQL_OK = 'SELECT A, B FROM T WHERE D >= :data_ini';

function base(
  over: Partial<SalvarConsultaPublicada> = {},
): SalvarConsultaPublicada {
  return {
    slug: 'minha_consulta',
    nome: 'Minha consulta',
    conexao: 'sicla',
    sql: SQL_OK,
    nomeApi: 'sicla.minha.consulta',
    parametros: [
      {
        nome: 'data_ini',
        tipo: 'data',
        obrigatorio: true,
        descricao: 'início',
      },
    ],
    colunas: ['A', 'B'],
    limiteLinhas: 500,
    cacheSegundos: 0,
    publicada: true,
    ...over,
  };
}

function montar(
  resultado = {
    ok: true,
    mensagem: 'ok',
    colunas: ['A', 'B'],
    linhas: [{ A: 1 }],
  },
) {
  const salvar = jest
    .fn()
    .mockImplementation((slug: string) => Promise.resolve({ slug }));
  const excluir = jest.fn().mockResolvedValue(true);
  const executar = jest.fn().mockResolvedValue(resultado);
  const invalidar = jest.fn();

  const servico = new ConsultasPublicadasService(
    { salvar, excluir } as unknown as ConsultaBdService,
    { executar } as unknown as ConexoesService,
    { invalidar } as unknown as CatalogoService,
  );
  return { servico, salvar, excluir, executar, invalidar };
}

/** Quando a consulta nasce na TELA, ela não passa por PR nem por CI. Este serviço é o que
 * fica no lugar dessas duas coisas — e por isso o que ele RECUSA importa mais do que o que
 * ele aceita. */
describe('ConsultasPublicadasService', () => {
  describe('analisar (o "Testar" da tela)', () => {
    it('devolve os binds do SQL e as colunas que o banco respondeu', async () => {
      const { servico, executar } = montar();
      const r = await servico.analisar('sicla', SQL_OK, {
        data_ini: '2026-08-01',
      });

      expect(r.ok).toBe(true);
      expect(r.binds).toEqual(['data_ini']);
      expect(r.colunas).toEqual(['A', 'B']);
      expect(r.amostra).toEqual({ A: 1 });
      // Limite 1: descobrir o formato não pode custar uma varredura.
      expect(executar).toHaveBeenCalledWith(
        'sicla',
        SQL_OK,
        { data_ini: '2026-08-01' },
        1,
      );
    });

    it('recusa escrita sem tocar no banco', async () => {
      const { servico, executar } = montar();
      const r = await servico.analisar('sicla', 'DELETE FROM T');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('SELECT');
      expect(executar).not.toHaveBeenCalled();
    });

    it('bind sem exemplo vira texto vazio — o teste roda mesmo assim', async () => {
      const { servico, executar } = montar();
      await servico.analisar('sicla', SQL_OK);
      expect(executar.mock.calls[0][2]).toEqual({ data_ini: '' });
    });

    it('parâmetro de LISTA vira (NULL) no teste, como no executor', async () => {
      const { servico, executar } = montar();
      await servico.analisar(
        'sicla',
        'SELECT A FROM T WHERE X IN :tecnicos AND D = :data_ini',
        { tecnicos: [], data_ini: '2026-08-01' },
      );
      expect(executar.mock.calls[0][1]).toContain('(NULL)');
      expect(executar.mock.calls[0][2]).toEqual({ data_ini: '2026-08-01' });
    });

    it('erro do banco volta como mensagem, com os binds já detectados', async () => {
      const { servico } = montar({
        ok: false,
        mensagem: 'ORA-00942: tabela ou view não existe',
        colunas: [],
        linhas: [],
      });
      const r = await servico.analisar('sicla', SQL_OK, {});
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('ORA-00942');
      expect(r.binds).toEqual(['data_ini']);
    });
  });

  describe('salvar — as checagens que o CI faria', () => {
    it('grava e invalida o catálogo no caminho feliz', async () => {
      const { servico, salvar, invalidar } = montar();
      await servico.salvar(base());

      expect(invalidar).toHaveBeenCalled();
      const [slug, dados] = salvar.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(slug).toBe('minha_consulta');
      expect(dados).toMatchObject({
        nomeApi: 'sicla.minha.consulta',
        publicada: true,
        limiteLinhas: 500,
        // O vocabulário da TELA é `sicla`/`portal`; o do catálogo é `portal_rech`.
        conexao: 'sicla',
      });
      expect(JSON.parse(dados.colunas as string)).toEqual(['A', 'B']);
    });

    it('traduz portal_rech para o vocabulário da tela ao gravar', async () => {
      const { servico, salvar } = montar();
      await servico.salvar(base({ conexao: 'portal_rech' }));
      expect((salvar.mock.calls[0][1] as { conexao: string }).conexao).toBe(
        'portal',
      );
    });

    it('recusa SQL de escrita', async () => {
      const { servico, salvar } = montar();
      await expect(
        servico.salvar(base({ sql: 'DELETE FROM T' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(salvar).not.toHaveBeenCalled();
    });

    it('recusa nome público fora do padrão <origem>.<assunto>.<ação>', async () => {
      const { servico } = montar();
      for (const nomeApi of ['minhaConsulta', 'sicla.rns', 'SICLA.RNS.X', '']) {
        await expect(servico.salvar(base({ nomeApi }))).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
    });

    it('não deixa a tela sequestrar um nome do catálogo de CÓDIGO', async () => {
      // O contrato revisado é soberano: uma consulta de tela não pode substituí-lo.
      const { servico } = montar();
      await expect(
        servico.salvar(base({ nomeApi: 'sicla.rns.listar' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('exige teto de linhas, e dentro do limite da tela', async () => {
      const { servico } = montar();
      await expect(
        servico.salvar(base({ limiteLinhas: 0 })),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        servico.salvar(base({ limiteLinhas: TETO_MAXIMO_DE_TELA + 1 })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa parâmetro faltando — o SQL usa um bind que ninguém declarou', async () => {
      const { servico } = montar();
      await expect(
        servico.salvar(base({ parametros: [] })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa parâmetro sobrando — declarado, mas o SQL não usa', async () => {
      const { servico } = montar();
      await expect(
        servico.salvar(
          base({
            parametros: [
              ...base().parametros,
              { nome: 'inventado', tipo: 'texto', obrigatorio: false },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa tipo de parâmetro inválido', async () => {
      const { servico } = montar();
      await expect(
        servico.salvar(
          base({
            parametros: [
              {
                nome: 'data_ini',
                tipo: 'moeda' as never,
                obrigatorio: true,
              },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('NÃO publicada dispensa as regras de contrato — é só um rascunho', async () => {
      // Sem publicar, a consulta não entra no catálogo nem é autorizável num token: serve
      // aos Dashboards, como sempre serviu. Exigir contrato aqui quebraria as 8 existentes.
      const { servico, salvar } = montar();
      await servico.salvar(
        base({
          publicada: false,
          nomeApi: '',
          limiteLinhas: 0,
          parametros: [],
        }),
      );
      expect(salvar).toHaveBeenCalled();
    });

    it('excluir invalida o catálogo', async () => {
      const { servico, invalidar } = montar();
      await servico.excluir('minha_consulta');
      expect(invalidar).toHaveBeenCalled();
    });
  });
});

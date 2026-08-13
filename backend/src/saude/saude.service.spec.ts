import { Test, TestingModule } from '@nestjs/testing';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { DocserviceSaudeRepository } from './repositories/docservice-saude.repository';
import { OperacaoArquivosRepository } from './repositories/operacao-arquivos.repository';
import { SaudeBancoRepository } from './repositories/saude-banco.repository';
import { ItemSaude, SaudeService } from './saude.service';
import { contador5xx } from '../common/observabilidade/contador-5xx';
import {
  heartbeatRobos,
  ROBO_DIGEST,
} from '../common/observabilidade/heartbeat-robos';

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('SaudeService', () => {
  let service: SaudeService;

  const arquivos = {
    pasta: jest.fn().mockReturnValue('C:\\PainelBackups'),
    ultimoBackup: jest.fn(),
    errosDeBackup: jest.fn(),
    reiniciosDoGuardiao: jest.fn(),
  };
  const banco = {
    conexaoResponde: jest.fn(),
    emailsQueFalharam: jest.fn(),
    protocolosEmProcessamento: jest.fn(),
  };
  const docservice = { responde: jest.fn() };
  const transcricao = { status: jest.fn() };

  /** Estado "tudo certo" — cada teste estraga só o que quer observar. */
  function tudoOk(): void {
    arquivos.ultimoBackup.mockReturnValue({
      nome: 'painel_novo_mariadb_20260811_220000.zip',
      bytes: 1_039_682,
      modificadoEm: new Date(Date.now() - 2 * H),
    });
    arquivos.errosDeBackup.mockReturnValue([]);
    arquivos.reiniciosDoGuardiao.mockReturnValue([]);
    banco.conexaoResponde.mockResolvedValue({
      ok: true,
      dialeto: 'mariadb',
      erro: '',
    });
    banco.emailsQueFalharam.mockResolvedValue({ total: 0, ultimoErro: '' });
    banco.protocolosEmProcessamento.mockResolvedValue([]);
    docservice.responde.mockResolvedValue({
      ok: true,
      detalhe: 'respondeu ok',
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    contador5xx._resetar();
    heartbeatRobos._resetar();
    tudoOk();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaudeService,
        { provide: OperacaoArquivosRepository, useValue: arquivos },
        { provide: SaudeBancoRepository, useValue: banco },
        { provide: DocserviceSaudeRepository, useValue: docservice },
        { provide: TranscricaoService, useValue: transcricao },
      ],
    }).compile();
    service = module.get(SaudeService);
  });

  async function item(chave: string): Promise<ItemSaude> {
    const r = await service.diagnostico();
    const achado = r.itens.find((i) => i.chave === chave);
    if (!achado) throw new Error(`item "${chave}" não veio no diagnóstico`);
    return achado;
  }

  it('com tudo no lugar, o nível geral é ok e nada entra em "problemas"', async () => {
    const r = await service.diagnostico();
    expect(r.nivel).toBe('ok');
    expect(r.itens.map((i) => i.chave).sort()).toEqual([
      'backup',
      'banco',
      'docservice',
      'email',
      'erros_5xx',
      'guardiao',
      'transcricao',
    ]);
    expect(await service.problemas()).toEqual([]);
  });

  describe('robôs de fundo (M6)', () => {
    it('robô desligado por configuração é ok, não vira problema', async () => {
      heartbeatRobos.registrar(ROBO_DIGEST, 'Robô X', false, null);
      const i = await item('robo_digest');
      expect(i.nivel).toBe('ok');
      expect(i.mensagem).toContain('Desligado');
    });

    it('robô ativo recém-subido (sem bater) espera o 1º ciclo sem alarmar', async () => {
      // Cadência grande: o uptime do processo de teste está muito abaixo da folga (3×30min).
      heartbeatRobos.registrar(ROBO_DIGEST, 'Robô X', true, 30 * MIN);
      const i = await item('robo_digest');
      expect(i.nivel).toBe('ok');
      expect(i.mensagem).toContain('aguardando');
    });

    it('robô ativo que já devia ter rodado e nunca bateu vira aviso', async () => {
      // Cadência mínima: a folga (3ms) já passou desde o boot, então a ausência é real.
      heartbeatRobos.registrar(ROBO_DIGEST, 'Robô X', true, 1);
      const i = await item('robo_digest');
      expect(i.nivel).toBe('aviso');
      expect(i.mensagem).toContain('não rodou');
    });

    it('robô que bateu agora está ok', async () => {
      heartbeatRobos.registrar(ROBO_DIGEST, 'Robô X', true, 30 * MIN);
      heartbeatRobos.bater(ROBO_DIGEST);
      const i = await item('robo_digest');
      expect(i.nivel).toBe('ok');
      expect(i.mensagem).toContain('Rodando');
    });

    it('robô cujo último ciclo falhou vira aviso com o detalhe', async () => {
      heartbeatRobos.registrar(ROBO_DIGEST, 'Robô X', true, 30 * MIN);
      heartbeatRobos.bater(ROBO_DIGEST, 'erro', 'IMAP recusou a senha');
      const i = await item('robo_digest');
      expect(i.nivel).toBe('aviso');
      expect(i.detalhe).toContain('IMAP recusou');
    });
  });

  describe('erros 5xx', () => {
    it('sem erros -> ok', async () => {
      expect((await item('erros_5xx')).nivel).toBe('ok');
    });

    it('alguns erros -> aviso, com o último no detalhe', async () => {
      contador5xx.registrar(500, '/api/x');
      contador5xx.registrar(503, '/api/y');
      const i = await item('erros_5xx');
      expect(i.nivel).toBe('aviso');
      expect(i.mensagem).toContain('2');
      expect(i.detalhe).toContain('/api/y');
    });

    it('surto (>=25) -> crítico', async () => {
      for (let n = 0; n < 25; n++) contador5xx.registrar(500, '/api/z');
      expect((await item('erros_5xx')).nivel).toBe('critico');
    });
  });

  describe('backup', () => {
    it('sem nenhum zip -> crítico, dizendo onde procurar', async () => {
      arquivos.ultimoBackup.mockReturnValue(null);
      const i = await item('backup');
      expect(i.nivel).toBe('critico');
      expect(i.mensagem).toContain('Nenhum backup');
      expect(i.detalhe).toContain('C:\\PainelBackups');
    });

    /** O caso de 27–29/07/2026: o `docker exec` falhava, o `Out-File` gravava vazio e o
     * script logava "ok" — zips de 176 bytes por três dias. Idade não denunciava nada;
     * tamanho sim. */
    it('zip recente mas VAZIO -> crítico', async () => {
      arquivos.ultimoBackup.mockReturnValue({
        nome: 'painel_novo_mariadb_20260811_220000.zip',
        bytes: 176,
        modificadoEm: new Date(Date.now() - 1 * H),
      });
      const i = await item('backup');
      expect(i.nivel).toBe('critico');
      expect(i.mensagem).toContain('vazio');
    });

    it('backup velho -> crítico com a idade em horas', async () => {
      arquivos.ultimoBackup.mockReturnValue({
        nome: 'painel_novo_mariadb_20260805_220000.zip',
        bytes: 1_000_000,
        modificadoEm: new Date(Date.now() - 72 * H),
      });
      const i = await item('backup');
      expect(i.nivel).toBe('critico');
      expect(i.mensagem).toContain('72 h');
    });

    /** 48 h e não 24 h de propósito: a tarefa roda às 22:00 e a máquina às vezes está
     * desligada. Reclamar de UMA noite perdida vira ruído diário — e ruído diário é o que
     * faz alarme ser ignorado. */
    it('uma noite sem backup ainda é ok (a tarefa é noturna e a máquina pode estar desligada)', async () => {
      arquivos.ultimoBackup.mockReturnValue({
        nome: 'painel_novo_mariadb_20260810_220000.zip',
        bytes: 1_000_000,
        modificadoEm: new Date(Date.now() - 30 * H),
      });
      expect((await item('backup')).nivel).toBe('ok');
    });

    it('backup em dia + erro no log -> aviso (alguma execução falhou)', async () => {
      arquivos.errosDeBackup.mockReturnValue([
        '2026-08-11 22:00:03 ERRO -> Access denied for user',
      ]);
      const i = await item('backup');
      expect(i.nivel).toBe('aviso');
      expect(i.detalhe).toContain('Access denied');
    });
  });

  describe('guardião', () => {
    it('sem reinício -> ok', async () => {
      expect((await item('guardiao')).nivel).toBe('ok');
    });

    it('um reinício isolado -> aviso', async () => {
      arquivos.reiniciosDoGuardiao.mockReturnValue([
        {
          quando: new Date(),
          mensagem: 'Painel novo fora do ar; reiniciando.',
        },
      ]);
      const i = await item('guardiao');
      expect(i.nivel).toBe('aviso');
      expect(i.detalhe).toContain('fora do ar');
    });

    /** 22/07/2026: o guardião reiniciou o painel 159 vezes em 13 h e ninguém foi avisado.
     * Ele funcionou — o alarme é que não existia. */
    it('reinícios em série -> crítico (é laço, não uma queda)', async () => {
      arquivos.reiniciosDoGuardiao.mockReturnValue(
        Array.from({ length: 12 }, () => ({
          quando: new Date(),
          mensagem: 'Painel novo fora do ar; reiniciando.',
        })),
      );
      const i = await item('guardiao');
      expect(i.nivel).toBe('critico');
      expect(i.mensagem).toContain('12 vezes');
    });
  });

  describe('docservice e banco', () => {
    it('docservice fora -> crítico dizendo o que para de funcionar', async () => {
      docservice.responde.mockResolvedValue({
        ok: false,
        detalhe: 'ECONNREFUSED',
      });
      const i = await item('docservice');
      expect(i.nivel).toBe('critico');
      expect(i.mensagem).toContain('transcrição');
      expect(i.detalhe).toContain('iniciar.bat');
    });

    it('banco fora -> crítico e é ele que define o nível geral', async () => {
      banco.conexaoResponde.mockResolvedValue({
        ok: false,
        dialeto: 'mariadb',
        erro: 'ECONNREFUSED 127.0.0.1:3306',
      });
      const r = await service.diagnostico();
      expect(r.nivel).toBe('critico');
      expect(r.itens.find((i) => i.chave === 'banco')?.detalhe).toContain(
        '3306',
      );
    });
  });

  describe('transcrições', () => {
    /** O registro sozinho parece saudável: só perguntando aos DOIS lados dá para saber que
     * o trabalho não existe mais. */
    it('"Transcrevendo" sem job no docservice -> aviso com o caminho para destravar', async () => {
      banco.protocolosEmProcessamento.mockResolvedValue([
        { id: 42, status: 'Transcrevendo', videoNome: 'aula.mp4' },
      ]);
      transcricao.status.mockResolvedValue(null);

      const i = await item('transcricao');
      expect(i.nivel).toBe('aviso');
      expect(i.detalhe).toContain('#42 aula.mp4');
      expect(i.detalhe).toContain('Cancelar processamento');
    });

    it('"Transcrevendo" com job ativo -> ok', async () => {
      banco.protocolosEmProcessamento.mockResolvedValue([
        { id: 42, status: 'Transcrevendo', videoNome: 'aula.mp4' },
      ]);
      transcricao.status.mockResolvedValue({
        status: 'processando',
        pct: 30,
        pos: 60,
        dur: 200,
      });
      expect((await item('transcricao')).nivel).toBe('ok');
    });

    /** 'Analisando' é etapa de IA, que não tem job no docservice — perguntar por ele
     * marcaria como preso todo protocolo que está simplesmente sendo analisado. */
    it('"Analisando" não é conferido contra o docservice', async () => {
      banco.protocolosEmProcessamento.mockResolvedValue([
        { id: 7, status: 'Analisando', videoNome: 'x.mp4' },
      ]);
      const i = await item('transcricao');
      expect(i.nivel).toBe('ok');
      expect(transcricao.status).not.toHaveBeenCalled();
    });

    it('sem resposta do docservice -> desconhecido, não "preso"', async () => {
      banco.protocolosEmProcessamento.mockResolvedValue([
        { id: 42, status: 'Transcrevendo', videoNome: 'aula.mp4' },
      ]);
      transcricao.status.mockRejectedValue(new Error('ECONNREFUSED'));
      expect((await item('transcricao')).nivel).toBe('desconhecido');
    });
  });

  describe('e-mail', () => {
    /** Os envios que falham JÁ ficavam gravados, mas só apareciam para quem abrisse o passo
     * daquele projeto. */
    it('falhas recentes -> aviso com o último erro', async () => {
      banco.emailsQueFalharam.mockResolvedValue({
        total: 3,
        ultimoErro: 'Invalid login: 535 authentication failed',
      });
      const i = await item('email');
      expect(i.nivel).toBe('aviso');
      expect(i.mensagem).toContain('3 e-mail(s)');
      expect(i.detalhe).toContain('535');
    });
  });

  describe('nível geral e ordenação', () => {
    it('é o PIOR dos itens, e "problemas" vem do mais grave para o menos', async () => {
      banco.emailsQueFalharam.mockResolvedValue({ total: 1, ultimoErro: 'x' });
      docservice.responde.mockResolvedValue({
        ok: false,
        detalhe: 'ECONNREFUSED',
      });

      const r = await service.diagnostico();
      expect(r.nivel).toBe('critico');

      const problemas = await service.problemas();
      expect(problemas.map((p) => p.chave)).toEqual(['docservice', 'email']);
    });

    it('uma checagem que não deu para fazer não vira "ok" nem "crítico"', async () => {
      banco.emailsQueFalharam.mockRejectedValue(new Error('tabela ausente'));
      const r = await service.diagnostico();
      expect(r.itens.find((i) => i.chave === 'email')?.nivel).toBe(
        'desconhecido',
      );
      expect(r.nivel).toBe('desconhecido');
    });
  });
});

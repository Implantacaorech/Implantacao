import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { OperacaoArquivosRepository } from './operacao-arquivos.repository';

describe('OperacaoArquivosRepository', () => {
  let repo: OperacaoArquivosRepository;
  let pasta: string;

  const config = { get: jest.fn() };

  beforeEach(async () => {
    pasta = mkdtempSync(join(tmpdir(), 'painelbackups-'));
    config.get.mockReturnValue(pasta);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperacaoArquivosRepository,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    repo = module.get(OperacaoArquivosRepository);
  });

  afterEach(() => rmSync(pasta, { recursive: true, force: true }));

  function zip(nome: string, bytes: number, idadeHoras = 0): void {
    const caminho = join(pasta, nome);
    writeFileSync(caminho, Buffer.alloc(bytes));
    const quando = new Date(Date.now() - idadeHoras * 3600_000);
    utimesSync(caminho, quando, quando);
  }

  describe('ultimoBackup', () => {
    it('devolve o zip mais recente, com tamanho e data', () => {
      zip('painel_novo_mariadb_20260809_220003.zip', 1000, 48);
      zip('painel_novo_mariadb_20260811_220000.zip', 2000, 2);

      const r = repo.ultimoBackup();
      expect(r?.nome).toBe('painel_novo_mariadb_20260811_220000.zip');
      expect(r?.bytes).toBe(2000);
    });

    /** A pasta tem outros artefatos (logs, o `painel_*.sql.gz` do backup antigo). Confundir
     * um deles com o dump do painel novo daria um "backup em dia" falso. */
    it('ignora o que não é dump do painel novo', () => {
      zip('painel_20260810_220001.sql.gz', 5000, 1);
      writeFileSync(join(pasta, 'backup_novo_mariadb.log'), 'x');
      expect(repo.ultimoBackup()).toBeNull();
    });

    it('pasta inexistente devolve null em vez de estourar', () => {
      config.get.mockReturnValue(join(pasta, 'nao-existe'));
      expect(repo.ultimoBackup()).toBeNull();
    });
  });

  describe('errosDeBackup', () => {
    it('conta só as linhas de ERRO dentro da janela', () => {
      writeFileSync(
        join(pasta, 'backup_novo_mariadb.log'),
        [
          '2026-08-01 22:00:03 ERRO -> Access denied for user (antigo)',
          '2026-08-11 22:00:03 ok -> painel_novo_mariadb_20260811_220002.zip',
          '2026-08-11 23:00:03 ERRO -> dump suspeito: apenas 176 bytes',
          '',
        ].join('\n'),
        'utf8',
      );

      const erros = repo.errosDeBackup(new Date('2026-08-10T00:00:00'));
      expect(erros).toHaveLength(1);
      expect(erros[0]).toContain('176 bytes');
    });

    /** ⚠️ O log REAL está com encoding misturado — parte foi gravada em UTF-16 por uma
     * versão antiga do script, e é justamente onde estão os ERROs dos 4 dias de falha de
     * 2026-07-30 a 02/08. Quem abria o arquivo via caracteres chineses e seguia em frente;
     * foi por isso que ninguém percebeu. Aqui a leitura tem de atravessar isso. */
    it('lê o trecho gravado em UTF-16 sem perder as linhas de ERRO', () => {
      const utf16 = Buffer.from(
        '﻿2026-08-11 22:00:03 ERRO -> mariadb-dump saiu com codigo 2\r\n',
        'utf16le',
      );
      writeFileSync(join(pasta, 'backup_novo_mariadb.log'), utf16);

      const erros = repo.errosDeBackup(new Date('2026-08-10T00:00:00'));
      expect(erros).toHaveLength(1);
      expect(erros[0]).toContain('codigo 2');
    });

    it('log ausente não é erro — só não há o que contar', () => {
      expect(repo.errosDeBackup(new Date(0))).toEqual([]);
    });
  });

  describe('reiniciosDoGuardiao', () => {
    /** O Guardião é VBScript e escreve `Now`, que sai no formato do Windows em pt-BR:
     * `dd/MM/yyyy HH:mm:ss`. Ler isso como ISO daria mês/dia trocados — e um alarme errado
     * em toda virada de mês. */
    it('entende a data no formato brasileiro e respeita a janela', () => {
      writeFileSync(
        join(pasta, 'guardiao_novo.log'),
        [
          '05/08/2026 13:56:33 - Painel novo fora do ar; reiniciando.',
          '11/08/2026 10:12:26 - Painel novo fora do ar; reiniciando.',
          '11/08/2026 10:20:00 - docservice fora do ar; reiniciando.',
        ].join('\r\n'),
        'utf8',
      );

      const r = repo.reiniciosDoGuardiao(new Date(2026, 7, 10));
      expect(r).toHaveLength(2);
      expect(r[0].quando.getMonth()).toBe(7); // agosto, não novembro
      expect(r[1].mensagem).toBe('docservice fora do ar; reiniciando.');
    });

    it('linha sem data reconhecível é ignorada, não conta como reinício', () => {
      writeFileSync(
        join(pasta, 'guardiao_novo.log'),
        'linha corrompida sem data\r\n11/08/2026 10:12:26 - reiniciando.\r\n',
        'utf8',
      );
      expect(repo.reiniciosDoGuardiao(new Date(2026, 0, 1))).toHaveLength(1);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '../email/mailer.service';
import { UsersService } from '../users/users.service';
import { NotificacoesAtividadeService } from './notificacoes-atividade.service';
import { NotificacoesRepository } from './repositories/notificacoes.repository';
import { QuadrosRepository } from './repositories/quadros.repository';
import { DetalhesCartaoRepository } from './repositories/detalhes-cartao.repository';
import { AtividadeQuadro } from '../database/entities/atividade-quadro.entity';
import { AtividadeCartao } from '../database/entities/atividade-cartao.entity';

/** Regra do usuário (2026-09-03): **o e-mail de atividade nova sai só para quem está vinculado
 * ao cartão; NUNCA para todos os integrantes da implantação.**
 *
 * O que estes casos protegem é a separação dos dois canais. Ela é fácil de desfazer sem
 * perceber — basta alguém remover o último argumento de `avisar()` numa refatoração —, e o
 * estrago não aparece em tela nenhuma: aparece na caixa de entrada de uma equipe inteira, que
 * então aprende a ignorar todo aviso do Painel, inclusive os que importam. */

const QUADRO = {
  id: 1,
  codigoClienteSicla: '3180',
  nomeCliente: 'Cliente ACME',
} as AtividadeQuadro;

const CARTAO = { id: 50, titulo: 'Ajuda no fiscal' } as AtividadeCartao;

/** Quem responde pelo QUADRO — a "implantação inteira" que não pode receber e-mail. */
const RESPONSAVEIS = [10, 11, 12];
/** Quem está vinculado ao CARTÃO — os únicos que podem receber. */
const DO_CARTAO = [11];

describe('NotificacoesAtividadeService — o recorte do e-mail', () => {
  let servico: NotificacoesAtividadeService;
  const notificacoes = { criarVarias: jest.fn().mockResolvedValue(undefined) };
  const mailer = { enviar: jest.fn().mockResolvedValue({ ok: true }) };
  const usuarios = {
    buscarPorId: jest.fn((id: number) =>
      Promise.resolve({
        id,
        nome: `Usuário ${id}`,
        email: `u${id}@rech.com.br`,
      }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacoesAtividadeService,
        { provide: NotificacoesRepository, useValue: notificacoes },
        { provide: QuadrosRepository, useValue: { responsaveis: jest.fn() } },
        {
          provide: DetalhesCartaoRepository,
          useValue: { membrosDe: jest.fn() },
        },
        { provide: UsersService, useValue: usuarios },
        { provide: MailerService, useValue: mailer },
      ],
    }).compile();
    servico = modulo.get(NotificacoesAtividadeService);
  });

  /** Endereços que de fato foram para o servidor de e-mail. */
  const enderecosEnviados = (): string[] =>
    mailer.enviar.mock.calls.flatMap((c) => c[0] as string[]);

  it('o e-mail vai SÓ para quem está vinculado ao cartão', async () => {
    await servico.avisar(
      QUADRO,
      CARTAO,
      'solicitacao',
      'Nova solicitação do cliente',
      'texto',
      [...RESPONSAVEIS, ...DO_CARTAO], // aviso na tela: o quadro todo
      undefined,
      DO_CARTAO, // e-mail: só o cartão
    );

    expect(enderecosEnviados()).toEqual(['u11@rech.com.br']);
    // O que NÃO pode acontecer, dito com todas as letras:
    expect(enderecosEnviados()).not.toContain('u10@rech.com.br');
    expect(enderecosEnviados()).not.toContain('u12@rech.com.br');
  });

  it('mas o aviso na TELA continua alcançando quem responde pelo quadro', async () => {
    await servico.avisar(
      QUADRO,
      CARTAO,
      'solicitacao',
      't',
      'x',
      [...RESPONSAVEIS, ...DO_CARTAO],
      undefined,
      DO_CARTAO,
    );
    const gravados = (
      notificacoes.criarVarias.mock.calls[0][0] as { usuarioId: number }[]
    ).map((n) => n.usuarioId);
    // Sem isto, a solicitação de um cliente que não designou ninguém não chegaria a ninguém.
    expect(gravados.sort()).toEqual([10, 11, 12]);
  });

  it('cartão SEM ninguém vinculado não manda e-mail nenhum', async () => {
    await servico.avisar(
      QUADRO,
      CARTAO,
      'solicitacao',
      't',
      'x',
      RESPONSAVEIS,
      undefined,
      [],
    );
    // Lista vazia é "e-mail para ninguém", e não "e-mail para todos" — é o ponto da regra.
    expect(mailer.enviar).not.toHaveBeenCalled();
    // E o aviso na tela continua saindo, senão a solicitação sumiria.
    expect(notificacoes.criarVarias).toHaveBeenCalled();
  });

  it('o AUTOR não recebe e-mail da própria ação, nem quando está vinculado', async () => {
    await servico.avisar(
      QUADRO,
      CARTAO,
      'comentario',
      't',
      'x',
      [10, 11],
      11,
      [10, 11],
    );
    expect(enderecosEnviados()).toEqual(['u10@rech.com.br']);
  });

  it('sem recorte informado, o e-mail acompanha o aviso da tela (comportamento antigo)', async () => {
    await servico.avisar(QUADRO, CARTAO, 'comentario', 't', 'x', [10, 11]);
    expect(enderecosEnviados().sort()).toEqual([
      'u10@rech.com.br',
      'u11@rech.com.br',
    ]);
  });

  it('servidor de e-mail fora do ar não desfaz a ação nem lança', async () => {
    mailer.enviar.mockRejectedValueOnce(new Error('SMTP fora'));
    await expect(
      servico.avisar(
        QUADRO,
        CARTAO,
        'solicitacao',
        't',
        'x',
        [10],
        undefined,
        [10],
      ),
    ).resolves.toBeUndefined();
    expect(notificacoes.criarVarias).toHaveBeenCalled();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PassosController } from './passos.controller';
import { PassosService } from './passos.service';
import { RnsService } from './rns.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/** O controller tem de repassar o usuário INTEIRO ao serviço.
 *
 * Bug em produção (2026-07-29): ele montava `{ nome, perfil }` na mão e o `perfis` ficava
 * pelo caminho. Como a permissão do passo se pergunta por PAPEL, todo mundo era rebaixado ao
 * papel PRINCIPAL — o GCI que também é Levantador perdia o Levantador, e o Painel recusava
 * o "Concluir" da pessoa certa, dizendo "só o responsável (Levantador) pode concluir".
 * Trocar login não adiantava: o token estava certo, quem descartava era o controller. */
describe('PassosController — repassa os papéis do usuário', () => {
  let controller: PassosController;
  const passos = {
    listar: jest.fn().mockResolvedValue([]),
    concluir: jest.fn().mockResolvedValue([]),
    conferir: jest.fn().mockResolvedValue([]),
    reabrir: jest.fn().mockResolvedValue([]),
    anexarEmail: jest.fn().mockResolvedValue({}),
  };

  /** Caso real: GCI de perfil principal que ACUMULA o papel de Levantador. */
  const user: AuthUser = {
    sub: 9,
    login: 'dibah@rech.com.br',
    nome: 'Dibah Luiz Lenhart',
    perfil: 'GCI',
    perfis: ['GCI', 'Consultor', 'Levantador'],
    codigoSicla: '',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PassosController],
      providers: [
        { provide: PassosService, useValue: passos },
        { provide: RnsService, useValue: {} },
        // O PermissaoGuard é declarado no controller; aqui os métodos são chamados direto,
        // mas o Nest ainda instancia o guard e precisa da dependência dele.
        {
          provide: PermissoesService,
          useValue: { nivelDe: () => 'alteracao' },
        },
      ],
    }).compile();
    controller = module.get(PassosController);
  });

  it('leva os papéis acumulados na listagem dos passos', async () => {
    await controller.listar(176, user);
    expect(passos.listar).toHaveBeenCalledWith(
      176,
      expect.objectContaining({ perfis: ['GCI', 'Consultor', 'Levantador'] }),
    );
  });

  it('leva os papéis acumulados ao concluir um passo', async () => {
    await controller.concluir(176, 3, { observacao: '' }, user);
    expect(passos.concluir).toHaveBeenCalledWith(
      176,
      3,
      expect.objectContaining({ perfis: ['GCI', 'Consultor', 'Levantador'] }),
      '',
    );
  });

  it('leva os papéis acumulados ao conferir e ao reabrir', async () => {
    await controller.conferir(176, 10, user);
    await controller.reabrir(176, 3, user);
    for (const chamada of [passos.conferir, passos.reabrir]) {
      expect(chamada).toHaveBeenCalledWith(
        176,
        expect.any(Number),
        expect.objectContaining({ perfis: ['GCI', 'Consultor', 'Levantador'] }),
      );
    }
  });

  it('leva os papéis acumulados ao anexar o e-mail do passo', async () => {
    const arquivo = {
      originalname: 'repasse.msg',
      buffer: Buffer.from(''),
    } as Express.Multer.File;
    await controller.anexarEmail(176, 4, arquivo, user);
    expect(passos.anexarEmail).toHaveBeenCalledWith(
      176,
      4,
      arquivo,
      expect.objectContaining({ perfis: ['GCI', 'Consultor', 'Levantador'] }),
    );
  });
});

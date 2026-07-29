import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PassosService } from './passos.service';
import { PassosNotificacaoService } from './passos-notificacao.service';
import { DocumentosService } from '../documentos/documentos.service';
import { Projeto } from '../database/entities/projeto.entity';
import { ProjetoPasso } from '../database/entities/projeto-passo.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { Evento } from '../database/entities/evento.entity';
import { Perfil } from '../common/constants/perfis';

/** Abrir a tela de trabalho de um passo × concluir o passo são DUAS permissões.
 *
 * O usuário reportou em 2026-07-29 que o botão "Abrir" do passo 3 ("Realizar o Levantamento
 * de Processo") não levava a lugar nenhum: ele seguia a permissão de CONCLUIR, que exige ser
 * o Levantador designado naquele projeto. Quem preenche o questionário, porém, é quem tem
 * acesso à tela do Levantamento (GCI, Coordenador, Administrativo, Levantador). */
describe('PassosService — permissão de ABRIR a tela do passo', () => {
  let service: PassosService;
  const projetos = { findOne: jest.fn() };
  const passos = { find: jest.fn() };
  const pessoas = { find: jest.fn() };
  const eventos = { find: jest.fn(), save: jest.fn(), create: jest.fn() };

  const usuario = (perfil: Perfil, nome = 'Fulano') => ({ nome, perfil });

  /** Marca `numeros` como já concluídos no projeto. */
  function concluidos(numeros: number[]) {
    passos.find.mockResolvedValue(
      numeros.map((passo) => ({
        projetoId: 1,
        passo,
        concluidoEm: new Date('2026-07-29T12:00:00Z'),
        concluidoPor: 'setup',
        conferido: false,
      })),
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    projetos.findOne.mockResolvedValue({
      id: 1,
      cliente: 'Cliente de Teste',
      gci: '',
    });
    // Ninguém designado: é justamente o caso em que a permissão de concluir barra.
    pessoas.find.mockResolvedValue([]);
    concluidos([1, 2]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PassosService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: getRepositoryToken(ProjetoPasso), useValue: passos },
        { provide: getRepositoryToken(ProjetoPessoa), useValue: pessoas },
        { provide: getRepositoryToken(Evento), useValue: eventos },
        {
          provide: PassosNotificacaoService,
          useValue: { notificarPasso: jest.fn() },
        },
        {
          provide: DocumentosService,
          useValue: { anexarDocumento: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(PassosService);
  });

  const passo3 = async (perfil: Perfil) =>
    (await service.listar(1, usuario(perfil))).find((p) => p.numero === 3);

  it('deixa o GCI ABRIR o Levantamento mesmo sem poder concluir o passo', async () => {
    const p = await passo3('GCI');
    expect(p?.liberado).toBe(false);
    expect(p?.motivos).toContain(
      'Só o responsável (Levantador) pode concluir.',
    );
    expect(p?.podeAbrir).toBe(true);
  });

  it('deixa o Levantador ainda não designado ABRIR o Levantamento', async () => {
    // Ele vê o questionário e preenche; concluir o passo é que continua sendo de quem foi
    // designado no agendamento (passo 2).
    const p = await passo3('Levantador');
    expect(p?.liberado).toBe(false);
    expect(p?.podeAbrir).toBe(true);
  });

  it('não abre a tela para perfil que a rota não alcança (Consultor)', async () => {
    const p = await passo3('Consultor');
    expect(p?.podeAbrir).toBe(false);
  });

  it('continua abrindo depois de o passo concluído, para rever o preenchimento', async () => {
    concluidos([1, 2, 3]);
    const p = await passo3('GCI');
    expect(p?.concluido).toBe(true);
    expect(p?.podeAbrir).toBe(true);
  });

  it('não abre a tela enquanto a dependência do passo não foi cumprida', async () => {
    // Sem o passo 2 (agendamento) não há levantamento a preencher — a ordem do processo
    // continua valendo para abrir.
    concluidos([1]);
    const p = await passo3('GCI');
    expect(p?.bloqueadoPor).toEqual([2]);
    expect(p?.podeAbrir).toBe(false);
  });

  it('não oferece abrir nos passos que se resolvem na própria ficha', async () => {
    const lista = await service.listar(1, usuario('ADM'));
    const semTela = lista.filter((p) => ![3, 9, 11, 12].includes(p.numero));
    expect(semTela.every((p) => !p.podeAbrir)).toBe(true);
  });
});

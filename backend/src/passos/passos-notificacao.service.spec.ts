import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PassosNotificacaoService } from './passos-notificacao.service';
import { Evento } from '../database/entities/evento.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { MailerService } from '../email/mailer.service';
import { UsersService } from '../users/users.service';
import { Usuario } from '../database/entities/usuario.entity';
import { PASSOS_POR_NUMERO } from './passos.constants';
import { EMAILS_POR_PASSO } from './passos-email.constants';

function usuario(over: Partial<Usuario>): Usuario {
  return {
    id: 1,
    login: 'x@rech.com.br',
    nome: 'X',
    email: 'x@rech.com.br',
    senhaHash: '',
    perfil: 'Consultor',
    ativo: true,
    criadoEm: new Date(),
    ...over,
  } as Usuario;
}

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: 7,
    cliente: 'Indústria Alfa',
    numeroProjeto: '123456',
    gci: 'Ana GCI',
    consultor: 'Beto Consultor',
    contatoEmail: 'contato@cliente.com',
    comercialEmail: 'vendedor@rech.com.br',
    dataEncerramento: '2026-08-01',
    contatoNome: 'Camila',
    dataLevantamento: '',
    ...over,
  } as Projeto;
}

describe('PassosNotificacaoService', () => {
  let service: PassosNotificacaoService;
  let enviados: { para: string[]; assunto: string; corpo: string }[];
  let eventosSalvos: { descricao: string }[];
  let configurado: boolean;
  let pessoasVinculadas: ProjetoPessoa[];

  const USUARIOS: Usuario[] = [
    usuario({
      id: 1,
      nome: 'Ana GCI',
      email: 'ana@rech.com.br',
      perfil: 'GCI',
    }),
    usuario({
      id: 2,
      nome: 'Beto Consultor',
      email: 'beto@rech.com.br',
      perfil: 'Consultor',
    }),
    usuario({
      id: 3,
      nome: 'Carla Consultora',
      email: 'carla@rech.com.br',
      perfil: 'Consultor',
    }),
    usuario({
      id: 4,
      nome: 'Dora Adm',
      email: 'dora@rech.com.br',
      perfil: 'Administrativo',
    }),
    usuario({
      id: 5,
      nome: 'Paim',
      email: 'paim@rech.com.br',
      perfil: 'Coordenador',
    }),
  ];

  beforeEach(async () => {
    enviados = [];
    eventosSalvos = [];
    configurado = true;
    pessoasVinculadas = [];

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        PassosNotificacaoService,
        {
          provide: getRepositoryToken(Evento),
          useValue: {
            create: (e: { descricao: string }) => e,
            save: (e: { descricao: string }) => {
              eventosSalvos.push(e);
              return Promise.resolve(e);
            },
          },
        },
        {
          provide: getRepositoryToken(ProjetoPessoa),
          useValue: { find: () => Promise.resolve(pessoasVinculadas) },
        },
        {
          provide: MailerService,
          useValue: {
            configurado: () => configurado,
            enviar: (para: string[], assunto: string, corpo: string) => {
              enviados.push({ para, assunto, corpo });
              return Promise.resolve({ ok: true, erro: null });
            },
          },
        },
        {
          provide: UsersService,
          useValue: {
            listar: () => Promise.resolve(USUARIOS),
            porPerfil: (p: string) =>
              Promise.resolve(USUARIOS.filter((u) => u.perfil === p)),
          },
        },
      ],
    }).compile();

    service = modulo.get(PassosNotificacaoService);
  });

  it('cobre todos os passos que o mapa do processo diz ter e-mail', () => {
    // Se alguém acrescentar `email:` a um passo e esquecer o texto, o e-mail nunca sairia.
    const comEmailNoProcesso = [...PASSOS_POR_NUMERO.values()]
      .filter((p) => p.email)
      .map((p) => p.numero);
    const comTexto = EMAILS_POR_PASSO.map((e) => e.passo);
    for (const n of comEmailNoProcesso) expect(comTexto).toContain(n);
  });

  it('passo 1 vai para o Administrativo', async () => {
    const email = await service.montar(projeto(), 1);
    expect(email?.para).toEqual(['dora@rech.com.br']);
    expect(email?.assunto).toContain('Indústria Alfa');
  });

  it('passo 3 vai para o Comercial que mandou o fechamento', async () => {
    const email = await service.montar(projeto(), 3);
    expect(email?.para).toEqual(['vendedor@rech.com.br']);
  });

  it('passo 6 avisa GCI, consultores e Administrativo de uma vez', async () => {
    pessoasVinculadas = [
      { pessoa: 'Beto Consultor' } as ProjetoPessoa,
      { pessoa: 'Carla Consultora' } as ProjetoPessoa,
    ];
    const email = await service.montar(projeto(), 6);
    expect(email?.para.sort()).toEqual([
      'ana@rech.com.br',
      'beto@rech.com.br',
      'carla@rech.com.br',
      'dora@rech.com.br',
    ]);
  });

  it('resolve os consultores pelos vínculos por papel, não pelo campo espelho', async () => {
    // `Projeto.consultor` traz só "Beto"; os vínculos trazem Beto e Carla — vale o vínculo.
    pessoasVinculadas = [
      { pessoa: 'Beto Consultor' } as ProjetoPessoa,
      { pessoa: 'Carla Consultora' } as ProjetoPessoa,
    ];
    const email = await service.montar(
      projeto({ consultor: 'Beto Consultor' }),
      7,
    );
    expect(email?.para).toContain('carla@rech.com.br');
  });

  it('cai no campo espelho quando ainda não há vínculo gravado', async () => {
    pessoasVinculadas = [];
    const email = await service.montar(
      projeto({ consultor: 'Beto Consultor' }),
      7,
    );
    expect(email?.para).toContain('beto@rech.com.br');
  });

  it('passos ao cliente vão para o contato do projeto', async () => {
    for (const n of [10, 12, 18]) {
      const email = await service.montar(projeto(), n);
      expect(email?.para).toEqual(['contato@cliente.com']);
    }
  });

  it('substitui os tokens pelo dado do projeto', async () => {
    const email = await service.montar(projeto(), 17);
    expect(email?.corpo).toContain('Indústria Alfa');
    expect(email?.corpo).toContain('2026-08-01');
    expect(email?.corpo).not.toContain('{{');
  });

  it('envia e registra na timeline', async () => {
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(1)!,
      'Dora Adm',
    );
    expect(enviados).toHaveLength(1);
    expect(eventosSalvos[0].descricao).toContain('e-mail enviado');
  });

  it('registra PENDENTE quando o e-mail não está configurado, sem quebrar o passo', async () => {
    configurado = false;
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(1)!,
      'Dora Adm',
    );
    expect(enviados).toHaveLength(0);
    expect(eventosSalvos[0].descricao).toContain('PENDENTE');
  });

  it('registra quando não há destinatário — caso do Comercial em branco', async () => {
    // Projeto criado à mão, sem passar pelo robô: não há e-mail do Comercial.
    await service.notificarPasso(
      projeto({ comercialEmail: '' }),
      PASSOS_POR_NUMERO.get(3)!,
      'Beto Consultor',
    );
    expect(enviados).toHaveLength(0);
    expect(eventosSalvos[0].descricao).toContain(
      'nenhum destinatário resolvido',
    );
  });
});

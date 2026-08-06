import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PassosNotificacaoService } from './passos-notificacao.service';
import { DestinatariosPassoService } from './destinatarios-passo.service';
import { Evento } from '../database/entities/evento.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';
import { ProjetoPasso } from '../database/entities/projeto-passo.entity';
import { Documento } from '../database/entities/documento.entity';
import { EmailPasso } from '../database/entities/email-passo.entity';
import { ModeloEmail } from '../database/entities/modelo-email.entity';
import { DestinatarioPassoConfig } from '../database/entities/destinatario-passo.entity';
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
  /** Argumentos crus de cada chamada a `enviar()`, para inspecionar os anexos (4º arg). */
  let enviadosArgs: unknown[][];
  let eventosSalvos: { descricao: string }[];
  let emailsGravados: Partial<EmailPasso>[];
  let configurado: boolean;
  let consultoresVinculados: ProjetoPessoa[];
  let levantadoresVinculados: ProjetoPessoa[];
  /** Vínculos com papel 'gci'. Vazio = projeto anterior à migração `DesignacaoPorUsuarioId`,
   * em que o GCI só existe como texto em `Projeto.gci`. */
  let gcisVinculados: ProjetoPessoa[];
  let documentoDoProjeto: Partial<Documento> | null;
  /** Arquivos anexados à mão ao e-mail do passo (tipo `anexo_passo_N`). */
  let anexosManuais: Partial<Documento>[];
  /** Modelo editável do passo (slug `passo-N`); `null` = vale o padrão do código. */
  let modeloDoPasso: Partial<ModeloEmail> | null;
  /** Configuração de destinatários por passo; vazio = vale o padrão do código. */
  let destinatariosSalvos: Partial<DestinatarioPassoConfig>[];
  /** Registros de passo, para os tokens que vêm do que a pessoa escreveu. */
  let registrosDePasso: Partial<ProjetoPasso>[];

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
    usuario({
      id: 6,
      nome: 'Eli Levantador',
      email: 'eli@rech.com.br',
      perfil: 'Levantador',
    }),
  ];

  beforeEach(async () => {
    enviados = [];
    enviadosArgs = [];
    eventosSalvos = [];
    emailsGravados = [];
    configurado = true;
    consultoresVinculados = [];
    levantadoresVinculados = [];
    gcisVinculados = [];
    documentoDoProjeto = null;
    anexosManuais = [];
    modeloDoPasso = null;
    destinatariosSalvos = [];
    registrosDePasso = [];

    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        PassosNotificacaoService,
        DestinatariosPassoService,
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
          useValue: {
            // Fiel ao papel pedido: desde que o GCI virou vínculo (`papel: 'gci'`), devolver
            // os consultores para qualquer papel faria o e-mail do GCI sair para eles.
            find: (opcoes: { where?: { papel?: string } }) => {
              const papel = opcoes?.where?.papel;
              if (papel === 'levantador') return Promise.resolve(levantadoresVinculados);
              if (papel === 'consultor') return Promise.resolve(consultoresVinculados);
              if (papel === 'gci') return Promise.resolve(gcisVinculados);
              return Promise.resolve([
                ...gcisVinculados,
                ...consultoresVinculados,
                ...levantadoresVinculados,
              ]);
            },
          },
        },
        {
          provide: getRepositoryToken(ProjetoPasso),
          useValue: {
            findOne: (opcoes: { where?: { passo?: number } }) =>
              Promise.resolve(
                registrosDePasso.find(
                  (r) => r.passo === opcoes?.where?.passo,
                ) ?? null,
              ),
          },
        },
        {
          // `findOne` responde pelo documento GERADO que o passo leva (ANEXO_POR_PASSO);
          // `find`, pelos arquivos que a pessoa anexou na tela (`anexo_passo_N`).
          provide: getRepositoryToken(Documento),
          useValue: {
            findOne: () => Promise.resolve(documentoDoProjeto),
            find: () => Promise.resolve(anexosManuais),
          },
        },
        {
          provide: getRepositoryToken(EmailPasso),
          useValue: {
            create: (e: Partial<EmailPasso>) => e,
            save: (e: Partial<EmailPasso>) => {
              emailsGravados.push(e);
              return Promise.resolve(e);
            },
            find: () => Promise.resolve(emailsGravados),
          },
        },
        {
          provide: getRepositoryToken(ModeloEmail),
          useValue: { findOne: () => Promise.resolve(modeloDoPasso) },
        },
        {
          provide: getRepositoryToken(DestinatarioPassoConfig),
          useValue: {
            find: () => Promise.resolve(destinatariosSalvos),
            findOne: (opcoes: { where?: { passo?: number } }) =>
              Promise.resolve(
                destinatariosSalvos.find(
                  (d) => d.passo === opcoes?.where?.passo,
                ) ?? null,
              ),
          },
        },
        {
          provide: MailerService,
          useValue: {
            configurado: () => configurado,
            enviar: (...args: unknown[]) => {
              enviadosArgs.push(args);
              const [para, assunto, corpo] = args as [string[], string, string];
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

  it('não inventa e-mail em passo que o processo diz não ter', () => {
    // O passo 9 (Incluir RNS) foi explicitamente marcado "sem necessidade de envio de
    // e-mail" na revisão de 2026-07-30.
    const semEmailNoProcesso = [...PASSOS_POR_NUMERO.values()]
      .filter((p) => !p.email)
      .map((p) => p.numero);
    const comTexto = EMAILS_POR_PASSO.map((e) => e.passo);
    for (const n of semEmailNoProcesso) expect(comTexto).not.toContain(n);
  });

  it('passo 1 vai para o Administrativo', async () => {
    const email = await service.montar(projeto(), 1);
    expect(email?.para).toEqual(['dora@rech.com.br']);
    expect(email?.assunto).toContain('Indústria Alfa');
  });

  it('passo 2 avisa o levantador designado, com a data agendada', async () => {
    levantadoresVinculados = [{ pessoa: 'Eli Levantador' } as ProjetoPessoa];
    const email = await service.montar(
      projeto({ dataLevantamento: '2026-08-12' }),
      2,
    );
    expect(email?.para).toEqual(['eli@rech.com.br']);
    expect(email?.assunto).toContain('2026-08-12');
    expect(email?.corpo).toContain('Eli Levantador');
  });

  it('passo 4 vai para o Comercial que mandou o fechamento', async () => {
    const email = await service.montar(projeto(), 4);
    expect(email?.para).toEqual(['vendedor@rech.com.br']);
  });

  it('passo 5 leva ao Administrativo a descrição escrita pelo Comercial', async () => {
    registrosDePasso = [{ passo: 5, observacao: 'Desconto de 10% aprovado.' }];
    const email = await service.montar(projeto(), 5);
    expect(email?.para).toEqual(['dora@rech.com.br']);
    expect(email?.corpo).toContain('Desconto de 10% aprovado.');
  });

  it('passo 7 informa a data em que o contrato foi assinado', async () => {
    registrosDePasso = [{ passo: 7, dataMarcada: '2026-08-03' }];
    const email = await service.montar(projeto(), 7);
    expect(email?.corpo).toContain('2026-08-03');
  });

  it('passo 8 avisa GCI, consultores e Administrativo de uma vez', async () => {
    consultoresVinculados = [
      { pessoa: 'Beto Consultor' } as ProjetoPessoa,
      { pessoa: 'Carla Consultora' } as ProjetoPessoa,
    ];
    const email = await service.montar(projeto(), 8);
    expect(email?.para.sort()).toEqual([
      'ana@rech.com.br',
      'beto@rech.com.br',
      'carla@rech.com.br',
      'dora@rech.com.br',
    ]);
  });

  it('resolve os consultores pelos vínculos por papel, não pelo campo espelho', async () => {
    // `Projeto.consultor` traz só "Beto"; os vínculos trazem Beto e Carla — vale o vínculo.
    consultoresVinculados = [
      { pessoa: 'Beto Consultor' } as ProjetoPessoa,
      { pessoa: 'Carla Consultora' } as ProjetoPessoa,
    ];
    const email = await service.montar(
      projeto({ consultor: 'Beto Consultor' }),
      8,
    );
    expect(email?.para).toContain('carla@rech.com.br');
  });

  it('cai no campo espelho quando ainda não há vínculo gravado', async () => {
    consultoresVinculados = [];
    const email = await service.montar(
      projeto({ consultor: 'Beto Consultor' }),
      8,
    );
    expect(email?.para).toContain('beto@rech.com.br');
  });

  it('passos ao cliente vão para o contato do projeto', async () => {
    for (const n of [15, 16, 21]) {
      const email = await service.montar(projeto(), n);
      expect(email?.para).toEqual(['contato@cliente.com']);
    }
  });

  it('passo 13 NÃO manda e-mail: elaborar o cronograma é trabalho interno', async () => {
    // Quem leva o cronograma ao cliente é o passo 16 — mandar já no 13 entregava uma versão
    // que o consultor ainda podia refazer (decisão do usuário em 2026-07-30).
    expect(await service.montar(projeto(), 13)).toBeNull();

    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(13)!,
      'Beto Consultor',
    );
    expect(enviados).toHaveLength(0);
    expect(emailsGravados).toHaveLength(0);
  });

  it('substitui os tokens pelo dado do projeto', async () => {
    const email = await service.montar(projeto(), 20);
    expect(email?.corpo).toContain('Indústria Alfa');
    expect(email?.corpo).toContain('2026-08-01');
    expect(email?.corpo).not.toContain('{{');
  });

  it('o modelo editável do passo vence o padrão do código', async () => {
    modeloDoPasso = {
      slug: 'passo-1',
      assunto: 'Assunto do ADM — {{CLIENTE}}',
      corpo: 'Texto reescrito no Painel.',
      ativo: true,
    };
    const email = await service.montar(projeto(), 1);
    expect(email?.assunto).toBe('Assunto do ADM — Indústria Alfa');
    expect(email?.corpo).toBe('Texto reescrito no Painel.');
  });

  it('os destinatários configurados vencem o padrão, e os grupos fixos entram junto', async () => {
    // É assim que os DOIS grupos de e-mail do passo 1 chegam ao envio: são endereços da
    // Rech, configurados em Ferramentas, não cravados no código.
    destinatariosSalvos = [
      {
        passo: 1,
        grupos: 'administrativo',
        extras: 'grupo1@rech.com.br,grupo2@rech.com.br',
        ativo: true,
      },
    ];
    const email = await service.montar(projeto(), 1);
    expect(email?.para.sort()).toEqual([
      'dora@rech.com.br',
      'grupo1@rech.com.br',
      'grupo2@rech.com.br',
    ]);
  });

  it('não envia quando o passo está desligado na configuração', async () => {
    destinatariosSalvos = [
      { passo: 1, grupos: 'administrativo', extras: '', ativo: false },
    ];
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(1)!,
      'Dora Adm',
    );
    expect(enviados).toHaveLength(0);
    expect(emailsGravados).toHaveLength(0);
  });

  it('envia, registra na timeline e guarda o e-mail para consulta', async () => {
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(1)!,
      'Dora Adm',
    );
    expect(enviados).toHaveLength(1);
    expect(eventosSalvos[0].descricao).toContain('e-mail enviado');
    // O corpo tem de ficar guardado por inteiro — é o que a consulta por passo relê.
    expect(emailsGravados).toHaveLength(1);
    expect(emailsGravados[0].status).toBe('enviado');
    expect(emailsGravados[0].corpo).toContain('Indústria Alfa');
    expect(emailsGravados[0].para).toContain('dora@rech.com.br');
  });

  it('usa o texto que a pessoa redigiu na tela, quando o passo prevê redação', async () => {
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(4)!,
      'Eli Levantador',
      {
        para: ['outro@rech.com.br'],
        assunto: 'Assunto revisado',
        corpo: 'Corpo revisado pelo levantador.',
      },
    );
    expect(enviados[0].para).toEqual(['outro@rech.com.br']);
    expect(enviados[0].assunto).toBe('Assunto revisado');
    expect(emailsGravados[0].corpo).toBe('Corpo revisado pelo levantador.');
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
    expect(emailsGravados[0].status).toBe('falhou');
  });

  it('anexa o Termo no passo 21 quando o documento existe', async () => {
    documentoDoProjeto = {
      tipo: 'termo',
      caminho: __filename,
      arquivo: 'Termo.docx',
    };
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(21)!,
      'Consultor',
    );
    expect(enviados).toHaveLength(1);
    // 4º argumento de enviar() são os anexos.
    const anexos = enviadosArgs[0][3] as { caminho: string }[];
    expect(anexos).toHaveLength(1);
    expect(anexos[0].caminho).toBe(__filename);
    expect(eventosSalvos[0].descricao).toContain('anexo: Termo.docx');
  });

  it('passo 16 leva os arquivos anexados na tela ANTES do cronograma gerado', async () => {
    anexosManuais = [
      {
        tipo: 'anexo_passo_16',
        caminho: __filename,
        arquivo: 'Apresentacao.pdf',
      },
    ];
    documentoDoProjeto = {
      tipo: 'cronograma',
      caminho: __filename,
      arquivo: 'Cronograma.xlsx',
    };
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(16)!,
      'Beto Consultor',
    );
    const anexos = enviadosArgs[0][3] as { nomeArquivo: string }[];
    expect(anexos.map((a) => a.nomeArquivo)).toEqual([
      'Apresentacao.pdf',
      'Cronograma.xlsx',
    ]);
    expect(emailsGravados[0].anexo).toBe('Apresentacao.pdf, Cronograma.xlsx');
  });

  it('não anexa nada quando o documento não existe em disco', async () => {
    documentoDoProjeto = {
      tipo: 'termo',
      caminho: '/nao/existe/termo.docx',
      arquivo: 'Termo.docx',
    };
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(21)!,
      'Consultor',
    );
    const anexos = enviadosArgs[0][3] as unknown[];
    expect(anexos).toHaveLength(0);
    expect(eventosSalvos[0].descricao).not.toContain('anexo:');
  });

  it('passo sem anexo no mapa não busca documento', async () => {
    // Passo 1 não leva anexo; mesmo que houvesse documento, não deve anexar.
    documentoDoProjeto = {
      tipo: 'termo',
      caminho: __filename,
      arquivo: 'Termo.docx',
    };
    await service.notificarPasso(
      projeto(),
      PASSOS_POR_NUMERO.get(1)!,
      'Dora Adm',
    );
    const anexos = enviadosArgs[0][3] as unknown[];
    expect(anexos).toHaveLength(0);
  });

  it('registra quando não há destinatário — caso do Comercial em branco', async () => {
    // Projeto criado à mão, sem passar pelo robô: não há e-mail do Comercial.
    await service.notificarPasso(
      projeto({ comercialEmail: '' }),
      PASSOS_POR_NUMERO.get(4)!,
      'Beto Consultor',
    );
    expect(enviados).toHaveLength(0);
    expect(eventosSalvos[0].descricao).toContain(
      'nenhum destinatário resolvido',
    );
    expect(emailsGravados[0].status).toBe('sem_destinatario');
  });
});

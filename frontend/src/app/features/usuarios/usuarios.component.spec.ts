import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { UsuariosComponent } from './usuarios.component';
import { UsuariosService } from '../../core/services/usuarios.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/models/auth-user.model';
import { TecnicoSicla, Usuario } from '../../core/models/usuario.model';

/** Logado padrão dos testes: ADM com id 99, para não colidir com o id 1 do helper
 * `usuario()` — a linha do próprio logado não ganha o botão Excluir. */
const LOGADO: AuthUser = {
  sub: 99,
  login: 'admin',
  nome: 'Administrador',
  perfil: 'ADM',
  codigoSicla: '',
};

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 1,
    login: 'ana',
    nome: 'Ana',
    email: 'ana@teste.com',
    perfil: 'Consultor',
    codigoSicla: '007',
    codigoClienteSicla: '',
    modulosCapacitados: '',
    setorAtuacao: '',
    ativo: true,
    criadoEm: new Date().toISOString(),
    ...over,
  };
}

function tecnico(over: Partial<TecnicoSicla> = {}): TecnicoSicla {
  return {
    codigo: '42',
    nome: 'Fulano',
    modulosCapacitados: 'FAT, EST',
    email: 'fulano@rech.com.br',
    setorAtuacao: 'Implantação',
    jaCadastrado: false,
    bruto: {},
    ...over,
  };
}

describe('UsuariosComponent', () => {
  function montar(service: Partial<UsuariosService>, logado: AuthUser = LOGADO) {
    TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [
        { provide: UsuariosService, useValue: service },
        { provide: AuthService, useValue: { usuario: signal<AuthUser | null>(logado) } },
      ],
    });
    return TestBed.createComponent(UsuariosComponent);
  }

  it('mostra "Carregando…" enquanto a chamada está pendente', () => {
    const fixture = montar({ listar: () => new Promise(() => {}) });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando');
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    const fixture = montar({ listar: () => Promise.reject(new Error('falhou')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os usuários.');
  });

  it('lista os usuários vindos da API', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario({ nome: 'Ana' }), usuario({ id: 2, nome: 'Beto' })]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ana');
    expect(texto).toContain('Beto');
  });

  it('mostra a mensagem de lista vazia quando não há usuários', async () => {
    const fixture = montar({ listar: () => Promise.resolve([]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum usuário ainda');
  });

  it('modo criação: exige senha com pelo menos 6 caracteres antes de salvar', async () => {
    const criar = vi.fn();
    const fixture = montar({ listar: () => Promise.resolve([]), criar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: '123' });
    await comp.salvar();
    expect(criar).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('pelo menos 6 caracteres');
  });

  it('modo criação: chama service.criar e recarrega a lista', async () => {
    const criar = vi.fn().mockResolvedValue(usuario({ id: 42 }));
    const listar = vi.fn().mockResolvedValue([]);
    const fixture = montar({ listar, criar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ email: 'novo@teste.com', senha: 'segredo' }));
    expect(listar).toHaveBeenCalledTimes(2);
  });

  // ===== Formulário sob demanda (＋ Novo / Editar) =====

  it('o formulário fica fechado até clicarem em ＋ Novo ou Editar', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario()]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    expect(comp.formAberto()).toBe(false);
    expect(fixture.nativeElement.querySelector('#form-usuario')).toBeNull();
  });

  it('"Novo usuário" abre o formulário em branco', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario()]) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario({ nome: 'Ana Existente' }));
    comp.novo();
    fixture.detectChanges();
    expect(comp.formAberto()).toBe(true);
    expect(comp.usuarioId()).toBeNull();
    expect(comp.form.getRawValue().nome).toBe('');
    expect(fixture.nativeElement.querySelector('#form-usuario')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Novo usuário');
  });

  it('"Editar" abre o formulário já com os dados da linha', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario({ nome: 'Ana' })]) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario({ nome: 'Ana', setorAtuacao: 'GRM-Implantação' }));
    fixture.detectChanges();
    expect(comp.formAberto()).toBe(true);
    expect(fixture.nativeElement.querySelector('#form-usuario')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Editar usuário');
    expect(comp.form.getRawValue().setorAtuacao).toBe('GRM-Implantação');
  });

  it('"Cancelar" fecha o formulário e descarta a edição', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario()]) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario({ nome: 'Ana' }));
    comp.fechar();
    fixture.detectChanges();
    expect(comp.formAberto()).toBe(false);
    expect(comp.usuarioId()).toBeNull();
    expect(fixture.nativeElement.querySelector('#form-usuario')).toBeNull();
  });

  it('salvar com sucesso fecha o formulário', async () => {
    const fixture = montar({
      listar: () => Promise.resolve([]),
      criar: vi.fn().mockResolvedValue(usuario({ id: 42 })),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.novo();
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(comp.formAberto()).toBe(false);
  });

  it('erro ao salvar mantém o formulário aberto com o que foi digitado', async () => {
    const fixture = montar({
      listar: () => Promise.resolve([]),
      criar: vi.fn().mockRejectedValue(new Error('falhou')),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.novo();
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(comp.formAberto()).toBe(true);
    expect(comp.form.getRawValue().email).toBe('novo@teste.com');
  });

  it('editar pré-preenche o formulário e zera a senha', async () => {
    const fixture = montar({ listar: () => Promise.resolve([usuario({ nome: 'Ana Existente' })]) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario({ nome: 'Ana Existente' }));
    expect(comp.form.getRawValue().nome).toBe('Ana Existente');
    expect(comp.form.getRawValue().senha).toBe('');
    expect(comp.usuarioId()).toBe(1);
  });

  it('após editar, senha em branco não bloqueia o salvar e não é enviada', async () => {
    const atualizar = vi.fn().mockResolvedValue(usuario());
    const fixture = montar({ listar: () => Promise.resolve([usuario()]), atualizar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario());
    await comp.salvar();
    expect(atualizar).toHaveBeenCalledWith(1, expect.not.objectContaining({ senha: expect.anything() }));
  });

  it('mostra mensagem de erro quando o salvamento falha', async () => {
    const criar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ listar: () => Promise.resolve([]), criar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.form.patchValue({ email: 'novo@teste.com', codigoSicla: '123', senha: 'segredo' });
    await comp.salvar();
    expect(comp.erro()).toBe('Não foi possível salvar o usuário.');
  });

  // ===== Técnicos do SICLA (LISTA_TECNICOS) — a fonte do cadastro =====

  it('não consulta o SICLA ao abrir a tela (a conexão Oracle pode estar fora)', async () => {
    const listarTecnicosSicla = vi.fn();
    const fixture = montar({ listar: () => Promise.resolve([]), listarTecnicosSicla });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(listarTecnicosSicla).not.toHaveBeenCalled();
  });

  it('lista os técnicos do SICLA com o filtro digitado', async () => {
    const listarTecnicosSicla = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: '1 linha', tecnicos: [tecnico()] });
    const fixture = montar({ listar: () => Promise.resolve([]), listarTecnicosSicla });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.filtroSicla.set('fula');
    await comp.carregarTecnicos();
    fixture.detectChanges();
    expect(listarTecnicosSicla).toHaveBeenCalledWith('fula', false);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Fulano');
    expect(texto).toContain('FAT, EST');
    expect(texto).toContain('Implantação');
  });

  it('mostra o erro da consulta ao SICLA sem derrubar a tela', async () => {
    const listarTecnicosSicla = vi
      .fn()
      .mockResolvedValue({ ok: false, mensagem: 'ORA-00942', tecnicos: [] });
    const fixture = montar({ listar: () => Promise.resolve([]), listarTecnicosSicla });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.carregarTecnicos();
    expect(comp.erroSicla()).toContain('ORA-00942');
  });

  it('sem seleção, importa exatamente os técnicos listados', async () => {
    const importarTecnicos = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', criados: 2, atualizados: 0, ignorados: [] });
    const listarTecnicosSicla = vi.fn().mockResolvedValue({
      ok: true,
      mensagem: 'ok',
      tecnicos: [tecnico({ codigo: '42' }), tecnico({ codigo: '43' })],
    });
    const fixture = montar({
      listar: () => Promise.resolve([]),
      listarTecnicosSicla,
      importarTecnicos,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.carregarTecnicos();
    await comp.importar();
    expect(importarTecnicos).toHaveBeenCalledWith(['42', '43']);
  });

  it('sem nada listado, não chama a importação', async () => {
    const importarTecnicos = vi.fn();
    const fixture = montar({
      listar: () => Promise.resolve([]),
      listarTecnicosSicla: vi.fn().mockResolvedValue({ ok: true, mensagem: 'ok', tecnicos: [] }),
      importarTecnicos,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.importar();
    expect(importarTecnicos).not.toHaveBeenCalled();
  });

  it('com seleção, importa só os códigos marcados e recarrega as duas listas', async () => {
    const importarTecnicos = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', criados: 1, atualizados: 0, ignorados: [] });
    const listarTecnicosSicla = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', tecnicos: [tecnico()] });
    const listar = vi.fn().mockResolvedValue([]);
    const fixture = montar({ listar, listarTecnicosSicla, importarTecnicos });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.alternarSelecao('42', true);
    await comp.importar();
    expect(importarTecnicos).toHaveBeenCalledWith(['42']);
    expect(comp.selecionados()).toEqual([]);
    expect(listar).toHaveBeenCalledTimes(2);
    expect(listarTecnicosSicla).toHaveBeenCalledTimes(1);
  });

  it('técnico do SICLA já cadastrado ganha o botão Editar, que abre o cadastro do Painel', async () => {
    const listarTecnicosSicla = vi.fn().mockResolvedValue({
      ok: true,
      mensagem: 'ok',
      tecnicos: [tecnico({ codigo: '42', jaCadastrado: true })],
    });
    const fixture = montar({
      listar: () => Promise.resolve([usuario({ id: 9, nome: 'Fulano Painel', codigoSicla: '42' })]),
      listarTecnicosSicla,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.carregarTecnicos();
    fixture.detectChanges();
    const u = comp.usuarioDoTecnico('42');
    expect(u?.id).toBe(9);
    comp.editar(u!);
    expect(comp.formAberto()).toBe(true);
    expect(comp.usuarioId()).toBe(9);
    expect(comp.form.getRawValue().nome).toBe('Fulano Painel');
  });

  it('casa o técnico mesmo com zero à esquerda no código do SICLA', async () => {
    const fixture = montar({
      listar: () => Promise.resolve([usuario({ id: 5, codigoSicla: '007' })]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.usuarioDoTecnico('007')?.id).toBe(5);
    expect(comp.usuarioDoTecnico('7')?.id).toBe(5);
    expect(comp.usuarioDoTecnico('99')).toBeUndefined();
  });

  // ===== Filtro por Setor Atuação (lista do Painel) =====

  it('monta o select de setores com a contagem, do mais frequente para o menos', async () => {
    const fixture = montar({
      listar: () =>
        Promise.resolve([
          usuario({ id: 1, nome: 'A', setorAtuacao: 'GRM-Suporte' }),
          usuario({ id: 2, nome: 'B', setorAtuacao: 'GRM-Implantação' }),
          usuario({ id: 3, nome: 'C', setorAtuacao: 'GRM-Suporte' }),
          usuario({ id: 4, nome: 'D', setorAtuacao: '' }),
        ]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.setores()).toEqual([
      { setor: 'GRM-Suporte', total: 2 },
      { setor: 'GRM-Implantação', total: 1 },
    ]);
    expect(comp.semSetor()).toBe(1);
  });

  it('filtra a lista pelo setor escolhido', async () => {
    const fixture = montar({
      listar: () =>
        Promise.resolve([
          usuario({ id: 1, nome: 'Suporte1', setorAtuacao: 'GRM-Suporte' }),
          usuario({ id: 2, nome: 'Implant1', setorAtuacao: 'GRM-Implantação' }),
        ]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.filtroSetor.set('GRM-Implantação');
    fixture.detectChanges();
    expect(comp.usuariosFiltrados().map((u) => u.nome)).toEqual(['Implant1']);
    expect(fixture.nativeElement.textContent).not.toContain('Suporte1');
  });

  it('a opção "sem setor" isola quem não veio do SICLA', async () => {
    const fixture = montar({
      listar: () =>
        Promise.resolve([
          usuario({ id: 1, nome: 'DoSicla', setorAtuacao: 'GRM-Suporte' }),
          usuario({ id: 2, nome: 'ContaServico', setorAtuacao: '' }),
        ]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.filtroSetor.set('__sem__');
    expect(comp.usuariosFiltrados().map((u) => u.nome)).toEqual(['ContaServico']);
  });

  it('combina o filtro de setor com a busca por texto', async () => {
    const fixture = montar({
      listar: () =>
        Promise.resolve([
          // e-mail/login explícitos: o helper usa "ana@teste.com" por padrão, o que faria
          // o Beto casar com a busca "ana" pelo e-mail.
          usuario({ id: 1, nome: 'Ana Souza', email: 'souza@r.com', login: 'souza', setorAtuacao: 'GRM-Implantação' }),
          usuario({ id: 2, nome: 'Beto Lima', email: 'beto@r.com', login: 'beto', setorAtuacao: 'GRM-Implantação' }),
          usuario({ id: 3, nome: 'Ana Costa', email: 'costa@r.com', login: 'costa', setorAtuacao: 'GRM-Suporte' }),
        ]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.filtroSetor.set('GRM-Implantação');
    comp.filtroNome.set('ana');
    expect(comp.usuariosFiltrados().map((u) => u.nome)).toEqual(['Ana Souza']);
    comp.limparFiltros();
    expect(comp.usuariosFiltrados()).toHaveLength(3);
  });

  it('a busca por texto também acha por código SICLA e por módulo', async () => {
    const fixture = montar({
      listar: () =>
        Promise.resolve([
          usuario({ id: 1, nome: 'Ana', codigoSicla: '512', modulosCapacitados: 'FAT EST' }),
          usuario({ id: 2, nome: 'Beto', codigoSicla: '777', modulosCapacitados: 'PCP' }),
        ]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.filtroNome.set('512');
    expect(comp.usuariosFiltrados().map((u) => u.nome)).toEqual(['Ana']);
    comp.filtroNome.set('pcp');
    expect(comp.usuariosFiltrados().map((u) => u.nome)).toEqual(['Beto']);
  });

  // ===== Busca rápida de técnicos NOVOS no SICLA =====

  it('"Buscar novos" pede ao servidor só os não cadastrados', async () => {
    const listarTecnicosSicla = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', tecnicos: [tecnico()] });
    const fixture = montar({ listar: () => Promise.resolve([]), listarTecnicosSicla });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.buscarNovos();
    expect(comp.soNovos()).toBe(true);
    expect(listarTecnicosSicla).toHaveBeenCalledWith('', true);
  });

  it('desmarcar "só novos" recarrega a lista inteira do SICLA', async () => {
    const listarTecnicosSicla = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', tecnicos: [tecnico()] });
    const fixture = montar({ listar: () => Promise.resolve([]), listarTecnicosSicla });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.buscarNovos();
    await comp.alternarSoNovos(false);
    expect(listarTecnicosSicla).toHaveBeenLastCalledWith('', false);
  });

  it('sem técnico novo, explica que está tudo cadastrado', async () => {
    const listarTecnicosSicla = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', tecnicos: [] });
    const fixture = montar({ listar: () => Promise.resolve([]), listarTecnicosSicla });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.buscarNovos();
    expect(comp.erroSicla()).toContain('já estão cadastrados');
  });

  it('com "só novos" ligado, importa apenas os listados — não os 250 do SICLA', async () => {
    const importarTecnicos = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', criados: 2, atualizados: 0, ignorados: [] });
    const listarTecnicosSicla = vi.fn().mockResolvedValue({
      ok: true,
      mensagem: 'ok',
      tecnicos: [tecnico({ codigo: '90' }), tecnico({ codigo: '91' })],
    });
    const fixture = montar({
      listar: () => Promise.resolve([]),
      listarTecnicosSicla,
      importarTecnicos,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.buscarNovos();
    await comp.importar();
    // lista explícita, nunca `undefined` (que faria o servidor importar tudo)
    expect(importarTecnicos).toHaveBeenCalledWith(['90', '91']);
  });

  it('nova busca no SICLA zera a seleção anterior', async () => {
    const listarTecnicosSicla = vi
      .fn()
      .mockResolvedValue({ ok: true, mensagem: 'ok', tecnicos: [tecnico()] });
    const fixture = montar({ listar: () => Promise.resolve([]), listarTecnicosSicla });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.alternarSelecao('42', true);
    expect(comp.selecionados()).toEqual(['42']);
    await comp.carregarTecnicos();
    expect(comp.selecionados()).toEqual([]);
  });

  // ===== Exclusão de usuário (só ADM) =====

  it('ADM vê o botão Excluir em toda linha, MENOS na do próprio logado', async () => {
    const fixture = montar({
      listar: () =>
        Promise.resolve([
          usuario({ id: 99, nome: 'Eu Mesmo' }), // id do LOGADO
          usuario({ id: 2, nome: 'Outro' }),
        ]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const botoes = Array.from(
      fixture.nativeElement.querySelectorAll('button.perigo') as NodeListOf<HTMLElement>,
    );
    expect(botoes).toHaveLength(1);
    expect(botoes[0].closest('tr')?.textContent).toContain('Outro');
  });

  it('quem não é ADM não vê o botão Excluir (a regra é do Administrador)', async () => {
    const fixture = montar(
      { listar: () => Promise.resolve([usuario({ id: 2, nome: 'Outro' })]) },
      { ...LOGADO, perfil: 'Coordenador', perfis: ['Coordenador'] },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button.perigo')).toHaveLength(0);
  });

  it('excluir pede confirmação, chama o service e recarrega a lista', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const excluir = vi.fn().mockResolvedValue(undefined);
    const listar = vi.fn().mockResolvedValue([usuario({ id: 2, nome: 'Outro' })]);
    const fixture = montar({ listar, excluir });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.excluir(usuario({ id: 2, nome: 'Outro' }));
    expect(excluir).toHaveBeenCalledWith(2);
    expect(listar).toHaveBeenCalledTimes(2);
    expect(comp.aviso()).toContain('excluído');
    spy.mockRestore();
  });

  it('cancelar a confirmação não exclui nada', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const excluir = vi.fn();
    const fixture = montar({ listar: () => Promise.resolve([usuario({ id: 2 })]), excluir });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.excluir(usuario({ id: 2 }));
    expect(excluir).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('mostra a mensagem do backend quando a exclusão é recusada (ex.: designação em projeto)', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const excluir = vi.fn().mockRejectedValue(
      new HttpErrorResponse({
        status: 409,
        error: { message: '"Outro" tem 3 designação(ões) em projetos e não pode ser excluído.' },
      }),
    );
    const fixture = montar({ listar: () => Promise.resolve([usuario({ id: 2, nome: 'Outro' })]), excluir });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.excluir(usuario({ id: 2, nome: 'Outro' }));
    expect(comp.erro()).toContain('designação');
    spy.mockRestore();
  });

  it('excluir quem estava aberto no formulário fecha o formulário', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const excluir = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({ listar: () => Promise.resolve([usuario({ id: 2, nome: 'Outro' })]), excluir });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.editar(usuario({ id: 2, nome: 'Outro' }));
    expect(comp.formAberto()).toBe(true);
    await comp.excluir(usuario({ id: 2, nome: 'Outro' }));
    expect(comp.formAberto()).toBe(false);
    expect(comp.usuarioId()).toBeNull();
    spy.mockRestore();
  });

  it('avisa quais técnicos ficaram de fora por não ter e-mail', async () => {
    const importarTecnicos = vi.fn().mockResolvedValue({
      ok: true,
      mensagem: 'Importação concluída: 0 criado(s), 0 atualizado(s), 1 ignorado(s).',
      criados: 0,
      atualizados: 0,
      ignorados: [{ codigo: '42', nome: 'Fulano', motivo: 'sem e-mail no SICLA' }],
    });
    const fixture = montar({
      listar: () => Promise.resolve([]),
      listarTecnicosSicla: vi
        .fn()
        .mockResolvedValue({ ok: true, mensagem: 'ok', tecnicos: [tecnico()] }),
      importarTecnicos,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.carregarTecnicos();
    await comp.importar();
    expect(comp.aviso()).toContain('Fulano');
  });

  // ---- Papel Cliente (externo) ----------------------------------------------------
  // O acúmulo de papéis existe para quem é GCI e Levantador ao mesmo tempo. O `Cliente`
  // fica de fora disso: acumulado com um papel interno, ele cairia no ramo "interno vê
  // tudo" do recorte por cliente no backend (docs/acesso-cliente-bi.md §3).
  describe('papel Cliente', () => {
    async function abrir() {
      const fixture = montar({ listar: () => Promise.resolve([]) });
      fixture.detectChanges();
      await fixture.whenStable();
      return fixture.componentInstance;
    }

    it('marcar Cliente desmarca todos os papéis internos', async () => {
      const comp = await abrir();
      comp.alternarPapel('GCI', true);
      comp.alternarPapel('Levantador', true);
      comp.alternarPapel('Cliente', true);
      expect(comp.papeisMarcados()).toEqual(['Cliente']);
      expect(comp.ehCliente()).toBe(true);
    });

    it('marcar um papel interno tira o Cliente', async () => {
      const comp = await abrir();
      comp.alternarPapel('Cliente', true);
      comp.alternarPapel('Consultor', true);
      expect(comp.papeisMarcados()).not.toContain('Cliente');
      expect(comp.ehCliente()).toBe(false);
    });

    // Um cliente não tem código de técnico, e um técnico não tem cliente vinculado: o
    // campo obrigatório troca de lado junto com o papel.
    it('troca qual código é obrigatório', async () => {
      const comp = await abrir();
      expect(comp.form.controls.codigoSicla.hasError('required')).toBe(true);

      comp.alternarPapel('Cliente', true);
      expect(comp.form.controls.codigoSicla.hasError('required')).toBe(false);
      expect(comp.form.controls.codigoClienteSicla.hasError('required')).toBe(
        true,
      );

      comp.alternarPapel('Consultor', true);
      expect(comp.form.controls.codigoSicla.hasError('required')).toBe(true);
      expect(comp.form.controls.codigoClienteSicla.hasError('required')).toBe(
        false,
      );
    });
  });
});

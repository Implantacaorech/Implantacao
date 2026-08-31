import { MatrizFuncoesService } from './matriz-funcoes.service';
import type { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import type { ModuloFuncoes } from './funcoes-sicla.constants';

const TAX: ModuloFuncoes[] = [
  {
    sigla: 'CTB',
    titulo: 'CTB',
    funcoes: [
      { codigo: '1', descricao: 'F1', menus: 'CTB94A', chave: 'CTB|1' },
      { codigo: '2', descricao: 'F2', menus: 'CTB95B', chave: 'CTB|2' },
    ],
  },
  {
    sigla: 'FAT',
    titulo: 'FAT',
    funcoes: [
      { codigo: '1', descricao: 'F1', menus: 'FAT94A', chave: 'FAT|1' },
    ],
  },
];

function tecnico(notasFuncao: Record<string, number>): MatrizTecnico {
  return { id: 1, notasFuncao: JSON.stringify(notasFuncao) } as MatrizTecnico;
}

/** Notas da Matriz por Menu — Funções SICLA. Foco na REGRA: média do módulo = média das
 * funções avaliadas; resumo = média das médias; gravação com clamp 0-10. */
describe('MatrizFuncoesService', () => {
  function montar(
    over: { todos?: MatrizTecnico[]; achado?: MatrizTecnico } = {},
  ) {
    const repo = {
      find: jest.fn().mockResolvedValue(over.todos ?? []),
      findOne: jest.fn().mockResolvedValue(over.achado ?? null),
      save: jest
        .fn()
        .mockImplementation((t: MatrizTecnico) => Promise.resolve(t)),
    };
    const funcoes = { taxonomia: jest.fn().mockResolvedValue(TAX) };
    const service = new MatrizFuncoesService(repo as never, funcoes as never);
    return { service, repo, funcoes };
  }

  it('média do módulo é a média das funções avaliadas; não avaliada não conta', async () => {
    const { service } = montar();
    const r = await service.ficha(tecnico({ 'CTB|1': 10, 'CTB|2': 6 }));
    const ctb = r.modulos.find((m) => m.sigla === 'CTB')!;
    expect(ctb.media).toBe(8);
    expect(ctb.avaliadas).toBe(2);
    expect(ctb.total).toBe(2);
    const fat = r.modulos.find((m) => m.sigla === 'FAT')!;
    expect(fat.media).toBeNull();
    expect(fat.avaliadas).toBe(0);
  });

  it('a MESMA função em dois módulos tem nota independente por módulo', async () => {
    const { service } = montar();
    const r = await service.ficha(tecnico({ 'CTB|1': 10, 'FAT|1': 2 }));
    expect(r.modulos.find((m) => m.sigla === 'CTB')!.funcoes[0].nota).toBe(10);
    expect(r.modulos.find((m) => m.sigla === 'FAT')!.funcoes[0].nota).toBe(2);
  });

  it('resumo é a média das MÉDIAS dos módulos, com a cobertura total', async () => {
    const { service } = montar();
    const r = await service.ficha(
      tecnico({ 'CTB|1': 10, 'CTB|2': 6, 'FAT|1': 4 }),
    );
    // CTB=8, FAT=4 -> 6
    expect(r.resumo).toEqual({ media: 6, avaliadas: 3, total: 3 });
  });

  it('ficha sem nenhuma nota não quebra', async () => {
    const { service } = montar();
    const r = await service.ficha(tecnico({}));
    expect(r.resumo).toEqual({ media: null, avaliadas: 0, total: 3 });
  });

  it('JSON corrompido em notas_funcao é tratado como vazio', async () => {
    const { service } = montar();
    const r = await service.ficha({
      id: 1,
      notasFuncao: 'nao-e-json',
    } as MatrizTecnico);
    expect(r.resumo.avaliadas).toBe(0);
  });

  it('salvar limita a 0-10, arredonda e aceita vírgula', async () => {
    const alvo = tecnico({});
    const { service, repo } = montar({ achado: alvo });
    await service.salvar(
      1,
      { 'CTB|1': '15', 'CTB|2': '7,6', 'FAT|1': '-3' },
      'Ana',
    );
    const salvo = repo.save.mock.calls[0][0] as MatrizTecnico;
    expect(JSON.parse(salvo.notasFuncao)).toEqual({
      'CTB|1': 10,
      'CTB|2': 8,
      'FAT|1': 0,
    });
    expect(salvo.atualizadoPor).toBe('Ana');
  });

  it('nota vazia REMOVE a avaliação; texto inválido é ignorado', async () => {
    const alvo = tecnico({ 'CTB|1': 9, 'CTB|2': 5 });
    const { service, repo } = montar({ achado: alvo });
    await service.salvar(1, { 'CTB|1': '', 'CTB|2': 'abc' }, 'Ana');
    const salvo = repo.save.mock.calls[0][0] as MatrizTecnico;
    expect(JSON.parse(salvo.notasFuncao)).toEqual({ 'CTB|2': 5 });
  });

  it('salvar em técnico inexistente devolve false sem gravar', async () => {
    const { service, repo } = montar({ achado: undefined });
    await expect(service.salvar(99, { 'CTB|1': '5' }, 'Ana')).resolves.toBe(
      false,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});

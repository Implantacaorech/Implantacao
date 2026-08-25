import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClienteApi } from '../database/entities/cliente-api.entity';
import { ClienteApiService } from './cliente-api.service';
import { ClienteApiRepository } from './repositories/cliente-api.repository';

/** Repositório em memória — o alvo aqui é a REGRA (formato da chave, hash, escopo,
 * revogação), não o TypeORM. */
class RepoFalso {
  registros: ClienteApi[] = [];
  private seq = 1;

  listar = (): Promise<ClienteApi[]> => Promise.resolve(this.registros);
  porId = (id: number): Promise<ClienteApi | null> =>
    Promise.resolve(this.registros.find((c) => c.id === id) ?? null);
  porPrefixo = (prefixo: string): Promise<ClienteApi | null> =>
    Promise.resolve(this.registros.find((c) => c.prefixo === prefixo) ?? null);

  criar = (dados: Partial<ClienteApi>): Promise<ClienteApi> => {
    const c = { id: this.seq++, criadoEm: new Date(), ...dados } as ClienteApi;
    this.registros.push(c);
    return Promise.resolve(c);
  };

  salvar = (c: ClienteApi): Promise<ClienteApi> => Promise.resolve(c);
  marcarUso = (id: number, quando: Date): Promise<void> => {
    const c = this.registros.find((x) => x.id === id);
    if (c) c.ultimoUsoEm = quando;
    return Promise.resolve();
  };
  remover = (id: number): Promise<void> => {
    this.registros = this.registros.filter((c) => c.id !== id);
    return Promise.resolve();
  };
}

function montar(): { servico: ClienteApiService; repo: RepoFalso } {
  const repo = new RepoFalso();
  return {
    servico: new ClienteApiService(repo as unknown as ClienteApiRepository),
    repo,
  };
}

describe('ClienteApiService', () => {
  it('cria com chave rd_<prefixo>_<segredo> e guarda só o hash', async () => {
    const { servico, repo } = montar();
    const criado = await servico.criar({
      nome: 'Power BI',
      escopos: ['sicla:leitura'],
    });

    expect(criado.chave).toMatch(/^rd_[0-9a-f]{12}_[0-9a-f]{48}$/);
    const guardado = repo.registros[0];
    // O segredo NUNCA fica no banco: vazamento do dump não devolve chave utilizável.
    expect(criado.chave).not.toContain(guardado.chaveHash);
    expect(guardado.chaveHash).not.toContain(criado.chave.split('_')[2]);
    expect(guardado.chaveHash.startsWith('$2')).toBe(true);
  });

  it('a chave não volta em nenhuma listagem', async () => {
    const { servico } = montar();
    await servico.criar({ nome: 'BI', escopos: ['sicla:leitura'] });
    const lista = await servico.listar();
    expect(JSON.stringify(lista)).not.toContain('rd_');
    expect(Object.keys(lista[0])).not.toContain('chaveHash');
  });

  it('recusa escopo que não existe no catálogo', async () => {
    const { servico } = montar();
    await expect(
      servico.criar({ nome: 'X', escopos: ['banco_inexistente:leitura'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa cadastro sem escopo nenhum', async () => {
    const { servico } = montar();
    await expect(
      servico.criar({ nome: 'X', escopos: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa cadastro sem nome', async () => {
    const { servico } = montar();
    await expect(
      servico.criar({ nome: '   ', escopos: ['sicla:leitura'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('autentica a chave correta e registra o uso', async () => {
    const { servico, repo } = montar();
    const { chave } = await servico.criar({
      nome: 'Agente IA',
      escopos: ['sicla:leitura'],
    });
    const cliente = await servico.autenticar(chave);
    expect(cliente?.nome).toBe('Agente IA');
    expect(servico.escoposDoCliente(cliente as ClienteApi)).toEqual([
      'sicla:leitura',
    ]);
    // `marcarUso` é disparado sem await pelo service — dá um tick ao event loop.
    await Promise.resolve();
    expect(repo.registros[0].ultimoUsoEm).toBeInstanceOf(Date);
  });

  it('recusa chave errada, malformada ou de cliente revogado', async () => {
    const { servico } = montar();
    const { chave, id } = await servico.criar({
      nome: 'X',
      escopos: ['sicla:leitura'],
    });

    expect(await servico.autenticar('lixo')).toBeNull();
    expect(await servico.autenticar(`${chave}x`)).toBeNull();
    expect(await servico.autenticar('rd_naoexiste_abc')).toBeNull();

    await servico.definirAtivo(id, false);
    expect(await servico.autenticar(chave)).toBeNull();
  });

  it('rotacionar invalida a chave anterior e mantém id e escopos', async () => {
    const { servico } = montar();
    const antigo = await servico.criar({
      nome: 'Integração',
      escopos: ['sicla:leitura'],
    });
    const novo = await servico.rotacionar(antigo.id);

    expect(novo.id).toBe(antigo.id);
    expect(novo.escopos).toEqual(['sicla:leitura']);
    expect(novo.chave).not.toBe(antigo.chave);
    expect(await servico.autenticar(antigo.chave)).toBeNull();
    expect((await servico.autenticar(novo.chave))?.id).toBe(antigo.id);
  });

  it('404 ao mexer em cliente que não existe', async () => {
    const { servico } = montar();
    await expect(servico.rotacionar(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('atualizar valida os escopos novos', async () => {
    const { servico } = montar();
    const c = await servico.criar({ nome: 'X', escopos: ['sicla:leitura'] });
    await expect(
      servico.atualizar(c.id, { escopos: ['inventado:leitura'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const ok = await servico.atualizar(c.id, {
      escopos: ['sicla:leitura', 'portal_rech:leitura'],
    });
    expect(ok.escopos).toEqual(['sicla:leitura', 'portal_rech:leitura']);
  });
});

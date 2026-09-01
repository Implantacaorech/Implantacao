/**
 * Copia todos os dados do Postgres de producao (MIGRACAO_DB_URL_SOURCE) para o MariaDB
 * (MIGRACAO_DB_URL, alvo padrao ja detectado pelo prefixo mysql://) — generico, table a
 * table via a lista ENTITIES, preservando o id original (nenhuma entidade desta migracao
 * usa FK real com CASCADE, entao a ordem entre tabelas nao importa para integridade).
 *
 * Ja usado uma vez em producao com sucesso (2026-07-17, ver
 * docs/migracao/03-documento-conversao.md §21) — 3.169 linhas em 25 tabelas, zero perda.
 * Mantido aqui (fora do build via tsconfig.build.json) para referencia/reuso futuro, ex.
 * se for preciso ressincronizar dados antes de um rollback ou repetir o processo.
 *
 * Uso (rodar de dentro de backend/, com as DUAS variaveis definidas nesta sessao):
 *   MIGRACAO_DB_URL_SOURCE = postgresql://... (producao, Postgres)
 *   MIGRACAO_DB_URL        = mysql://...      (alvo, MariaDB)
 *   npx ts-node -r tsconfig-paths/register scripts/migrar-postgres-para-mariadb.ts
 *
 * Idempotente NAO e' — espera um alvo MariaDB com schema criado (migration ja rodada) e
 * SEM dados (senao da erro de PK duplicada, de proposito: nao sobrescreve silenciosamente).
 */
import { DataSource } from 'typeorm';
import { ENTITIES } from '../src/database/entities';

async function main(): Promise<void> {
  const origemUrl = process.env.MIGRACAO_DB_URL_SOURCE;
  const destinoUrl = process.env.MIGRACAO_DB_URL;
  if (!origemUrl || !destinoUrl) {
    throw new Error(
      'Defina MIGRACAO_DB_URL_SOURCE (Postgres) e MIGRACAO_DB_URL (MariaDB) antes de rodar.',
    );
  }
  if (!/^(mysql|mariadb):\/\//i.test(destinoUrl)) {
    throw new Error(
      'MIGRACAO_DB_URL precisa apontar para o MariaDB (mysql://...) — e a URL do ALVO, nao da origem.',
    );
  }

  const origem = new DataSource({
    type: 'postgres',
    url: origemUrl,
    entities: ENTITIES,
    synchronize: false,
  });
  const destino = new DataSource({
    type: 'mariadb',
    url: destinoUrl,
    charset: 'utf8mb4',
    entities: ENTITIES,
    synchronize: false,
  });

  await origem.initialize();
  await destino.initialize();
  console.log('Conectado nas duas pontas.');

  const resumo: { tabela: string; linhas: number }[] = [];

  for (const Entidade of ENTITIES) {
    const nome = Entidade.name;
    const repoOrigem = origem.getRepository(Entidade);
    const repoDestino = destino.getRepository(Entidade);
    const tabela = destino.getMetadata(Entidade as any).tableName;

    const linhas = await repoOrigem.find();
    if (linhas.length === 0) {
      resumo.push({ tabela, linhas: 0 });
      continue;
    }

    // Insere em lotes de 200 preservando o id original (necessario para as referencias
    // numericas entre tabelas — projetoId, modeloId, etc. — que nao sao FK de verdade
    // mas precisam bater com o id da linha-pai copiada).
    const LOTE = 200;
    for (let i = 0; i < linhas.length; i += LOTE) {
      const parte = linhas.slice(i, i + LOTE);
      await repoDestino.insert(parte);
    }

    // Ajusta o AUTO_INCREMENT para depois do maior id copiado — sem isso, o proximo
    // INSERT feito pela aplicacao (sem id explicito) colidiria com um id ja usado.
    const maiorId = Math.max(...linhas.map((l: any) => l.id ?? 0));
    await destino.query(
      `ALTER TABLE \`${tabela}\` AUTO_INCREMENT = ${maiorId + 1}`,
    );

    resumo.push({ tabela, linhas: linhas.length });
    console.log(`${tabela}: ${linhas.length} linha(s) copiada(s).`);
  }

  console.log('\n=== Resumo ===');
  for (const r of resumo) console.log(`${r.tabela}: ${r.linhas}`);
  const total = resumo.reduce((acc, r) => acc + r.linhas, 0);
  console.log(`Total: ${total} linha(s) em ${resumo.length} tabela(s).`);

  await origem.destroy();
  await destino.destroy();
}

main().catch((e) => {
  console.error('ERRO NA MIGRACAO:', e.message);
  process.exit(1);
});

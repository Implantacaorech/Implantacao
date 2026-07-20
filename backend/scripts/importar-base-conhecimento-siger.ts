/**
 * Importa a exportação de conteúdo gerada pelo repositório BaseConhecimentoSiger
 * (`python scripts/exportar_conteudo.py`, arquivo `dados/exportacao-conteudo.json` — só inclui
 * arquivos de F:\Fontes que a conta de auditoria conseguiu ler; hoje uma fração pequena do
 * total por restrição de ACL do servidor de arquivos, ver siger-fonte.entity.ts) para a tabela
 * `siger_fontes` deste banco. Upsert por `caminho` (chave única) — rodar de novo com uma
 * exportação mais recente atualiza as linhas existentes em vez de duplicar.
 *
 * Uso (de dentro de backend/, com MIGRACAO_DB_URL já definido no ambiente):
 *   npx ts-node -r tsconfig-paths/register scripts/importar-base-conhecimento-siger.ts \
 *     [caminho-do-json]
 *
 * Sem argumento, usa o caminho padrão do repositório-irmão BaseConhecimentoSiger.
 */
import { AppDataSource } from '../src/database/data-source';
import { SigerFonte } from '../src/database/entities/siger-fonte.entity';
import * as fs from 'fs';
import * as path from 'path';

const CAMINHO_PADRAO = path.resolve(
  __dirname,
  '../../../BaseConhecimentoSiger/dados/exportacao-conteudo.json',
);

interface ArquivoExportado {
  caminho: string;
  extensao: string;
  pastaRaiz: string;
  tamanhoBytes: number;
  modificadoEm: string;
  hashSha256: string;
  conteudo: string | null;
}

interface Exportacao {
  origem: string;
  geradoEm: string;
  arquivos: ArquivoExportado[];
}

const TAMANHO_LOTE = 200;

async function main(): Promise<void> {
  const caminhoJson = process.argv[2] ?? CAMINHO_PADRAO;
  if (!fs.existsSync(caminhoJson)) {
    throw new Error(`Arquivo de exportação não encontrado: ${caminhoJson}`);
  }

  const exportacao: Exportacao = JSON.parse(fs.readFileSync(caminhoJson, 'utf-8'));
  console.log(
    `Exportação de ${exportacao.origem}, gerada em ${exportacao.geradoEm}: ${exportacao.arquivos.length} arquivos com conteúdo legível.`,
  );

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(SigerFonte);

  let importados = 0;
  for (let inicio = 0; inicio < exportacao.arquivos.length; inicio += TAMANHO_LOTE) {
    const lote = exportacao.arquivos.slice(inicio, inicio + TAMANHO_LOTE).map((a) => ({
      caminho: a.caminho,
      extensao: a.extensao,
      pastaRaiz: a.pastaRaiz,
      tamanhoBytes: a.tamanhoBytes,
      modificadoEm: new Date(a.modificadoEm),
      hashSha256: a.hashSha256,
      conteudo: a.conteudo,
    }));
    await repo.upsert(lote, ['caminho']);
    importados += lote.length;
    console.log(`  ... ${importados}/${exportacao.arquivos.length} importados`);
  }

  await AppDataSource.destroy();
  console.log(`Concluído: ${importados} arquivos importados/atualizados em siger_fontes.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});

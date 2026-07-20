/**
 * Ingestão da base de conhecimento curada do SIGER® (repositório Documentacao-Fonte-P:
 * pastas `modulos/` e `adicionais/` com os .md revisados) para a tabela
 * `dicionario_documentos`. 100% Node/TypeScript — nenhum Python envolvido.
 *
 * Upsert por `slug` (derivado do nome do arquivo): rodar de novo com documentos atualizados
 * substitui as linhas existentes sem duplicar. Documentos removidos da origem NÃO são
 * apagados aqui (preserva histórico) — some do resultado só se você limpar a tabela.
 *
 * Uso (de dentro de backend/, com MIGRACAO_DB_URL definido):
 *   npx ts-node -r tsconfig-paths/register scripts/ingerir-dicionario-siger.ts [pasta-raiz]
 *
 * Sem argumento, usa o caminho padrão do repositório de documentação no OneDrive.
 */
import { AppDataSource } from '../src/database/data-source';
import { DicionarioDocumento } from '../src/database/entities/dicionario-documento.entity';
import { parseDocumentoMarkdown } from '../src/dicionario/markdown-parser';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const RAIZ_PADRAO =
  'C:\\SEG-EVE\\OneDrive - rech.com.br\\Everton\\SIGER - Código Documentação\\Documentacao-Fonte';
const REPO_URL =
  'https://github.com/Implantacaorech/Documentacao-Fonte-P/blob/main';

function slugDoArquivo(nomeArquivo: string): string {
  return basename(nomeArquivo, '.md');
}

function listarMarkdown(pasta: string): string[] {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((n) => n.toLowerCase().endsWith('.md'))
    .sort();
}

async function main(): Promise<void> {
  const raiz = process.argv[2] ?? RAIZ_PADRAO;
  const grupos: { tipo: 'modulo' | 'adicional'; pasta: string }[] = [
    { tipo: 'modulo', pasta: join(raiz, 'modulos') },
    { tipo: 'adicional', pasta: join(raiz, 'adicionais') },
  ];

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(DicionarioDocumento);

  let total = 0;
  let inalterados = 0;
  for (const { tipo, pasta } of grupos) {
    const arquivos = listarMarkdown(pasta);
    console.log(`${tipo}: ${arquivos.length} documento(s) em ${pasta}`);
    for (const arquivo of arquivos) {
      const caminho = join(pasta, arquivo);
      const markdown = readFileSync(caminho, 'utf8');
      const parsed = parseDocumentoMarkdown(markdown);
      const slug = slugDoArquivo(arquivo);

      const existente = await repo.findOne({ where: { slug } });
      if (existente && existente.hashConteudo === parsed.hashConteudo) {
        inalterados += 1;
        continue; // incremental: só reprocessa o que mudou (hash diferente)
      }

      const registro = repo.create({
        ...(existente ? { id: existente.id } : {}),
        slug,
        tipo,
        sigla: parsed.sigla,
        titulo: parsed.titulo,
        resumo: parsed.resumo,
        conteudo: markdown,
        palavrasChave: parsed.palavrasChave.join(' '),
        caminhoOrigem: caminho,
        urlOrigem: `${REPO_URL}/${tipo === 'modulo' ? 'modulos' : 'adicionais'}/${arquivo}`,
        hashConteudo: parsed.hashConteudo,
      });
      await repo.save(registro);
      total += 1;
    }
  }

  await AppDataSource.destroy();
  console.log(
    `Concluído: ${total} documento(s) ingerido(s)/atualizado(s), ${inalterados} inalterado(s).`,
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});

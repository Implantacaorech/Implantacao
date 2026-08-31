import 'dotenv/config';
import { basename } from 'path';
import { readFileSync } from 'fs';
import { AppDataSource } from '../data-source';
import { ModeloDocumento } from '../entities/modelo-documento.entity';
import { ModeloDocumentoVersao } from '../entities/modelo-documento-versao.entity';
import { ModeloDocumentoCampo } from '../entities/modelo-documento-campo.entity';
import { ModeloDocumentoService } from '../../catalogos/modelo-documento.service';

/**
 * Publica uma nova versão de um layout no Cadastro de Modelos, pela linha de comando.
 *
 *   npm run modelo:publicar -- --slug=projeto --arquivo=C:\caminho\projeto.docx \
 *     --autor="Fulano" --motivo="o que mudou"
 *
 * O caminho normal dessa troca é a TELA (Sistema → Modelos de Documentos): é lá que ela
 * acontece com o usuário logado e sem ninguém precisar de acesso ao servidor. Este script
 * existe para quando a publicação tem de ser feita a partir da máquina — e usa o MESMO
 * `ModeloDocumentoService.enviarVersao` da tela, de propósito: a numeração da versão, a
 * troca do `vigente` das anteriores e a atualização do arquivo do modelo ficam num lugar
 * só. Reimplementar isso em SQL seria a maneira de esquecer de desmarcar a versão velha.
 *
 * `--autor` e `--motivo` são OBRIGATÓRIOS e vão para o histórico que a tela mostra. Trocar
 * um layout oficial sem dizer quem trocou e por quê é o tipo de mudança que ninguém
 * consegue auditar depois.
 *
 * Exige `MIGRACAO_DB_URL` (o banco real) e precisa rodar com o `cwd` em `backend/`, que é
 * onde fica o store gravável `dados/modelos_documento/`.
 */
function arg(nome: string): string {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : '';
}

async function main(): Promise<void> {
  const slug = arg('slug');
  const arquivo = arg('arquivo');
  const autor = arg('autor');
  const motivo = arg('motivo');

  if (!slug || !arquivo || !autor || !motivo) {
    console.error(
      'Uso: npm run modelo:publicar -- --slug=<slug> --arquivo=<caminho> ' +
        '--autor="<quem>" --motivo="<por quê>"',
    );
    process.exitCode = 1;
    return;
  }
  if (!process.env.MIGRACAO_DB_URL) {
    console.error(
      'MIGRACAO_DB_URL não definida — sem ela o script publicaria num SQLite descartável, ' +
        'não no Painel. Defina a variável e rode de novo.',
    );
    process.exitCode = 1;
    return;
  }

  const conteudo = readFileSync(arquivo);
  await AppDataSource.initialize();
  try {
    const servico = new ModeloDocumentoService(
      AppDataSource.getRepository(ModeloDocumento),
      AppDataSource.getRepository(ModeloDocumentoVersao),
      AppDataSource.getRepository(ModeloDocumentoCampo),
    );

    const modelo = await servico.porSlug(slug);
    if (!modelo) {
      console.error(`Modelo '${slug}' não está cadastrado.`);
      process.exitCode = 1;
      return;
    }

    const r = await servico.enviarVersao(
      modelo.id,
      basename(arquivo),
      conteudo,
      autor,
      motivo,
    );
    if (!r.ok) {
      console.error(`Recusado: ${r.erro}`);
      process.exitCode = 1;
      return;
    }

    const atual = await servico.obter(modelo.id);
    console.log(`Publicada a versão ${r.versao} de '${slug}'.`);
    console.log(`  arquivo vigente: ${atual.arquivo}`);
    console.log(`  autor: ${autor}`);
  } finally {
    await AppDataSource.destroy();
  }
}

void main();

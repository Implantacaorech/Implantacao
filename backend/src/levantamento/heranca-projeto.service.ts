import { Injectable } from '@nestjs/common';
import { ProjetoRepository } from '../database/repositories/projeto.repository';
import { IndiceTopicoService } from '../catalogos/indice-topico.service';
import { HerancaLevantamentoRepository } from './repositories/heranca-levantamento.repository';
import {
  AREAS_PROJETO,
  LINHAS_USUARIOS_PROJETO,
  areaPorSigla,
  siglasContratadas,
} from './areas-projeto.constants';

/**
 * Herança da etapa 3 (Levantamento de Processo) para a etapa 10 (Criação do Projeto).
 *
 * REGRA DE NEGÓCIO (definida pelo usuário em 2026-08-20): o Projeto de Implantação não é
 * redigido do zero — ele HERDA tudo que foi levantado na etapa 3, e o GCI entra na tela da
 * etapa 10 para revisar e ajustar o que for necessário antes de gerar o documento. Só depois
 * disso o passo 11 (conferência do Administrativo e envio ao cliente para assinatura) faz
 * sentido: o que o cliente assina é o levantamento revisado, não uma folha em branco.
 *
 * Antes disso a tela da etapa 10 abria vazia e o único caminho era o consultor redigitar —
 * ou gerar o .docx direto, sem revisão nenhuma.
 *
 * A herança é um FALLBACK VIVO, não uma cópia: enquanto o campo do Projeto estiver vazio, o
 * valor é recalculado da etapa 3 a cada leitura, então correção feita no Levantamento depois
 * ainda chega ao Projeto. Assim que o GCI salva um valor, o dele vence e nunca mais é
 * sobreposto. A contrapartida — assumida na decisão — é que apagar um campo herdado não
 * "cola": ele volta a mostrar o que veio da etapa 3. Para suprimir de vez, o GCI escreve o
 * texto que quer no lugar.
 */
@Injectable()
export class HerancaProjetoService {
  constructor(
    private readonly levantamento: HerancaLevantamentoRepository,
    private readonly projetos: ProjetoRepository,
    private readonly indice: IndiceTopicoService,
  ) {}

  /**
   * Valores que a etapa 10 herda da etapa 3, prontos para servirem de fallback dos campos
   * de `DocConteudo doc='projeto'`. Campo sem origem no Levantamento simplesmente não
   * aparece no mapa (não vira string vazia) — quem chama decide o que fazer com a ausência.
   */
  async valores(projetoId: number): Promise<Record<string, string>> {
    const projeto = await this.projetos.porId(projetoId);
    if (!projeto) return {};

    const lev = await this.levantamento.camposDoLevantamento(projetoId);
    const de = (campo: string): string => lev.get(campo) || '';

    const out: Record<string, string> = {};
    const por = (chave: string, valor: string) => {
      if (valor) out[chave] = valor;
    };

    // --- Identificação e escopo -----------------------------------------------------
    // Os objetivos do projeto nascem das observações/objetivos anotados no levantamento.
    por('objetivos', de('objetivos'));
    // "Empresas contempladas no projeto" é a mesma informação que o levantamento anota como
    // "Localização / Filiais" — matriz e filiais que vão usar o SIGER.
    por('empresas', de('filiais'));

    // --- Tabela de Usuários ---------------------------------------------------------
    // Os usuários-chave levantados na etapa 3 são os mesmos que assinam o protocolo. A
    // coluna "Área de Atuação no SIGER" do Projeto recebe as "Atribuições" do levantamento;
    // "Assina Protocolo" não existe na etapa 3 e fica para o GCI decidir na tela.
    for (let i = 0; i < LINHAS_USUARIOS_PROJETO; i++) {
      por(`usu_${i}_nome`, de(`usu_${i}_nome`));
      por(`usu_${i}_email`, de(`usu_${i}_email`));
      por(`usu_${i}_area`, de(`usu_${i}_atrib`));
    }

    // --- Detalhamento das Rotinas, por área contratada -------------------------------
    Object.assign(out, await this.detalhamentoPorArea(projetoId, projeto.modulos));
    return out;
  }

  /**
   * Blocos "Detalhamento de Rotinas" de cada área contratada, montados do questionário
   * respondido na etapa 3.
   *
   * O formato é o MESMO que `_valor()` de docservice/gerador/gl_projeto.py já produzia
   * direto no .docx (`Tópico: resposta`, uma linha por tópico; `SIGLA — Nome` nos módulos).
   * A diferença é onde ele aparece: agora também na TELA da etapa 10, para o GCI revisar
   * antes de gerar — antes o texto só existia dentro do documento pronto.
   */
  private async detalhamentoPorArea(
    projetoId: number,
    modulos: string,
  ): Promise<Record<string, string>> {
    const siglas = siglasContratadas(modulos);
    const daSigla = areaPorSigla();
    const nomeDoModulo = new Map(
      (await this.indice.modulos()).map((m) => [
        m.sigla.toUpperCase(),
        m.nome,
      ]),
    );

    const respostas = await this.levantamento.respostasDoProjeto(projetoId);

    // Um tópico marcado "Não será utilizado." não é detalhamento de rotina atendida — é
    // exatamente o que o layout chama de "Não está previsto neste projeto". Separar os dois
    // é o que impede a frase padrão de poluir o detalhamento (e some do "não previsto", que
    // saía sempre em branco).
    const atendidas = new Map<string, string[]>();
    const naoPrevistas = new Map<string, string[]>();
    for (const r of respostas) {
      const area = daSigla.get((r.moduloSigla || '').toUpperCase());
      if (!area) continue;
      const topico = (r.topico || '').trim();
      const resposta = (r.resposta || '').trim();
      if (r.naoUtilizado) {
        if (topico) naoPrevistas.set(area, [...(naoPrevistas.get(area) ?? []), topico]);
        continue;
      }
      if (!resposta) continue;
      atendidas.set(area, [
        ...(atendidas.get(area) ?? []),
        topico ? `${topico}: ${resposta}` : resposta,
      ]);
    }

    const out: Record<string, string> = {};
    for (const area of AREAS_PROJETO) {
      const contratadas = area.siglas.filter((s) => siglas.has(s));
      if (contratadas.length === 0) continue; // área não contratada não entra no Projeto
      out[`det_${area.chave}_modulos`] = contratadas
        .map((s) => (nomeDoModulo.get(s) ? `${s} — ${nomeDoModulo.get(s)}` : s))
        .join(', ');
      const detalhamento = atendidas.get(area.chave);
      if (detalhamento?.length) {
        out[`det_${area.chave}_detalhamento`] = detalhamento.join('\n');
      }
      const naoPrevisto = naoPrevistas.get(area.chave);
      if (naoPrevisto?.length) {
        out[`det_${area.chave}_naoprevisto`] = naoPrevisto.join('\n');
      }
    }
    return out;
  }
}

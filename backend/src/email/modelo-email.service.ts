import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModeloEmail } from '../database/entities/modelo-email.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { MODELOS_EMAIL_PADRAO, VAR_CAMPO } from './modelo-email.constants';
import { EMAILS_POR_PASSO } from '../passos/passos-email.constants';
import { PASSOS_POR_NUMERO } from '../passos/passos.constants';

/** Modelos de e-mail editáveis pelo ADM, com variáveis `{{VAR}}` substituídas no envio.
 * Espelha webapp/db.py (ModeloEmail, listar/obter/salvar/excluir_modelo_email,
 * renderizar_modelo, _seed_modelos_email). */
@Injectable()
export class ModeloEmailService implements OnModuleInit {
  private readonly logger = new Logger('ModeloEmailService');

  constructor(
    @InjectRepository(ModeloEmail)
    private readonly repo: Repository<ModeloEmail>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.seedPadroes();
    } catch (e) {
      this.logger.error(
        'Falha ao semear modelos_email no boot',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** Idempotente por slug — não sobrescreve edições feitas pelo ADM em modelos já
   * existentes.
   *
   * Semeia DUAS famílias:
   *   - os modelos avulsos históricos (`MODELOS_EMAIL_PADRAO`), herdados do Flask;
   *   - um modelo por PASSO do processo, com slug `passo-N`. Esses são os que o fluxo
   *     realmente dispara: editar o `passo-15` muda o e-mail de boas-vindas para todos os
   *     projetos, sem release. Sem semear, a tela de Modelos de E-mail abriria sem os textos
   *     que o Painel de fato manda — que foi o que o usuário sentiu falta. */
  async seedPadroes(): Promise<number> {
    let criados = 0;
    const paraSemear = [
      ...MODELOS_EMAIL_PADRAO,
      ...EMAILS_POR_PASSO.map((e) => {
        const def = PASSOS_POR_NUMERO.get(e.passo);
        return {
          slug: `passo-${e.passo}`,
          nome: `Passo ${e.passo} — ${def?.titulo ?? 'Passo do processo'}`,
          assunto: e.assunto,
          corpo: e.corpo,
          etapa: def?.etapa ?? '',
        };
      }),
    ];
    for (const m of paraSemear) {
      const existe = await this.repo.count({ where: { slug: m.slug } });
      if (existe > 0) continue;
      await this.repo.save(
        this.repo.create({
          slug: m.slug,
          nome: m.nome,
          assunto: m.assunto,
          corpo: m.corpo,
          etapa: m.etapa,
          ativo: true,
          padrao: true,
        }),
      );
      criados += 1;
    }
    return criados;
  }

  async listar(apenasAtivos = true): Promise<ModeloEmail[]> {
    return this.repo.find({
      where: apenasAtivos ? { ativo: true } : {},
      order: { nome: 'ASC' },
    });
  }

  async obter(id: number): Promise<ModeloEmail> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Modelo de e-mail não encontrado.');
    return m;
  }

  /** Modelo pelo slug (o identificador estável dos semeados) — `null` se não existir.
   * É como as telas que enviam e-mail avulso (ex.: painel de visitas do BI) buscam seu
   * texto padrão, com fallback no constante embutido. */
  async porSlug(slug: string): Promise<ModeloEmail | null> {
    const s = (slug || '').trim();
    if (!s) return null;
    return this.repo.findOne({ where: { slug: s } });
  }

  async salvar(
    dados: {
      nome?: string;
      assunto?: string;
      corpo?: string;
      etapa?: string;
      ativo?: boolean;
    },
    id?: number,
  ): Promise<ModeloEmail> {
    let m: ModeloEmail;
    if (id) {
      m = await this.obter(id);
    } else {
      m = this.repo.create({});
    }
    m.nome = (dados.nome || '').trim();
    m.assunto = (dados.assunto || '').trim();
    m.corpo = (dados.corpo || '').trim();
    m.etapa = (dados.etapa || '').trim();
    m.ativo = dados.ativo ?? true;
    if (!id) {
      m.slug = await this.gerarSlugUnico(m.nome);
    }
    return this.repo.save(m);
  }

  private async gerarSlugUnico(nome: string): Promise<string> {
    const base =
      (nome || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'modelo';
    let slug = base;
    let n = 1;
    while ((await this.repo.count({ where: { slug } })) > 0) {
      slug = `${base}-${n}`;
      n += 1;
    }
    return slug;
  }

  /** `padrao` (modelo semeado no boot) não pode ser excluído — só editado. */
  async excluir(id: number): Promise<{ ok: boolean; erro: string | null }> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) return { ok: false, erro: 'Modelo não encontrado.' };
    if (m.padrao) {
      return {
        ok: false,
        erro: 'Modelos padrão não podem ser excluídos (apenas editados).',
      };
    }
    await this.repo.remove(m);
    return { ok: true, erro: null };
  }

  async alternarAtivo(id: number): Promise<ModeloEmail> {
    const m = await this.obter(id);
    m.ativo = !m.ativo;
    return this.repo.save(m);
  }

  /** Substitui variáveis `{{VAR}}` pelo valor correspondente do projeto — substituição
   * literal (não é um motor de templating: sem regex, sem escaping, uma passada só).
   * `{{VAR}}` sem correspondência em VAR_CAMPO fica como está no texto. */
  renderizar(texto: string, proj: Partial<Projeto>): string {
    if (!texto) return texto;
    const consultores = (proj.consultor || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const valores: Record<string, string> = {
      ...(proj as unknown as Record<string, string>),
      _consultorA: consultores[0] ?? '',
      _consultorB: consultores[1] ?? '',
    };
    let resultado = texto;
    for (const [variavel, campo] of Object.entries(VAR_CAMPO)) {
      const valor = String(valores[campo] ?? '').trim();
      resultado = resultado.split(variavel).join(valor);
    }
    return resultado;
  }
}

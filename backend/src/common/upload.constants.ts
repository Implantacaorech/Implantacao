/**
 * Tetos de tamanho de upload — achado A4 da auditoria de 2026-08-12. Nenhum `FileInterceptor`
 * declarava `limits`, e não há `MulterModule.register`: com `memoryStorage`, isso era upload
 * ILIMITADO em memória. Um único POST grande derrubava o processo Node por OOM (e a rota de
 * upload de vídeo já lida com centenas de MB no uso normal). Cada rota passa a declarar o teto
 * adequado à sua carga; estourar vira **413** (ver HttpExceptionFilter).
 */

/** Documentos e anexos: .docx, .msg/.eml, .yaml, JSON de credencial, base64. 25 MB é folgado
 * para esses formatos e barra o abuso. */
export const LIMITE_UPLOAD_DOC = 25 * 1024 * 1024;

/** Mídia de reunião/treinamento: vídeo e áudio. Uma gravação de 56 min já passou de 180 MB, e
 * treinamentos longos vão além — 2 GB é o teto que cobre o caso real sem virar ilimitado. */
export const LIMITE_UPLOAD_MIDIA = 2 * 1024 * 1024 * 1024;

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { supabaseAdmin } from '@config/supabase';
import { EmbeddingService } from '@services/knowledge/embedding.service';
import { logger } from '@utils/logger';

export interface JSONLRecord {
  chunk_id: string;
  sheet_id: string;
  topic: string;
  source_file: string;
  q_ml: string;
  q_en: string;
  a_ml: string;
  a_en: string;
  audience: string;
  escalate?: boolean | string;
}

export const DOC_CORPUS_V9_ID = '00000000-0000-0000-0000-0000000000c9';
export const DOC_CORPUS_INFONEEDS_ID = '00000000-0000-0000-0000-0000000000c2';

const embeddingService = new EmbeddingService();

function locateFile(filename: string): string {
  const possiblePaths = [
    path.join('C:', 'Users', 'ACM', 'Downloads', filename),
    path.join(process.cwd(), 'src', 'data', filename),
    path.join(process.cwd(), filename),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(`Corpus file '${filename}' not found in any expected location.`);
}

function parseJSONLFile(filePath: string): JSONLRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  const records: JSONLRecord[] = [];
  lines.forEach((line, idx) => {
    try {
      const obj = JSON.parse(line.trim());
      records.push(obj);
    } catch (err) {
      logger.error(`Failed to parse line ${idx + 1} in ${filePath}`, { error: (err as Error).message });
    }
  });

  return records;
}

export async function ingestCorpusFile(
  documentId: string,
  title: string,
  fileName: string,
  records: JSONLRecord[]
): Promise<number> {
  logger.info(`Starting ingestion for '${title}' (${records.length} records)...`, { documentId, fileName });

  // 1. Ensure document record exists in knowledge_documents
  const { data: existingDoc } = await supabaseAdmin
    .from('knowledge_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (!existingDoc) {
    const { error: insertDocErr } = await supabaseAdmin.from('knowledge_documents').insert({
      id: documentId,
      title,
      description: `Pre-structured Clinician-Approved Knowledge Corpus (${records.length} Q&A units)`,
      category: 'Structured Corpus',
      file_name: fileName,
      storage_path: `corpus/${fileName}`,
      mime_type: 'application/jsonl',
      file_size: 1024,
      status: 'processing',
      approved: true,
      total_chunks: records.length,
    });

    if (insertDocErr) {
      throw new Error(`Failed to create document record for ${title}: ${insertDocErr.message}`);
    }
  } else {
    await supabaseAdmin
      .from('knowledge_documents')
      .update({
        status: 'processing',
        total_chunks: records.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);
  }

  // 2. Clear pre-existing chunks for idempotency
  logger.info(`Clearing previous chunks for documentId ${documentId}...`);
  const { error: deleteChunkErr } = await supabaseAdmin
    .from('knowledge_chunks')
    .delete()
    .eq('document_id', documentId);

  if (deleteChunkErr) {
    logger.warn('Notice when clearing previous chunks', { error: deleteChunkErr.message });
  }

  // 3. Prepare text strings for embedding: embedding target is `q_en + topic`
  const embedTexts = records.map((r) => `${r.q_en} Topic: ${r.topic}`);

  // 4. Batch generate 384-dimensional vector embeddings via OpenAI API
  logger.info(`Generating embeddings for ${records.length} records...`);
  const embeddingResults = await embeddingService.getBatchEmbeddings(embedTexts);

  if (embeddingResults.length !== records.length) {
    throw new Error(`Embedding count mismatch: expected ${records.length}, received ${embeddingResults.length}`);
  }

  // 5. Build database chunk rows preserving full metadata structure
  const chunkRows = records.map((rec, idx) => {
    const isEscalate = rec.escalate === true || String(rec.escalate).toLowerCase() === 'true';
    const structuredContent = `TOPIC: ${rec.topic}
AUDIENCE: ${rec.audience}
QUESTION (EN): ${rec.q_en}
QUESTION (ML): ${rec.q_ml}
APPROVED ANSWER (ML): ${rec.a_ml}
APPROVED ANSWER (EN): ${rec.a_en}`;

    const metadata = {
      chunk_id: rec.chunk_id,
      sheet_id: rec.sheet_id,
      topic: rec.topic,
      source_file: rec.source_file,
      q_ml: rec.q_ml,
      q_en: rec.q_en,
      a_ml: rec.a_ml,
      a_en: rec.a_en,
      audience: rec.audience,
      escalate: isEscalate,
      is_structured_corpus: true,
    };

    return {
      document_id: documentId,
      chunk_index: idx,
      content: structuredContent,
      token_count: Math.ceil(structuredContent.length / 4),
      embedding: JSON.stringify(embeddingResults[idx].embedding),
      metadata,
    };
  });

  // 6. Insert chunks into knowledge_chunks in batches of 50
  const BATCH_SIZE = 50;
  let insertedCount = 0;

  for (let i = 0; i < chunkRows.length; i += BATCH_SIZE) {
    const batch = chunkRows.slice(i, i + BATCH_SIZE);
    const { error: insertErr } = await supabaseAdmin.from('knowledge_chunks').insert(batch);

    if (insertErr) {
      logger.error('Failed to insert chunk batch into knowledge_chunks', { error: insertErr.message });
      throw new Error(`Failed to insert chunks: ${insertErr.message}`);
    }

    insertedCount += batch.length;
    logger.info(`Inserted ${insertedCount}/${records.length} chunks...`);
  }

  // 7. Update document status to completed
  await supabaseAdmin
    .from('knowledge_documents')
    .update({
      status: 'completed',
      approved: true,
      total_chunks: insertedCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  logger.info(`Successfully completed ingestion for '${title}' (${insertedCount} chunks inserted).`);
  return insertedCount;
}

export async function runIngestion() {
  console.log('===========================================================');
  console.log('=== STARTING CLIENT JSONL KNOWLEDGE CORPUS INGESTION ===');
  console.log('===========================================================\n');

  const v9Path = locateFile('corpus_v9.jsonl.txt');
  const infoPath = locateFile('corpus_infoneeds.jsonl.txt');

  const v9Records = parseJSONLFile(v9Path);
  const infoRecords = parseJSONLFile(infoPath);

  console.log(`Read ${v9Records.length} records from ${path.basename(v9Path)}`);
  console.log(`Read ${infoRecords.length} records from ${path.basename(infoPath)}`);

  const countV9 = await ingestCorpusFile(
    DOC_CORPUS_V9_ID,
    'Client Knowledge Corpus v9',
    'corpus_v9.jsonl',
    v9Records
  );

  const countInfo = await ingestCorpusFile(
    DOC_CORPUS_INFONEEDS_ID,
    'Client Treatment Decision Corpus',
    'corpus_infoneeds.jsonl',
    infoRecords
  );

  const totalIngested = countV9 + countInfo;
  console.log('\n===========================================================');
  console.log(`=== INGESTION SUCCESS: ${totalIngested}/121 RECORDS INGESTED ===`);
  console.log('===========================================================\n');
}

if (require.main === module) {
  runIngestion().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
}
